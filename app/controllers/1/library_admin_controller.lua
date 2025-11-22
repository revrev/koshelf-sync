local cjson = require "cjson.safe"
local Redis = require "db.redis"
local Audiobookshelf = require "lib.audiobookshelf"
local AudiobookshelfConfig = require "lib.audiobookshelf_config"
local Logger = require "lib.logger"

local LibraryAdminController = {
    user_key = "user:%s:key",
    doc_key = "user:%s:document:%s",
    error_no_redis = 1000,
    error_unauthorized_user = 2001,
    error_invalid_fields = 2003,
}

local null = ngx and ngx.null

local function is_valid_field(field)
    return type(field) == "string" and string.len(field) > 0
end

local function is_valid_key_field(field)
    return is_valid_field(field) and not string.find(field, ":")
end

local function parse_number(value)
    if value == null or value == nil then
        return nil
    end
    local numeric = tonumber(value)
    if numeric then
        return numeric
    end
end

local function parse_string(value)
    if value == null or value == nil then
        return nil
    end
    if type(value) == "string" then
        return value
    end
end

local function open_redis()
    local redis = Redis:new()
    if not redis then
        return nil
    end
    return redis
end

function LibraryAdminController:getRedis()
    local redis = open_redis()
    if not redis then
        self:raise_error(self.error_no_redis)
    end
    return redis
end

function LibraryAdminController:authorize()
    local redis = self:getRedis()
    local auth_user = self.request.headers['x-auth-user']
    local auth_key = self.request.headers['x-auth-key']
    if is_valid_field(auth_key) and is_valid_key_field(auth_user) then
        local key = redis:get(string.format(self.user_key, auth_user))
        if key == auth_key then
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

local function scan_user_documents(redis, username)
    local cursor = "0"
    local documents = {}
    local pattern = string.format("user:%s:document:*", username)
    repeat
        local reply, err = redis:scan(cursor, "match", pattern, "count", 100)
        if not reply then
            return nil, err
        end
        cursor = reply[1]
        local keys = reply[2] or {}
        for _, key in ipairs(keys) do
            local document = key:match(string.format("^user:%s:document:([^:]+)$", username))
            if document then
                table.insert(documents, { username = username, document = document, key = key })
            end
        end
    until cursor == "0"
    table.sort(documents, function(a, b)
        return a.document < b.document
    end)
    return documents
end

local function fetch_local_progress(redis, entry)
    local fields = redis:hmget(entry.key, "percentage", "progress", "device", "device_id", "timestamp")
    return {
        percentage = parse_number(fields[1]),
        progress = parse_string(fields[2]),
        device = parse_string(fields[3]),
        device_id = parse_string(fields[4]),
        timestamp = parse_number(fields[5]),
    }
end

local function fetch_remote_progress(username, document, library_item_id)
    if not Audiobookshelf.is_enabled() or not library_item_id then
        return nil
    end
    local payload, remote_err = Audiobookshelf.pull_progress({
        username = username,
        document = document,
    })
    if not payload then
        return nil, remote_err
    end
    return {
        percentage = payload.percentage,
        progress = payload.progress,
        device = payload.device,
        timestamp = payload.timestamp,
        currentTime = payload.currentTime,
        libraryItemId = payload.libraryItemId,
        extraData = payload.extraData,
    }
end

local function extract_metadata(item)
    if type(item) ~= "table" then
        return {}
    end
    local media = item.media or {}
    local meta = media.metadata or {}
    return {
        title = meta.title or item.title or item.name,
        author = meta.author or (meta.authors and meta.authors[1] and meta.authors[1].name) or meta.authors,
        duration = media.duration,
        coverPath = media.coverPath,
        mediaType = item.mediaType or media.mediaType,
        description = meta.description,
        publishYear = meta.publishYear,
        tags = meta.tags,
    }
end

local function fetch_metadata_for(username, library_item_id, cache)
    if not library_item_id then
        return nil
    end
    if cache[library_item_id] ~= nil then
        return cache[library_item_id]
    end
    local item, err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
    if not item then
        cache[library_item_id] = nil
        return nil, err
    end
    local metadata = extract_metadata(item)
    metadata.raw = item
    cache[library_item_id] = metadata
    return metadata
end

local function build_entry(username, entry, config, metadata_cache)
    local redis = entry.redis
    local local_progress = fetch_local_progress(redis, entry)
    local library_item_id = AudiobookshelfConfig.resolve_document(entry.document, config)
    local remote_progress, remote_err = fetch_remote_progress(username, entry.document, library_item_id)
    local metadata, metadata_err = fetch_metadata_for(username, library_item_id, metadata_cache)
    local last_updated = local_progress.timestamp or 0
    if remote_progress and remote_progress.timestamp and remote_progress.timestamp > last_updated then
        last_updated = remote_progress.timestamp
    end

    return {
        username = username,
        document = entry.document,
        libraryItemId = library_item_id,
        localProgress = local_progress,
        remoteProgress = remote_progress,
        remoteError = remote_err,
        metadataError = metadata_err,
        metadata = metadata,
        coverUrl = library_item_id and string.format("/admin/audiobookshelf/cover?library_item_id=%s&format=webp&width=400", library_item_id) or nil,
        lastUpdated = last_updated,
    }
end

