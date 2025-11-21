local Redis = require "db.redis"

local Admin = {
    redis_key = "config:admin_username",
}

local null = ngx and ngx.null

local function open_redis(existing)
    if existing then
        return existing
    end
    local ok, redis = pcall(function()
        return Redis:new()
    end)
    if ok then
        return redis
    end
end

function Admin.get(redis)
    local conn = open_redis(redis)
    if not conn then
        return nil
    end
    local value = conn:get(Admin.redis_key)
    if not value or value == null then
        return nil
    end
    return value
end

function Admin.set(username, redis)
    if not username or username == "" then
        return false
    end
    local conn = open_redis(redis)
    if not conn then
        return false
    end
    conn:set(Admin.redis_key, username)
    return true
end

function Admin.is_admin(username, redis)
    if not username then
        return false
    end
    local current = Admin.get(redis)
    if not current then
        return false
    end
    return current == username
end

return Admin
