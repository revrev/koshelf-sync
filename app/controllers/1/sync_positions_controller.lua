local cjson = require "cjson.safe"
local Redis = require "db.redis"
local Audiobookshelf = require "lib.audiobookshelf"
local AudiobookshelfConfig = require "lib.audiobookshelf_config"
local Logger = require "lib.logger"

local SyncPositionsController = {
    user_key = "user:%s:key",
    doc_key = "user:%s:document:%s",
    error_no_redis = 1000,
    error_unauthorized_user = 2001,
    error_invalid_fields = 2003,
    error_not_linked = 3001,
    error_no_progress = 3002,
}

local null = ngx and ngx.null

local function is_valid_field(field)
    return type(field) == "string" and string.len(field) > 0
end

local function is_valid_key_field(field)
    return is_valid_field(field) and not string.find(field, ":")
end

local function open_redis()
    local redis = Redis:new()
    if not redis then
        return nil
    end
    return redis
end

function SyncPositionsController:getRedis()
    local redis = open_redis()
    if not redis then
        self:raise_error(self.error_no_redis)
    end
    return redis
end

function SyncPositionsController:authorize()
    local redis = self:getRedis()
    local auth_user = self.request.headers["x-auth-user"]
    local auth_key = self.request.headers["x-auth-key"]
    if is_valid_field(auth_key) and is_valid_key_field(auth_user) then
        local key = redis:get(string.format(self.user_key, auth_user))
        if key == auth_key then
            if ngx and ngx.ctx then
                ngx.ctx.authenticated_user = auth_user
            end
            return auth_user
        end
    end
end

local function ensure_authorized(self)
    local username = self:authorize()
    if not username then
        Logger.gui("auth.failed", { reason = "invalid credentials" }, "WARN")
        self:raise_error(self.error_unauthorized_user)
    end
    if ngx and ngx.ctx then
        ngx.ctx.authenticated_user = username
    end
    return username
end

-- Convert ebook percentage to audiobook currentTime (seconds)
local function percentage_to_seconds(percentage, duration)
    if not percentage or not duration then
        return nil
    end
    return percentage * tonumber(duration)
end

-- Convert audiobook currentTime to ebook percentage
local function seconds_to_percentage(current_time, duration)
    if not current_time or not duration then
        return nil
    end
    local dur = tonumber(duration)
    if dur <= 0 then
        return nil
    end
    return tonumber(current_time) / dur
end

-- Sync ebook position to audiobook
local function sync_to_audiobook(username, document, library_item_id, ebook_percentage, audio_duration)
    local current_time = percentage_to_seconds(ebook_percentage, audio_duration)
    if not current_time then
        return nil, "Unable to convert ebook position to audiobook time"
    end

    local success, err = Audiobookshelf.update_progress({
        username = username,
        document = document,
        library_item_id = library_item_id,
        current_time = current_time,
        duration = tonumber(audio_duration),
    })

    if not success then
        return nil, err
    end

    return {
        direction = "to_audiobook",
        ebook_percentage = ebook_percentage,
        audio_current_time = current_time,
        audio_duration = audio_duration,
    }
end

-- Sync audiobook position to ebook
local function sync_from_audiobook(redis, username, document, audio_current_time, audio_duration)
    local ebook_percentage = seconds_to_percentage(audio_current_time, audio_duration)
    if not ebook_percentage then
        return nil, "Unable to convert audiobook position to ebook percentage"
    end

    -- Update local progress in Redis
    local doc_key = string.format("user:%s:document:%s", username, document)
    local timestamp = ngx and ngx.time() or os.time()
    
    redis:hset(doc_key, "percentage", ebook_percentage)
    redis:hset(doc_key, "timestamp", timestamp)
    redis:hset(doc_key, "device", "AudiobookshelfSync")
    redis:hset(doc_key, "device_id", "sync")

    return {
        direction = "from_audiobook",
        ebook_percentage = ebook_percentage,
        audio_current_time = audio_current_time,
        audio_duration = audio_duration,
    }
end

