local cjson = require "cjson"
local Redis = require "db.redis"
local Logger = require "lib.logger"
local Admin = require "lib.admin"

local AccountsAdminController = {
    user_key = "user:%s:key",
    doc_pattern = "user:%s:document:*",
    error_no_redis = 1000,
    error_unauthorized_user = 2001,
    error_invalid_fields = 2003,
}

local null = ngx and ngx.null

local function empty_array()
    return setmetatable({}, cjson.array_mt)
end

local function is_valid_field(field)
    return type(field) == "string" and field:match("%S")
end

local function is_valid_key_field(field)
    return is_valid_field(field) and not field:find(":")
end

local function normalize_secret(secret)
    if type(secret) ~= "string" then
        return nil
    end
    local trimmed = secret:match("^%s*(.-)%s*$")
    if trimmed == "" then
        return nil
    end
    if trimmed:match("^[a-fA-F0-9]{32}$") then
        return trimmed:lower()
    end
    if ngx and ngx.md5 then
        return ngx.md5(trimmed)
    end
    return nil
end

function AccountsAdminController:getRedis()
    local redis = Redis:new()
    if not redis then
        Logger.gui("accounts.redis_unavailable", nil, "ERROR")
        self:raise_error(self.error_no_redis)
    end
    return redis
end

function AccountsAdminController:authorize()
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
        Logger.gui("accounts.auth_failed", nil, "WARN")
        self:raise_error(self.error_unauthorized_user)
    end
    return username
end

local function scan_keys(redis, pattern)
    local cursor = "0"
    local keys = {}
    repeat
        local reply, err = redis:scan(cursor, "match", pattern, "count", 200)
        if not reply then
            return nil, err
        end
        cursor = reply[1]
        local chunk = reply[2] or {}
        for _, key in ipairs(chunk) do
            table.insert(keys, key)
        end
    until cursor == "0"
    return keys
end

local function collect_accounts(redis)
    local user_keys, err = scan_keys(redis, "user:*:key")
    if not user_keys then
        return nil, err
    end
    table.sort(user_keys)
    local accounts = {}
    local doc_counts = {}
    local doc_keys, doc_err = scan_keys(redis, "user:*:document:*")
    if doc_keys then
        for _, key in ipairs(doc_keys) do
            local username = key:match("^user:([^:]+):document:")
            if username then
                doc_counts[username] = (doc_counts[username] or 0) + 1
            end
        end
    else
        Logger.gui("accounts.scan_documents_failed", { error = doc_err }, "WARN")
    end
    for _, key in ipairs(user_keys) do
        local username = key:match("^user:([^:]+):key$")
        if username then
            table.insert(accounts, {
                username = username,
                documents = doc_counts[username] or 0,
            })
        end
    end
    if #accounts == 0 then
        return empty_array()
    end
    return accounts
end

local function delete_document_keys(redis, username)
    local deleted = 0
    local cursor = "0"
    local pattern = string.format("user:%s:document:*", username)
    repeat
        local reply, err = redis:scan(cursor, "match", pattern, "count", 200)
        if not reply then
            return deleted, err
        end
        cursor = reply[1]
        local batch = reply[2] or {}
        if #batch > 0 then
            redis:del(unpack(batch))
            deleted = deleted + #batch
        end
    until cursor == "0"
    return deleted
end

local function bootstrap_allowed(accounts)
    return type(accounts) == "table" and #accounts == 0
end

