local ok_http, http = pcall(require, "resty.http")
local cjson = require "cjson.safe"
local ProgressMapper = require "lib.progress_mapper"
local AudiobookshelfConfig = require "lib.audiobookshelf_config"

local Audiobookshelf = {
    default_timeout = 5000,
    cache_ttl = 5,
    _config_cache = nil,
    _cache_expires_at = 0,
}

local function now()
    if ngx and ngx.now then
        return ngx.now()
    end
    return os.time()
end

local function sanitize_base_url(url)
    if type(url) ~= "string" or url == "" then
        return nil
    end
    if url:sub(-1) == "/" then
        return url:sub(1, -2)
    end
    return url
end

local function coerce_timestamp(value)
    if type(value) == "number" then
        if value > 9999999999 then
            return math.floor(value / 1000)
        end
        return math.floor(value)
    end
    return nil
end

local function escape_uri(value)
    if value == nil then
        return ""
    end
    if ngx and ngx.escape_uri then
        return ngx.escape_uri(value)
    end
    return tostring(value):gsub("([^%w_.%-~])", function(char)
        return string.format("%%%02X", string.byte(char))
    end)
end

local function build_headers(credentials)
    local headers = {
        ["Accept"] = "application/json",
    }
    if credentials and credentials.api_key then
        headers["Authorization"] = "Bearer " .. credentials.api_key
    end
    if credentials and credentials.user_token then
        headers["X-ABS-User-Token"] = credentials.user_token
    end
    return headers
end

local function get_config()
    if Audiobookshelf._config_cache and Audiobookshelf._cache_expires_at > now() then
        return Audiobookshelf._config_cache
    end
    local config = select(1, AudiobookshelfConfig.load()) or {}
    Audiobookshelf._config_cache = config
    Audiobookshelf._cache_expires_at = now() + Audiobookshelf.cache_ttl
    return config
end

function Audiobookshelf.invalidate_cache()
    Audiobookshelf._config_cache = nil
    Audiobookshelf._cache_expires_at = 0
end

local function request(method, path, body, credentials)
    if not (ok_http and http) then
        return nil, "resty.http is not available"
    end
    local config = get_config()
    local base_url = sanitize_base_url(config.base_url)
    if not base_url then
        return nil, "Audiobookshelf base URL is not configured"
    end
    if type(path) ~= "string" or path == "" then
        return nil, "Invalid path"
    end
    local httpc = http.new()
    httpc:set_timeout(config.http_timeout or Audiobookshelf.default_timeout)
    local request_opts = {
        method = method,
        headers = build_headers(credentials),
    }
    if body then
        local encoded, err = cjson.encode(body)
        if err then
            return nil, err
        end
        request_opts.body = encoded
        request_opts.headers["Content-Type"] = "application/json"
    end
    local res, err = httpc:request_uri(base_url .. path, request_opts)
    if not res then
        return nil, err
    end
    if res.status < 200 or res.status >= 300 then
        return nil, string.format("Audiobookshelf %s %s failed with status %d: %s", method, path, res.status, res.body or "")
    end
    if res.body and res.body ~= "" then
        local decoded, decode_err = cjson.decode(res.body)
        if decode_err then
            return nil, decode_err
        end
        return decoded
    end
    return {}
end

local function credentials_for(username)
    local config = get_config()
    local user_map = type(config.user_map) == "table" and config.user_map or {}
    local entry = user_map[username]
    if type(entry) == "table" then
        return {
            api_key = entry.api_key or entry.apiKey or entry.token,
            user_id = entry.user_id or entry.userId or entry.id,
            device_name = entry.device or entry.device_name or entry.deviceName,
            user_token = entry.user_token,
        }
    elseif type(entry) == "string" then
        return { api_key = entry }
    end
    if config.api_key then
        return {
            api_key = config.api_key,
            user_id = config.user_id,
            device_name = config.device_name,
            user_token = config.user_token,
        }
    end
end

local function map_document_id(document_id)
    local config = get_config()
    local map = type(config.document_map) == "table" and config.document_map or {}
    if map[document_id] then
        return map[document_id]
    end
    return document_id
end