local function compute_progress_percentages(item)
    local ebook_progress = item.localProgress and item.localProgress.percentage or nil
    local audio_progress = nil
    if item.remoteProgress then
        audio_progress = item.remoteProgress.percentage
        if not audio_progress and item.metadata and item.metadata.duration and item.remoteProgress.currentTime then
            local duration = tonumber(item.metadata.duration)
            if duration and duration > 0 then
                audio_progress = (tonumber(item.remoteProgress.currentTime) or 0) / duration
            end
        end
    end
    return ebook_progress, audio_progress
end

local function to_card_payload(item)
    local ebook_progress, audio_progress = compute_progress_percentages(item)
    local meta = item.metadata or {}
    return {
        document = item.document,
        libraryItemId = item.libraryItemId,
        title = meta.title,
        author = meta.author,
        duration = meta.duration,
        coverPath = meta.coverPath,
        coverUrl = item.coverUrl,
        mediaType = meta.mediaType,
        ebookProgress = ebook_progress,
        audioProgress = audio_progress,
        lastUpdated = item.lastUpdated,
    }
end

local function empty_array()
    return setmetatable({}, cjson.array_mt)
end

local function compute_shelves(items)
    local shelves = {
        continueListening = empty_array(),
        continueReading = empty_array(),
        recentlyLinked = empty_array(),
        unlinked = empty_array(),
        all = empty_array(),
    }
    for _, item in ipairs(items) do
        local card = to_card_payload(item)
        table.insert(shelves.all, card)
        if not card.libraryItemId then
            table.insert(shelves.unlinked, card)
        end
        if card.audioProgress and card.audioProgress < 0.98 then
            table.insert(shelves.continueListening, card)
        end
        if card.ebookProgress and card.ebookProgress < 0.98 then
            table.insert(shelves.continueReading, card)
        end
        if card.lastUpdated and card.libraryItemId then
            table.insert(shelves.recentlyLinked, card)
        end
    end
    table.sort(shelves.recentlyLinked, function(a, b)
        return (a.lastUpdated or 0) > (b.lastUpdated or 0)
    end)
    table.sort(shelves.unlinked, function(a, b)
        return (a.lastUpdated or 0) > (b.lastUpdated or 0)
    end)
    if #shelves.recentlyLinked > 12 then
        while #shelves.recentlyLinked > 12 do
            table.remove(shelves.recentlyLinked)
        end
    end
    return shelves
end

function LibraryAdminController:list()
    local username = ensure_authorized(self)
    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local docs, err = scan_user_documents(redis, username)
    if not docs then
        Logger.gui("library.scan_failed", { username = username, error = err }, "ERROR")
        return 200, { error = err or "Unable to list library" }
    end

    local metadata_cache = {}
    local items = {}
    for _, entry in ipairs(docs) do
        entry.redis = redis
        local item = build_entry(username, entry, config, metadata_cache)
        table.insert(items, item)
    end

    -- include mapped documents without local progress
    for document_id, library_item_id in pairs(config.document_map or {}) do
        local already = false
        for _, existing in ipairs(items) do
            if existing.document == document_id then
                already = true
                break
            end
        end
        if not already and is_valid_key_field(document_id) then
            local stub_entry = {
                username = username,
                document = document_id,
                key = string.format("user:%s:document:%s", username, document_id),
                redis = redis,
            }
            local item = build_entry(username, stub_entry, config, metadata_cache)
            item.libraryItemId = library_item_id
            table.insert(items, item)
        end
    end

    local shelves = compute_shelves(items)
    Logger.gui("library.list", { username = username, count = #items })
    return 200, { shelves = shelves, items = items }
end

local function find_document(config, document)
    local map = config.document_map or {}
    return map[document]
end

local function update_document_mapping(document, library_item_id)
    local config = select(1, AudiobookshelfConfig.load()) or {}
    local new_map = {}
    if type(config.document_map) == "table" then
        for key, value in pairs(config.document_map) do
            new_map[key] = value
        end
    end
    new_map[document] = library_item_id
    return AudiobookshelfConfig.save({ document_map = new_map })
end

function LibraryAdminController:get_item()
    local username = ensure_authorized(self)
    local document = self.params.document
    if not is_valid_key_field(document) then
        self:raise_error(self.error_invalid_fields)
    end
    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local metadata_cache = {}
    local entry = {
        username = username,
        document = document,
        key = string.format(self.doc_key, username, document),
        redis = redis,
    }
    local item = build_entry(username, entry, config, metadata_cache)
    if not item.libraryItemId then
        item.libraryItemId = find_document(config, document)
    end
    Logger.gui("library.item", { username = username, document = document, libraryItemId = item.libraryItemId })
    return 200, { item = item }
end

function LibraryAdminController:link_item()
    local username = ensure_authorized(self)
    local document = self.params.document
    if not is_valid_key_field(document) then
        self:raise_error(self.error_invalid_fields)
    end
    local payload = self.request.body or {}
    local library_item_id = payload.library_item_id
    if library_item_id ~= nil and not is_valid_key_field(library_item_id) then
        self:raise_error(self.error_invalid_fields)
    end

    local updated, err = update_document_mapping(document, library_item_id)
    if not updated then
        Logger.gui("library.link_failed", { username = username, document = document, error = err }, "ERROR")
        return 200, { error = err or "Failed to update mapping" }
    end
    Audiobookshelf.invalidate_cache()
    Logger.gui("library.link", { username = username, document = document, library_item_id = library_item_id })
    return 200, { document = document, library_item_id = library_item_id }
end

return LibraryAdminController