function AccountsAdminController:list_accounts()
    local redis = self:getRedis()
    local accounts, err = collect_accounts(redis)
    if not accounts then
        Logger.gui("accounts.list_failed", { error = err }, "ERROR")
        return 200, { error = err or "Unable to list accounts" }
    end
    local bootstrap = bootstrap_allowed(accounts)
    local actor
    if not bootstrap then
        actor = ensure_authorized(self)
    end
    Logger.gui("accounts.list", { actor = actor, count = #accounts })
    local admin_username = Admin.get(redis)
    local actor_is_admin = actor and admin_username and actor == admin_username or false
    return 200, {
        accounts = #accounts == 0 and empty_array() or accounts,
        admin = admin_username,
        actor_is_admin = actor_is_admin,
        bootstrap_allowed = bootstrap,
        can_create = bootstrap or actor_is_admin,
    }
end

function AccountsAdminController:create_account()
    local redis = self:getRedis()
    local accounts, err = collect_accounts(redis)
    if not accounts then
        Logger.gui("accounts.create_failed", { error = err }, "ERROR")
        return 200, { error = err or "Unable to inspect existing accounts" }
    end
    local bootstrap = bootstrap_allowed(accounts)
    local actor
    if not bootstrap then
        actor = ensure_authorized(self)
    end

    local body = self.request.body or {}
    local username = body.username
    local password = normalize_secret(body.password)
    if not is_valid_key_field(username) or not password then
        self:raise_error(self.error_invalid_fields)
    end

    local admin_username = Admin.get(redis)
    if not bootstrap then
        if admin_username and actor ~= admin_username then
            return 403, { error = "Only the admin user may create additional accounts" }
        end
        if not admin_username and actor then
            Admin.set(actor, redis)
            admin_username = actor
        end
    end

    local key = string.format(self.user_key, username)
    local existing = redis:get(key)
    if existing and existing ~= null then
        return 200, { error = "User already exists" }
    end
    local ok, write_err = redis:set(key, password)
    if not ok then
        Logger.gui("accounts.create_failed", { actor = actor, username = username, error = write_err }, "ERROR")
        return 200, { error = "Failed to create user" }
    end

    if bootstrap then
        Admin.set(username, redis)
        Logger.gui("accounts.bootstrap_created", { username = username })
    else
        Logger.gui("accounts.created", { actor = actor, username = username })
    end

    return 201, {
        username = username,
        admin = Admin.get(redis),
        bootstrap = bootstrap,
    }
end

function AccountsAdminController:update_password()
    local actor = ensure_authorized(self)
    local username = self.params.username
    if not is_valid_key_field(username) then
        self:raise_error(self.error_invalid_fields)
    end
    local body = self.request.body or {}
    local password = normalize_secret(body.password)
    if not password then
        self:raise_error(self.error_invalid_fields)
    end
    local redis = self:getRedis()
    local key = string.format(self.user_key, username)
    local existing = redis:get(key)
    if not existing or existing == null then
        return 200, { error = "User not found" }
    end
    local ok, err = redis:set(key, password)
    if not ok then
        Logger.gui("accounts.password_failed", { actor = actor, username = username, error = err }, "ERROR")
        return 200, { error = "Failed to update password" }
    end
    Logger.gui("accounts.password_updated", { actor = actor, username = username })
    return 200, { username = username }
end

function AccountsAdminController:delete_account()
    local actor = ensure_authorized(self)
    local username = self.params.username
    if not is_valid_key_field(username) then
        self:raise_error(self.error_invalid_fields)
    end
    local redis = self:getRedis()
    local key = string.format(self.user_key, username)
    local existing = redis:get(key)
    if not existing or existing == null then
        return 200, { error = "User not found" }
    end
    redis:del(key)
    local deleted_docs, err = delete_document_keys(redis, username)
    if err then
        Logger.gui("accounts.delete_partial", {
            actor = actor,
            username = username,
            documents_removed = deleted_docs,
            error = err,
        }, "WARN")
    else
        Logger.gui("accounts.deleted", { actor = actor, username = username, documents_removed = deleted_docs })
    end
    return 200, { username = username, documents_removed = deleted_docs }
end

function AccountsAdminController:login()
    local actor = ensure_authorized(self)
    local body = self.request.body or {}
    local username = body.username
    local password = normalize_secret(body.password)
    if not is_valid_key_field(username) or not password then
        self:raise_error(self.error_invalid_fields)
    end
    local redis = self:getRedis()
    local key = string.format(self.user_key, username)
    local stored = redis:get(key)
    local ok = stored and stored ~= null and stored == password
    Logger.gui("accounts.login_test", { actor = actor, username = username, success = ok })
    if ok then
        return 200, { username = username, authorized = true }
    end
    return 200, { username = username, authorized = false, error = "Invalid credentials" }
end

return AccountsAdminController
