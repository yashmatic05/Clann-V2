# Clann — Architecture

This is the technical reference for how Clann is actually built. `memory/PRD.md` is the historical changelog of what shipped and when; this file is the current-state map. Read both before making changes.

## Stack
- Frontend: React 19 + React Router 7 + Tailwind CSS + shadcn/ui, deployed on Netlify
- Backend: FastAPI + Motor (async MongoDB driver), deployed on Render
- Database: MongoDB Atlas (free/M0 tier — no automatic backups, see Known Fragile Points)
- Brand: colors Orange #F84E00 (CTA), Purple #280049/#46176D/#BF72FF, Card #18002C, BG #0D0D0D, White #FFFBE9. Font: Satoshi. Tagline: "Explore More. Upskill More."

## Folder structure
- `frontend/src/pages/` — one file per route (Home, EventDetail, EventsListPage, Search, Saved, Profile, Auth, AdminPanel, AdminLogin, OrganizerSubmit, CalendarPage)
- `frontend/src/components/` — shared UI (EventCard, CompactEventCard, CategoryFilter, Navbar, Footer, BottomTabBar, MobileEventFeed, WhatsAppReminderBar)
- `frontend/src/lib/` — shared logic, see below
- `frontend/src/context/` — AuthContext (Google OAuth session)
- `backend/server.py` — single-file FastAPI app; all models, routes, and helpers live here

## Key shared utilities (do not duplicate these elsewhere — extend them instead)
- `frontend/src/lib/image-fallback.js` — the single authority for event images. `assignEventImages(list)` and `pickEventImage`/`eventImageHandlers` ensure: a real `image_url` always wins on first occurrence; blank or duplicate images fall back to one of 8 curated stock photos (`STOCK_IMAGE_POOL`) with no repeats in the same rendered list; images below a 1.2 width/height ratio (`MIN_LANDSCAPE_RATIO`) are treated as non-landscape and swapped to stock on load; broken image URLs swap to stock on error. Never mutates `event.image_url` or writes to the database — display-only.
- `frontend/src/lib/dates.js` — `formatEventDateShort` is the standard DD-MM-YYYY display format used across all event cards and detail pages. Do not reintroduce ad-hoc `toLocaleDateString` calls elsewhere.
- `frontend/src/lib/event-utils.js` — `formatDeadlineDate` handles the shorter "Register before X" microcopy specifically; separate from the main event date format on purpose.
- `frontend/src/lib/api.js` — single axios instance. Its request interceptor auto-attaches the `X-Admin-Token` header (read from `localStorage.getItem("clann_admin_token")`) for: any `/admin/*` route, and any GET/POST/PUT/DELETE request to `/events`. This whitelist is intentional and load-bearing — a prior bug where GET requests were excluded caused the admin panel to silently hide events from its own view. If new admin-only routes are added, they must be added to this whitelist or they will be treated as unauthenticated.

## Data model (MongoDB collections)
- `events` — the canonical event record. Key fields: `event_id`, `clann_event_id` (public-facing CLN-XXXX-XXXX id), `title`, `category`, `mode`, `image_url`, `event_date` (YYYY-MM-DD string), `homepage_category`, `is_government`. Created either directly by admin, via Excel bulk import, or via an approved submission (all three paths share `prepare_event_doc()`).
- `submissions` — public organizer submissions. Status flow: `pending` → `approved` (creates a real `events` doc via `prepare_event_doc`, sets `created_event_id` on the submission) or `rejected` (optional `reject_reason`). Admins can also leave `admin_note` independent of approve/reject, visible to the organizer via `/submissions/{id}/status` and `/submissions/mine`.

## Auth
- Users: Google OAuth, session cookie, gated server-side by the `require_user` dependency.
- Admin: separate mechanism — `X-Admin-Token` header checked by `verify_admin_token` / `require_admin`, backed by `ADMIN_TOKEN_SECRET` env var on Render. Not the same system as user auth; a logged-in user is never automatically an admin.

## Known fragile points (read before assuming stability)
- Render's free tier suspends the backend after ~15 minutes of no external traffic (20-30s cold start on wake). Mitigated by a GitHub Actions workflow (`.github/workflows/keep-alive.yml`) pinging `GET /api/health` every 5 minutes, plus optional UptimeRobot monitoring on the same endpoint.
- MongoDB Atlas free tier (M0) has no automatic backups. There is currently no backup strategy in place — treat this as an open risk, not a solved problem.
- The stock image pool is 8 static URLs. If event volume grows significantly, duplicate stock images across a single page become more likely even with the dedup logic (pool size is the ceiling).
- Real transactional email sending does not exist anywhere in the backend (no SMTP/SendGrid/etc). Any UI copy implying an email was sent should be treated with suspicion and verified against the actual code before trusting it.