function SyncPositionsController:sync_to_audio()
    local username = ensure_authorized(self)
    local document = self.params.document
    if not is_valid_key_field(document) then
        self:raise_error(self.error_invalid_fields)
    end

    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local library_item_id = config.document_map and config.document_map[document]

    if not library_item_id then
        Logger.gui("sync.not_linked", { username = username, document = document }, "WARN")
        self:raise_error(self.error_not_linked)
    end

    -- Get ebook position
    local doc_key = string.format(self.doc_key, username, document)
    local percentage = redis:hget(doc_key, "percentage")
    if not percentage or percentage == null then
        return 200, { error = "No ebook progress to sync" }
    end

    -- Get audiobook metadata for duration
    local metadata, metadata_err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
    if not metadata or not metadata.media or not metadata.media.duration then
        return 200, { error = "Unable to fetch audiobook duration" }
    end

    local result, err = sync_to_audiobook(
        username,
        document,
        library_item_id,
        tonumber(percentage),
        metadata.media.duration
    )

    if not result then
        Logger.gui("sync.to_audio_failed", { username = username, document = document, error = err }, "ERROR")
        return 200, { error = err or "Sync failed" }
    end

    Logger.gui("sync.to_audio", { username = username, document = document, result = result })
    return 200, result
end

function SyncPositionsController:sync_from_audio()
    local username = ensure_authorized(self)
    local document = self.params.document
    if not is_valid_key_field(document) then
        self:raise_error(self.error_invalid_fields)
    end

    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local library_item_id = config.document_map and config.document_map[document]

    if not library_item_id then
        Logger.gui("sync.not_linked", { username = username, document = document }, "WARN")
        self:raise_error(self.error_not_linked)
    end

    -- Get audiobook progress
    local progress, progress_err = Audiobookshelf.pull_progress({
        username = username,
        document = document,
    })

    if not progress or not progress.currentTime then
        return 200, { error = "No audiobook progress to sync" }
    end

    -- Get duration from metadata if not in progress
    local duration = progress.duration
    if not duration then
        local metadata, metadata_err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
        if metadata and metadata.media and metadata.media.duration then
            duration = metadata.media.duration
        end
    end

    if not duration then
        return 200, { error = "Unable to determine audiobook duration" }
    end

    local result, err = sync_from_audiobook(
        redis,
        username,
        document,
        progress.currentTime,
        duration
    )

    if not result then
        Logger.gui("sync.from_audio_failed", { username = username, document = document, error = err }, "ERROR")
        return 200, { error = err or "Sync failed" }
    end

    Logger.gui("sync.from_audio", { username = username, document = document, result = result })
    return 200, result
end

function SyncPositionsController:auto_sync()
    local username = ensure_authorized(self)
    local document = self.params.document
    if not is_valid_key_field(document) then
        self:raise_error(self.error_invalid_fields)
    end

    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local library_item_id = config.document_map and config.document_map[document]

    if not library_item_id then
        Logger.gui("sync.not_linked", { username = username, document = document }, "WARN")
        self:raise_error(self.error_not_linked)
    end

    -- Get local ebook progress
    local doc_key = string.format(self.doc_key, username, document)
    local fields = redis:hmget(doc_key, "percentage", "timestamp")
    local ebook_percentage = tonumber(fields[1])
    local ebook_timestamp = tonumber(fields[2]) or 0

    -- Get remote audiobook progress
    local audio_progress, progress_err = Audiobookshelf.pull_progress({
        username = username,
        document = document,
    })
    local audio_timestamp = (audio_progress and audio_progress.timestamp) or 0

    -- Determine sync direction based on timestamps
    if ebook_timestamp > audio_timestamp then
        -- Ebook is newer, sync to audiobook
        if not ebook_percentage then
            return 200, { error = "No ebook progress to sync", suggested_direction = "from_audiobook" }
        end

        local metadata, metadata_err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
        if not metadata or not metadata.media or not metadata.media.duration then
            return 200, { error = "Unable to fetch audiobook duration" }
        end

        local result, err = sync_to_audiobook(
            username,
            document,
            library_item_id,
            ebook_percentage,
            metadata.media.duration
        )

        if not result then
            return 200, { error = err or "Sync to audiobook failed" }
        end

        Logger.gui("sync.auto_to_audio", { username = username, document = document, result = result })
        return 200, result
    else
        -- Audiobook is newer (or equal), sync from audiobook
        if not audio_progress or not audio_progress.currentTime then
            return 200, { error = "No audiobook progress to sync", suggested_direction = "to_audiobook" }
        end

        local duration = audio_progress.duration
        if not duration then
            local metadata, metadata_err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
            if metadata and metadata.media and metadata.media.duration then
                duration = metadata.media.duration
            end
        end

        if not duration then
            return 200, { error = "Unable to determine audiobook duration" }
        end

        local result, err = sync_from_audiobook(
            redis,
            username,
            document,
            audio_progress.currentTime,
            duration
        )

        if not result then
            return 200, { error = err or "Sync from audiobook failed" }
        end

        Logger.gui("sync.auto_from_audio", { username = username, document = document, result = result })
        return 200, result
    end
end

return SyncPositionsController
