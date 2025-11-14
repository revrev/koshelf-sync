local cjson = require "cjson.safe"
local Redis = require "db.redis"

local AudiobookshelfConfig = {
    redis_key = "config:audiobookshelf",
}

local null = ngx and ngx.null

local function decode_json(value)
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

local function trim_string(value)
    if type(value) ~= "string" then
        return value
    end
    return (value:match("^%s*(.-)%s*$"))
end

local function coerce_timeout(value)
    if value == nil or value == "" then
        return nil
    end
    local numeric = tonumber(value)
    if not numeric or numeric <= 0 then
        return nil
    end
    return math.floor(numeric)
end

local function base_config()
    return {
        base_url = trim_string(os.getenv("AUDIOBOOKSHELF_BASE_URL")),
        api_key = trim_string(os.getenv("AUDIOBOOKSHELF_API_KEY")),
        user_id = trim_string(os.getenv("AUDIOBOOKSHELF_USER_ID")),
        user_token = trim_string(os.getenv("AUDIOBOOKSHELF_USER_TOKEN")),
        device_name = trim_string(os.getenv("AUDIOBOOKSHELF_DEVICE_NAME")),
        http_timeout = coerce_timeout(os.getenv("AUDIOBOOKSHELF_HTTP_TIMEOUT")) or 5000,
        user_map = decode_json(os.getenv("AUDIOBOOKSHELF_USER_MAP")) or {},
        document_map = decode_json(os.getenv("AUDIOBOOKSHELF_DOCUMENT_MAP")) or {},
    }
end

local function load_overrides(redis)
    if not redis then
        return {}
    end
    local raw, err = redis:get(AudiobookshelfConfig.redis_key)
    if not raw or raw == null then
        return {}
    end
    if err then
        return {}
    end
    local decoded, decode_err = cjson.decode(raw)
    if decode_err or type(decoded) ~= "table" then
        return {}
    end
    if decoded.user_map then
        decoded.user_map = decode_json(decoded.user_map) or {}
    end
    if decoded.document_map then
        decoded.document_map = decode_json(decoded.document_map) or {}
    end
    if decoded.http_timeout then
        decoded.http_timeout = coerce_timeout(decoded.http_timeout)
    end
    return decoded
end

local function merge_config(base, overrides)
    local merged = {}
    for key, value in pairs(base or {}) do
        merged[key] = value
    end
    for key, value in pairs(overrides or {}) do
        if value ~= nil then
            merged[key] = value
        end
    end
    if not merged.http_timeout then
        merged.http_timeout = 5000
    end
    if type(merged.user_map) ~= "table" then
        merged.user_map = {}
    end
    if type(merged.document_map) ~= "table" then
        merged.document_map = {}
    end
    return merged
end

local function open_redis()
    local ok, redis = pcall(function()
        return Redis:new()
    end)
    if ok then
        return redis
    end
end

function AudiobookshelfConfig.load(existing_redis)
    local redis = existing_redis or open_redis()
    local config = base_config()
    local overrides = load_overrides(redis)
    local merged = merge_config(config, overrides)
    return merged, overrides
end

local function sanitize_update_value(value)
    if value == null then
        return nil
    end
    if type(value) == "string" then
        value = trim_string(value)
        if value == "" then
            return nil
        end
    end
    return value
end

local function sanitize_update(payload)
    local update = {}
    if type(payload) ~= "table" then
        return update
    end
    if payload.base_url ~= nil then
        update.base_url = sanitize_update_value(payload.base_url)
    end
    if payload.api_key ~= nil then
        update.api_key = sanitize_update_value(payload.api_key)
    end
    if payload.user_id ~= nil then
        update.user_id = sanitize_update_value(payload.user_id)
    end
    if payload.user_token ~= nil then
        update.user_token = sanitize_update_value(payload.user_token)
    end
    if payload.device_name ~= nil then
        update.device_name = sanitize_update_value(payload.device_name)
    end
    if payload.http_timeout ~= nil then
        update.http_timeout = coerce_timeout(payload.http_timeout)
    end
    if payload.user_map ~= nil then
        update.user_map = decode_json(payload.user_map) or (type(payload.user_map) == "table" and payload.user_map) or {}
    end
    if payload.document_map ~= nil then
        update.document_map = decode_json(payload.document_map) or (type(payload.document_map) == "table" and payload.document_map) or {}
    end
    return update
end

function AudiobookshelfConfig.save(payload)
    local redis = open_redis()
    if not redis then
        return nil, "Redis unavailable"
    end
    local overrides = load_overrides(redis)
    local update = sanitize_update(payload)
    for key, value in pairs(update) do
        overrides[key] = value
    end
    local to_store = {}
    for key, value in pairs(overrides) do
        if value ~= nil then
            to_store[key] = value
        end
    end
    if next(to_store) then
        local encoded, err = cjson.encode(to_store)
        if err then
            return nil, err
        end
        local ok, set_err = redis:set(AudiobookshelfConfig.redis_key, encoded)
        if not ok then
            return nil, set_err or "Failed to persist configuration"
        end
    else
        redis:del(AudiobookshelfConfig.redis_key)
    end
    local merged = merge_config(base_config(), to_store)
    return merged
end

function AudiobookshelfConfig.resolve_document(document_id, config)
    local effective = config or select(1, AudiobookshelfConfig.load())
    local map = effective and effective.document_map
    if type(map) == "table" then
        return map[document_id]
    end
end

return AudiobookshelfConfig
