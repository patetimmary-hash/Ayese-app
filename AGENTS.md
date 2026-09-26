# Ayese — Base44 dev environment

## What this is
A single self-contained static HTML file (`index.html`, ~33KB) with inline CSS and JS. It is a waste-sorting / community-reporting PWA-style app ("Ayese"). No backend, no build step, no package manager.

## How it runs here
Served by `nginx:alpine` via `docker-compose.base44.yml`, bind-mounted read-only at `/usr/share/nginx/html`, exposed on host port 3000.

## Quirks / gotchas
- The JS attempts `window.claude.use("db"|"user"|"assets")` (Claude Artifacts API). That API does not exist in this environment, so the app silently falls back to in-memory arrays + `localStorage` (`ayese_guestid`). The app is fully functional without it — reports/adoptions persist only for the session/page-load lifetime (in-memory) plus the guest id in localStorage.
- **Permissions:** the repo root directory imports as mode 700 (owner-only). nginx's worker runs as a non-root user and returns 403. Fix with `chmod 755 .` and `chmod 644 index.html`. This must be re-applied if the sandbox is recreated.
- Edits to `index.html` are reflected on browser refresh (nginx serves the bind-mounted file directly); no rebuild or reload needed.

## Verify it works
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` → `200`, and the body starts with `<!DOCTYPE html>`.
