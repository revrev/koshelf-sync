local routes = require 'gin.core.routes'

-- define version
local v1 = routes.version(1)

-- define routes
v1:POST("/users/create", { controller = "syncs", action = "create_user" })
v1:GET("/users/auth", { controller = "syncs", action = "auth_user" })
v1:PUT("/syncs/progress", { controller = "syncs", action = "update_progress" })
v1:GET("/syncs/progress/:document", { controller = "syncs", action = "get_progress" })
v1:GET("/healthcheck", { controller = "syncs", action = "healthcheck" })
v1:GET("/admin/audiobookshelf/config", { controller = "audiobookshelf_admin", action = "get_config" })
v1:PUT("/admin/audiobookshelf/config", { controller = "audiobookshelf_admin", action = "update_config" })
v1:GET("/admin/audiobookshelf/status", { controller = "audiobookshelf_admin", action = "get_status" })
v1:GET("/admin/audiobookshelf/libraries", { controller = "audiobookshelf_admin", action = "list_libraries" })
v1:GET("/admin/audiobookshelf/libraries/:library_id/search", { controller = "audiobookshelf_admin", action = "search_library" })
v1:GET("/admin/audiobookshelf/library-items/:library_item_id", { controller = "audiobookshelf_admin", action = "get_library_item" })

return routes