local function progress_path(library_item_id, credentials)
    if credentials and credentials.user_id and credentials.user_id ~= "" then
        return string.format("/api/users/%s/progress/%s", credentials.user_id, library_item_id)
    end
    return string.format("/api/me/progress/%s", library_item_id)
end

local function fetch_library_item(library_item_id, credentials)
    return request("GET", string.format("/api/items/%s?expanded=1&include=progress", library_item_id), nil, credentials)
end

local function fetch_media_progress(library_item_id, credentials)
    return request("GET", progress_path(library_item_id, credentials), nil, credentials)
end

local function patch_media_progress(library_item_id, payload, credentials)
    return request("PATCH", progress_path(library_item_id, credentials), payload, credentials)
end

local function should_overwrite(local_timestamp, remote_timestamp)
    if type(remote_timestamp) ~= "number" then
        return false
    end
    if type(local_timestamp) ~= "number" then
        return true
    end
    return remote_timestamp > local_timestamp
end

function Audiobookshelf.is_enabled()
    if not (ok_http and http) then
        return false
    end
    local config = get_config()
    if not config then
        return false
    end
    local base_url = sanitize_base_url(config.base_url)
    if not base_url then
        return false
    end
    local has_default_key = config.api_key and config.api_key ~= ""
    local has_user_map = type(config.user_map) == "table" and next(config.user_map) ~= nil
    return has_default_key or has_user_map
end

function Audiobookshelf.get_effective_config()
    return get_config()
end

function Audiobookshelf.push_progress(params)
    if not Audiobookshelf.is_enabled() then
        return true
    end
    if type(params) ~= "table" then
        return nil, "Invalid parameters"
    end
    local credentials = credentials_for(params.username)
    if not credentials or not credentials.api_key then
        return nil, "Missing Audiobookshelf credentials"
    end
    local library_item_id = map_document_id(params.document)
    if not library_item_id then
        return nil, "Unable to resolve Audiobookshelf library item id"
    end
    local item, item_err = fetch_library_item(library_item_id, credentials)
    if not item then
        return nil, item_err
    end
    local timeline = ProgressMapper.build_timeline(item)
    local media_progress, progress_err = fetch_media_progress(library_item_id, credentials)
    if not media_progress then
        return nil, progress_err
    end
    local current_time, total_duration, ebook_location = ProgressMapper.ebook_to_audio(
        params.percentage,
        params.progress,
        timeline
    )
    local duration = total_duration or tonumber(media_progress.duration)
        or (item and item.media and tonumber(item.media.duration))
    local payload = {
        ebookProgress = params.percentage,
        ebookLocation = ebook_location,
        duration = duration,
        progress = params.percentage,
    }
    if current_time then
        payload.currentTime = current_time
    end
    if params.percentage then
        payload.progress = params.percentage
    end
    local extra_payload = ProgressMapper.build_extra_payload(
        media_progress.extraData,
        {
            username = params.username,
            documentId = params.document,
            rawProgress = params.progress,
            percentage = params.percentage,
            timestamp = params.timestamp,
            mappedAudioTime = current_time,
            lastSyncSource = "koreader",
        }
    )
    payload.extraData = extra_payload
    local response, err = patch_media_progress(library_item_id, payload, credentials)
    if not response then
        return nil, err
    end
    return true
end

