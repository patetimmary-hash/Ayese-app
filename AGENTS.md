# Ayese — Base44 dev environment

## What this app is
A single self-contained static HTML file (`index.html`) — the "Ayese" community environmental action app for Nigeria. All logic is inline `<script>`; all persistence is `localStorage` (`ayese_guestid`, report data). No backend, no build step, no external API calls (only Google Fonts via CDN).

## How it runs here
Served by `nginx:alpine` (compose service `web`) on host port 3000. `index.html` is bind-mounted read-only into the nginx html root. No live-reload dev server (static file); after editing `index.html`, call `reload_preview` to refresh the preview.

## Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → `200`
- `docker compose -f docker-compose.base44.yml ps` → `web` healthy

## Secrets
None required. The app is fully client-side with no external credentials.
