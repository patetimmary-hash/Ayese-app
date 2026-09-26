# Ayese — Base44 dev environment

## What this app is
A community environmental action app for Nigeria ("Ayese"). Users sort waste via a guide, report litter, track areas, view dashboards, earn rewards & badges, and find resources. Auth is email/password + optional Google Sign-In. Data is stored in PostgreSQL.

## Architecture
- **Frontend**: static files in `public/` (HTML + CSS + vanilla JS modules) served by the Express backend on port 3000. No build step.
- **Backend**: Node.js + Express (`server/src/`) — REST API at `/api/*`, serves static frontend from `public/`.
- **Database**: PostgreSQL 16 (compose service `db`). Migrations run automatically on boot (`server/src/db.js`).

## How it runs here
`docker compose -f docker-compose.base44.yml up -d` starts two services:
- `db` — PostgreSQL with auto-created schema (users, reports, adoptions, flags, badges).
- `api` — Node 22 serving the app + API on host port 3000. Uses nodemon for live backend reload. Frontend changes need a browser refresh (call `reload_preview`).

## Secrets
- `JWT_SECRET` — required at boot, auto-generated dev placeholder. Replace for production.
- `GOOGLE_CLIENT_ID` — optional. Needed only for Google Sign-In. Get from Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Add the preview origin as an Authorized JavaScript origin. Without it, email/password auth still works.

## Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/config` → `200`
- `docker compose -f docker-compose.base44.yml ps` → `db` and `api` healthy
- Auth flow: register at the login screen, then all tabs are functional with cloud-synced data.

## Key files
- `server/src/app.js` — Express app, all API routes, rewards/badge engine
- `server/src/auth.js` — JWT auth, password hashing, Google OAuth verification
- `server/src/db.js` — PostgreSQL pool + auto-migration
- `public/js/api.js` — frontend API client with JWT token management
- `public/js/auth.js` — login/signup UI, Google Sign-In init
- `public/js/app.js` — main app logic (tabs, guide, reports, areas, dashboard, rewards)
- `public/js/data.js` — waste sorting guide data + resources
