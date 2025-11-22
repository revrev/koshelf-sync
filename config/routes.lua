local routes = require 'gin.core.routes'

-- define version
local v1 = routes.version(1)

-- define routes
v1:POST("/users/create", { controller = "syncs", action = "create_user" })
v1:GET("/users/auth", { controller = "syncs", action = "auth_user" })
v1:PUT("/syncs/progress", { controller = "syncs", action = "update_progress" })
v1:GET("/syncs/progress/:document", { controller = "syncs", action = "get_progress" })
v1:GET("/healthcheck", { controller = "syncs", action = "healthcheck" })
v1:GET("/admin/accounts", { controller = "accounts_admin", action = "list_accounts" })
v1:POST("/admin/accounts", { controller = "accounts_admin", action = "create_account" })
v1:PUT("/admin/accounts/:username/password", { controller = "accounts_admin", action = "update_password" })
v1:DELETE("/admin/accounts/:username", { controller = "accounts_admin", action = "delete_account" })
v1:POST("/admin/accounts/login", { controller = "accounts_admin", action = "login" })
v1:GET("/admin/audiobookshelf/config", { controller = "audiobookshelf_admin", action = "get_config" })
v1:PUT("/admin/audiobookshelf/config", { controller = "audiobookshelf_admin", action = "update_config" })
v1:GET("/admin/audiobookshelf/status", { controller = "audiobookshelf_admin", action = "get_status" })
v1:GET("/admin/audiobookshelf/libraries", { controller = "audiobookshelf_admin", action = "list_libraries" })
v1:GET("/admin/audiobookshelf/search", { controller = "audiobookshelf_admin", action = "search_library" })
v1:GET("/admin/audiobookshelf/library-items/:library_item_id", { controller = "audiobookshelf_admin", action = "get_library_item" })
v1:GET("/admin/audiobookshelf/cover", { controller = "audiobookshelf_admin", action = "get_item_cover" })
v1:GET("/admin/library", { controller = "library_admin", action = "list" })
v1:GET("/admin/library/:document", { controller = "library_admin", action = "get_item" })
v1:POST("/admin/library/:document/link", { controller = "library_admin", action = "link_item" })
v1:POST("/admin/library/:document/sync/to-audio", { controller = "sync_positions", action = "sync_to_audio" })
v1:POST("/admin/library/:document/sync/from-audio", { controller = "sync_positions", action = "sync_from_audio" })
v1:POST("/admin/library/:document/sync/auto", { controller = "sync_positions", action = "auto_sync" })


return routes
