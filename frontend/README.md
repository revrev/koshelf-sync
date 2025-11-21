# KoShelf React Frontend

This directory hosts the React + TypeScript UI that will progressively replace the legacy vanilla JS dashboard.

## Stack

- [Vite](https://vitejs.dev/) for dev server & bundling.
- React 19 + React Router for SPA navigation.
- [@tanstack/react-query](https://tanstack.com/query/latest) for data fetching/caching.
- Tailwind CSS themed with Catppuccin Mocha.
- ESLint (flat config) + TypeScript strict mode.

## Commands

```bash
# install dependencies
npm install

# run dev server with proxying /v1 calls to https://localhost:7200
npm run dev

# run ESLint
npm run lint

# type-check + production build
npm run build

# preview the production build locally
npm run preview
```

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Optional absolute origin to prepend to API requests (leave empty when serving behind the same domain). | `''` (same origin) |
| `KOSHELF_API_PROXY` | Dev-only proxy target for `/v1` when running `npm run dev`. | `https://localhost:7200` |

## Integrating with the Lua/OpenResty backend

1. During development, run `npm run dev` and keep the existing Docker compose stack up. The Vite server proxies `/v1` to the HTTPS backend (self-signed cert is ignored via `secure: false`).
2. For production, run `npm run build`. Copy the `frontend/dist` folder into the OpenResty image (e.g., as `/app/koshelf-sync/public/react`). Point Nginx to serve `public/react/index.html` on your preferred route (`/ui`, `/apps/koshelf`, etc.).
3. The React app sends the same headers as the legacy UI (`X-Auth-User` & `X-Auth-Key`) and expects JSON responses from the existing `/v1/admin/*` endpoints. No backend changes are required beyond exposing the static assets.
