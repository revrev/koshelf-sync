local cjson = require "cjson.safe"

local Logger = {}

local base_dir = os.getenv("KOSHELF_LOG_DIR") or "/app/koshelf-sync/logs/app"
Logger.paths = {
    app = base_dir .. "/server.log",
    gui = base_dir .. "/audiobookshelf-admin.log",
}

local ngx_levels = {}
if ngx then
    ngx_levels.DEBUG = ngx.DEBUG
    ngx_levels.INFO = ngx.INFO
    ngx_levels.WARN = ngx.WARN
    ngx_levels.ERROR = ngx.ERR
end

local function ensure_directory(path)
    local dir = path:match("(.+)/[^/]+$")
    if not dir or dir == "" then
        return
    end
    local ok, _, code = os.execute(string.format("mkdir -p %q", dir))
    if not ok and code ~= 0 and ngx and ngx.log then
        ngx.log(ngx.ERR, "logger: unable to create directory ", dir)
    end
end

for _, target in pairs(Logger.paths) do
    ensure_directory(target)
end

local function iso_timestamp()
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

local function safe_json(value)
    local encoded, err = cjson.encode(value)
    if encoded then
        return encoded
    end
    return cjson.encode({ error = "json-encode-failed", detail = err or "unknown" })
end

local function append_file(path, payload)
    local encoded = safe_json(payload)
    local file, err = io.open(path, "a")
    if not file then
        if ngx and ngx.log then
            ngx.log(ngx.ERR, "logger: unable to open ", path, ": ", err)
        else
            io.stderr:write(("logger: unable to open %s: %s\n"):format(path, err or "unknown"))
        end
        return false
    end
    file:write(encoded, "\n")
    file:close()
    return true
end

local function enrich_entry(category, level, event, data)
    local entry = {
        timestamp = iso_timestamp(),
        category = category,
        level = level,
        event = event,
        data = data or {},
    }
    if ngx then
        if ngx.var then
            entry.request_id = ngx.var.request_id
            entry.client_ip = ngx.var.remote_addr
            entry.user_agent = ngx.var.http_user_agent
        end
        if ngx.ctx and ngx.ctx.authenticated_user then
            entry.username = ngx.ctx.authenticated_user
        end
    end
    return entry
end

local function emit_console(level, category, event, data)
    if not (ngx and ngx.log) then
        return
    end
    local ngx_level = ngx_levels[level] or ngx.INFO
    ngx.log(ngx_level, "[", category, "] ", event, " ", safe_json(data or {}))
end

function Logger.log(category, level, event, data)
    local path = Logger.paths[category] or Logger.paths.app
    local entry = enrich_entry(category, level, event, data)
    append_file(path, entry)
    emit_console(level, category, event, data)
    return entry
end

function Logger.app(event, data, level)
    return Logger.log("app", level or "INFO", event, data)
end

function Logger.gui(event, data, level)
    return Logger.log("gui", level or "INFO", event, data)
end

function Logger.warn(category, event, data)
    return Logger.log(category, "WARN", event, data)
end

function Logger.error(category, event, data)
    return Logger.log(category, "ERROR", event, data)
end

return Logger