function Audiobookshelf.pull_progress(params)
    if not Audiobookshelf.is_enabled() then
        return nil
    end
    if type(params) ~= "table" then
        return nil, "Invalid parameters"
    end
    local credentials = credentials_for(params.username)
    if not credentials or not credentials.api_key then
        return nil, "Missing Audiobookshelf credentials"
    end
    local library_item_id = map_document_id(params.document)
    if not library_item_id then
        return nil, "Unable to resolve Audiobookshelf library item id"
    end
    local item, item_err = fetch_library_item(library_item_id, credentials)
    if not item then
        return nil, item_err
    end
    local media_progress, progress_err = fetch_media_progress(library_item_id, credentials)
    if not media_progress then
        return nil, progress_err
    end
    local timeline = ProgressMapper.build_timeline(item)
    local remote_extra = type(media_progress.extraData) == "table" and media_progress.extraData or {}
    local koreader_extra = type(remote_extra.koreader) == "table" and remote_extra.koreader or {}
    local remote_timestamp = coerce_timestamp(media_progress.updatedAt or media_progress.lastUpdate)
    local raw_progress = koreader_extra.rawProgress or media_progress.ebookLocation
    local percentage = media_progress.ebookProgress
    local progress_string = raw_progress
    if not percentage and media_progress.currentTime then
        local derived_percentage, encoded = ProgressMapper.audio_to_ebook(
            media_progress.currentTime,
            timeline,
            raw_progress
        )
        percentage = percentage or derived_percentage
        if encoded then
            progress_string = encoded
        end
    end
    if not percentage and media_progress.duration and media_progress.currentTime then
        local duration = tonumber(media_progress.duration)
        if duration and duration > 0 then
            percentage = (tonumber(media_progress.currentTime) or 0) / duration
        end
    end
    if progress_string == nil and media_progress.ebookLocation then
        progress_string = media_progress.ebookLocation
    end
    local device_name = credentials.device_name or "audiobookshelf"
    if percentage then
        local extra_payload = ProgressMapper.build_extra_payload(
            remote_extra,
            {
                username = params.username,
                documentId = params.document,
                rawProgress = progress_string,
                percentage = percentage,
                timestamp = remote_timestamp,
                mappedAudioTime = media_progress.currentTime,
                lastSyncSource = "audiobookshelf",
            }
        )
        media_progress.extraData = extra_payload
    end
    return {
        document = params.document,
        percentage = percentage,
        progress = progress_string,
        device = device_name,
        timestamp = remote_timestamp,
        extraData = media_progress.extraData,
        currentTime = media_progress.currentTime,
        libraryItemId = library_item_id,
        item = item,
    }
end

function Audiobookshelf.merge_remote_progress(redis, redis_key, local_timestamp, params)
    local payload, err = Audiobookshelf.pull_progress(params)
    if not payload then
        return nil, err
    end
    if not payload.timestamp then
        return nil
    end
    if not should_overwrite(local_timestamp, payload.timestamp) then
        return nil
    end
    local fields = {}
    if payload.percentage then
        fields["percentage"] = payload.percentage
    end
    if payload.progress then
        fields["progress"] = payload.progress
    end
    fields["device"] = payload.device
    fields["timestamp"] = payload.timestamp
    local ok, err = redis:hmset(redis_key, fields)
    if not ok then
        return nil, err
    end
    return {
        percentage = payload.percentage,
        progress = payload.progress,
        device = payload.device,
        timestamp = payload.timestamp,
    }
end

local function summarize_item(item)
    if type(item) ~= "table" then
        return nil
    end
    local media = item.media or {}
    local metadata = media.metadata or {}
    return metadata.title or media.title or item.title or item.name
end

function Audiobookshelf.fetch_library_item_for(username, library_item_id)
    local credentials = credentials_for(username)
    if not credentials or not credentials.api_key then
        return nil, "Missing Audiobookshelf credentials"
    end
    return fetch_library_item(library_item_id, credentials)
end

function Audiobookshelf.fetch_libraries(username)
    local credentials = credentials_for(username)
    if not credentials or not credentials.api_key then
        return nil, "Missing Audiobookshelf credentials"
    end
    local response, err = request("GET", "/api/libraries", nil, credentials)
    if not response then
        return nil, err
    end
    return response
end

function Audiobookshelf.search_library(username, library_id, query, limit)
    if not library_id or library_id == "" then
        return nil, "Library id is required"
    end
    if type(query) ~= "string" or query == "" then
        return nil, "Query is required"
    end
    local credentials = credentials_for(username)
    if not credentials or not credentials.api_key then
        return nil, "Missing Audiobookshelf credentials"
    end
    local path = string.format(
        "/api/libraries/%s/search?q=%s&limit=%d",
        escape_uri(library_id),
        escape_uri(query),
        tonumber(limit) or 12
    )
    local response, err = request("GET", path, nil, credentials)
    if not response then
        return nil, err
    end
    return response
end

function Audiobookshelf.extract_item_summary(payload)
    local item = payload and payload.item
    return summarize_item(item)
end

return Audiobookshelf
