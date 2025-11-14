local cjson = require "cjson.safe"
local Redis = require "db.redis"
local Audiobookshelf = require "lib.audiobookshelf"
local AudiobookshelfConfig = require "lib.audiobookshelf_config"
local Logger = require "lib.logger"

local AudiobookshelfAdminController = {
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

local function table_size(value)
    if type(value) ~= "table" then
        return 0
    end
    local count = 0
    for _ in pairs(value) do
        count = count + 1
    end
    return count
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

function AudiobookshelfAdminController:getRedis()
    local redis = open_redis()
    if not redis then
        self:raise_error(self.error_no_redis)
    end
    return redis
end

function AudiobookshelfAdminController:authorize()
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

local function decode_optional_json(value)
    if value == nil or value == null then
        return nil
    end
    if type(value) == "table" then
        return value
    end
    if type(value) ~= "string" or value == "" then
        return nil
    end
    local decoded, err = cjson.decode(value)
    if err then
        return nil
    end
    if type(decoded) == "table" then
        return decoded
    end
end

function AudiobookshelfAdminController:get_config()
    local username = ensure_authorized(self)
    local config = select(1, AudiobookshelfConfig.load())
    local enabled = Audiobookshelf.is_enabled()
    Logger.gui("config.fetch", {
        username = username,
        enabled = enabled,
    })
    return 200, {
        config = config,
        audiobookshelf = {
            enabled = enabled,
        },
    }
end

local function merge_document_map(base_map, updates)
    local map = {}
    if type(base_map) == "table" then
        for key, value in pairs(base_map) do
            map[key] = value
        end
    end
    if type(updates) == "table" then
        for key, value in pairs(updates) do
            if value == nil or value == null or value == "" then
                map[key] = nil
            else
                map[key] = value
            end
        end
    end
    return map
end

function AudiobookshelfAdminController:update_config()
    local username = ensure_authorized(self)
    local body = self.request.body or {}
    if type(body) ~= "table" then
        self:raise_error(self.error_invalid_fields)
    end
    if body.user_map_text and not body.user_map then
        body.user_map = decode_optional_json(body.user_map_text)
    end
    if body.document_map_text and not body.document_map then
        body.document_map = decode_optional_json(body.document_map_text)
    end
    if body.document_map_patch then
        local config = select(1, AudiobookshelfConfig.load()) or {}
        body.document_map = merge_document_map(config.document_map, body.document_map_patch)
    end
    local updated, err = AudiobookshelfConfig.save(body)
    if not updated then
        Logger.gui("config.update_failed", {
            username = username,
            error = err,
        }, "ERROR")
        return 200, { error = err or "Failed to update configuration" }
    end
    Audiobookshelf.invalidate_cache()
    Logger.gui("config.updated", {
        username = username,
        changed = {
            base_url = body.base_url ~= nil,
            api_key = body.api_key ~= nil,
            user_id = body.user_id ~= nil,
            user_token = body.user_token ~= nil,
            device_name = body.device_name ~= nil,
            http_timeout = body.http_timeout ~= nil,
            user_map_entries = table_size(body.user_map),
            document_map_entries = table_size(body.document_map),
            document_map_patch = table_size(body.document_map_patch),
        },
    })
    return 200, {
        config = updated,
        audiobookshelf = {
            enabled = Audiobookshelf.is_enabled(),
        },
    }
end

local function scan_documents(redis)
    local cursor = "0"
    local documents = {}
    repeat
        local reply, err = redis:scan(cursor, "match", "user:*:document:*", "count", 100)
        if not reply then
            return nil, err
        end
        cursor = reply[1]
        local keys = reply[2] or {}
        for _, key in ipairs(keys) do
            local username, document = key:match("^user:([^:]+):document:([^:]+)$")
            if username and document then
                table.insert(documents, { username = username, document = document, key = key })
            end
        end
    until cursor == "0"
    table.sort(documents, function(a, b)
        if a.username == b.username then
            return a.document < b.document
        end
        return a.username < b.username
    end)
    return documents
end

local function build_document_entry(redis, entry, config)
    local fields = redis:hmget(entry.key, "percentage", "progress", "device", "device_id", "timestamp")
    local local_percentage = parse_number(fields[1])
    local local_progress = parse_string(fields[2])
    local local_device = parse_string(fields[3])
    local local_device_id = parse_string(fields[4])
    local local_timestamp = parse_number(fields[5])
    local mapping = AudiobookshelfConfig.resolve_document(entry.document, config)
    local result = {
        username = entry.username,
        document = entry.document,
        libraryItemId = mapping,
        localProgress = {
            percentage = local_percentage,
            progress = local_progress,
            device = local_device,
            device_id = local_device_id,
            timestamp = local_timestamp,
        },
    }
    return result
end

local function describe_remote_payload(payload)
    if not payload then
        return nil
    end
    return {
        percentage = payload.percentage,
        progress = payload.progress,
        device = payload.device,
        timestamp = payload.timestamp,
        currentTime = payload.currentTime,
        libraryItemId = payload.libraryItemId,
        title = Audiobookshelf.extract_item_summary(payload),
        extraData = payload.extraData,
    }
end

function AudiobookshelfAdminController:get_status()
    local username = ensure_authorized(self)
    local redis = self:getRedis()
    local config = select(1, AudiobookshelfConfig.load(redis)) or {}
    local docs, err = scan_documents(redis)
    if not docs then
        Logger.gui("status.failed", { username = username, error = err }, "ERROR")
        return 200, { error = err or "Unable to list documents" }
    end
    local response_docs = {}
    for _, entry in ipairs(docs) do
        local row = build_document_entry(redis, entry, config)
        if row.libraryItemId and Audiobookshelf.is_enabled() then
            local payload, remote_err = Audiobookshelf.pull_progress({
                username = entry.username,
                document = entry.document,
            })
            if payload then
                row.remote = describe_remote_payload(payload)
            elseif remote_err then
                row.remote_error = remote_err
            end
        elseif Audiobookshelf.is_enabled() then
            row.remote_error = "No Audiobookshelf mapping configured"
        end
        table.insert(response_docs, row)
    end
    local response = {
        documents = response_docs,
        config = config,
        audiobookshelf = {
            enabled = Audiobookshelf.is_enabled(),
            base_url = config.base_url,
        },
        authorizedUser = username,
    }
    Logger.gui("status.fetch", {
        username = username,
        documents = #response_docs,
        audiobookshelf_enabled = response.audiobookshelf.enabled,
    })
    return 200, response
end

function AudiobookshelfAdminController:list_libraries()
    local username = ensure_authorized(self)
    local libraries, err = Audiobookshelf.fetch_libraries(username)
    if not libraries then
        Logger.gui("libraries.fetch_failed", { username = username, error = err }, "ERROR")
        return 200, { error = err or "Failed to fetch libraries" }
    end
    local list = libraries.libraries or libraries
    Logger.gui("libraries.fetch", { username = username, count = table_size(list) })
    return 200, { libraries = list }
end

function AudiobookshelfAdminController:search_library()
    local username = ensure_authorized(self)
    local library_id = self.params.library_id
    if not is_valid_key_field(library_id) then
        self:raise_error(self.error_invalid_fields)
    end
    local args = ngx.req.get_uri_args() or {}
    local query = args.q or args.query
    local limit = args.limit
    local results, err = Audiobookshelf.search_library(username, library_id, query, limit)
    if not results then
        Logger.gui("library.search_failed", {
            username = username,
            library_id = library_id,
            query = query,
            error = err,
        }, "ERROR")
        return 200, { error = err or "Search failed" }
    end
    Logger.gui("library.search", {
        username = username,
        library_id = library_id,
        query = query,
        limit = limit,
        results = table_size(results.items or results),
    })
    return 200, { results = results }
end

function AudiobookshelfAdminController:get_library_item()
    local username = ensure_authorized(self)
    local library_item_id = self.params.library_item_id
    if not is_valid_key_field(library_item_id) then
        self:raise_error(self.error_invalid_fields)
    end
    local item, err = Audiobookshelf.fetch_library_item_for(username, library_item_id)
    if not item then
        Logger.gui("library.item_failed", { username = username, library_item_id = library_item_id, error = err }, "ERROR")
        return 200, { error = err or "Unable to fetch item" }
    end
    Logger.gui("library.item", { username = username, library_item_id = library_item_id })
    return 200, { item = item }
end

return AudiobookshelfAdminController
