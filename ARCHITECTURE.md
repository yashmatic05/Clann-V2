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
- `frontend/src/components/EventImage.jsx` — the ONLY component that renders an event image (`<EventImage event={...} size="sm|md|lg" className="..." />`). It always renders one frame (`relative overflow-hidden bg-raised` plus the caller's size classes) so layout never shifts, and inside it either the event's own image or a flat category placeholder. The `src` is always the event's own `image_url`, trimmed — the component never picks, dedupes, proxies or substitutes a URL. Landscape images fill the frame (`object-cover`); portrait and square images are shown whole (`object-contain`, detected from `naturalWidth`/`naturalHeight` on load); empty, stock-hosted or failed images become the placeholder (lucide category icon + category name at md/lg). There is no stock fallback anywhere any more.
- `frontend/src/lib/event-image.js` — the pure rules behind that component and the hero: `hasUsableImage(event)` (non-empty, non-stock `image_url`), `isLandscape` / `MIN_LANDSCAPE_RATIO` (1.2, the cover-vs-contain boundary) and `STOCK_IMAGE_HOSTS` / `isStockImageUrl` (a FLAG used to recognise stock URLs so they can be replaced — never a source). `frontend/src/lib/image-fallback.js` and its 8-image stock pool were deleted.
- `frontend/src/lib/dates.js` — `formatEventDateShort` is the standard DD-MM-YYYY display format used across all event cards and detail pages. Do not reintroduce ad-hoc `toLocaleDateString` calls elsewhere. The same file owns expiry: `todayIST()` (today's date in Asia/Kolkata as `YYYY-MM-DD`) and `isExpiredEvent(eventDate, today)` — an event dated today is NOT expired, and an empty or unparseable date is never treated as expired. Every "is this event over?" decision in the UI goes through it.
- `frontend/src/lib/event-utils.js` — `formatDeadlineDate` handles the shorter "Register before X" microcopy specifically; separate from the main event date format on purpose.
- `frontend/src/lib/api.js` — single axios instance. Its request interceptor auto-attaches the `X-Admin-Token` header (read from `localStorage.getItem("clann_admin_token")`) for: any `/admin/*` route, and any GET/POST/PUT/DELETE request to `/events`. This whitelist is intentional and load-bearing — a prior bug where GET requests were excluded caused the admin panel to silently hide events from its own view. If new admin-only routes are added, they must be added to this whitelist or they will be treated as unauthenticated.

## Admin Image Finder (POST /api/admin/fetch-image)
Admin-only, suggest-only tooling behind the admin panel's Image Finder tab
(`frontend/src/components/admin/ImageFinder.jsx`). Nothing is ever written by
the lookup itself: the admin approves a poster and the normal
`PUT /api/events/{event_id}` saves it.

- **Lookup** — reads the event's own registration page (SSRF-validated: scheme,
  DNS resolution of every address, manual redirect hops, 8s / 1.5 MB limits),
  extracts og:image / twitter:image / `link rel=image_src` / JSON-LD `Event.image`
  candidates, and verifies each one actually serves an `image/*` content type.
  Login-gated hosts (Instagram, Facebook, LinkedIn) return `login_gated`.
- **Site-default detection (Step 4)** — the same host's homepage is fetched once
  per host per hour (in-memory cache, same SSRF rules, failure cached as "could
  not check") and its og:image / twitter:image are collected. A candidate whose
  host+path matches one of them — or whose path contains a logo-like marker
  (logo, favicon, sprite, placeholder, default) — is never offered as a poster:
  it is removed from `image_url`/`alternatives` and reported in
  `generic_candidates` (only present when non-empty). If every reachable
  candidate is generic the response is `image_url: null`,
  `reason: "site_default_image"`. If the homepage cannot be read, the check is
  skipped entirely and the endpoint behaves as it did before.
- **Client-side review aids** — every preview `<img>` uses
  `referrerPolicy="no-referrer"` (hotlink-protected posters), `decoding="async"`
  and `loading="lazy"`; a URL found for 2+ events in one batch is flagged as a
  probable site logo; low-resolution (<400px wide) and very wide (>3:1) images
  get advisory badges; a preview that fails to load shows a plain note instead
  of a broken image. All warnings only change the button label to "Use anyway" —
  nothing is ever blocked.
- **Expiry** — the event list and the spreadsheet tab never offer an event whose
  date has passed in India (`isExpiredEvent`); spreadsheet rows are skipped
  before any lookup and left unchanged in the downloaded sheet.
- **Shared-image cleanup (Section C)** — non-expired events are grouped by saved
  `image_url` (trimmed, query string ignored) and any image used by 2+ events can
  be removed from all of them at once via `PUT /api/events/{id}` with
  `{ image_url: "" }` after a confirm dialog.

## Event expiry is decided in India time
`list_events` hides events whose `event_date` has passed **in Asia/Kolkata**
(`today_ist()` in `backend/server.py`, `zoneinfo`). `datetime.utcnow()` is 5h30m
behind IST and used to hide an event on its own final evening; the public cutoff
is now the IST date. Admin-authenticated requests are deliberately unchanged and
still see every event, including expired ones. `GET /events/{id}` and
`/events/{id}/related` still return any event by id.

## Data model (MongoDB collections)
- `events` — the canonical event record. Key fields: `event_id`, `clann_event_id` (public-facing CLN-XXXX-XXXX id), `title`, `category`, `mode`, `image_url`, `event_date` (YYYY-MM-DD string), `homepage_category`, `is_government`. Created either directly by admin, via Excel bulk import, or via an approved submission (all three paths share `prepare_event_doc()`).
- `submissions` — public organizer submissions. Status flow: `pending` → `approved` (creates a real `events` doc via `prepare_event_doc`, sets `created_event_id` on the submission) or `rejected` (optional `reject_reason`). Admins can also leave `admin_note` independent of approve/reject, visible to the organizer via `/submissions/{id}/status` and `/submissions/mine`.

## Auth
- Users: Google OAuth, session cookie, gated server-side by the `require_user` dependency.
- Admin: separate mechanism — `X-Admin-Token` header checked by `verify_admin_token` / `require_admin`, backed by `ADMIN_TOKEN_SECRET` env var on Render. Not the same system as user auth; a logged-in user is never automatically an admin.

## Known fragile points (read before assuming stability)
- Render's free tier suspends the backend after ~15 minutes of no external traffic (20-30s cold start on wake). Mitigated by a GitHub Actions workflow (`.github/workflows/keep-alive.yml`) pinging `GET /api/health` every 5 minutes, plus optional UptimeRobot monitoring on the same endpoint.
- MongoDB Atlas free tier (M0) has no automatic backups. There is currently no backup strategy in place — treat this as an open risk, not a solved problem.
- There is no stock-image fallback any more (deleted in the image-system fix), so an event with a missing or broken poster shows the flat category placeholder. That is deliberate: a placeholder is honest, a stock photo is not.
- `POST /admin/fetch-image` performs real outbound HTTP. Its SSRF validation resolves the hostname before connecting, but httpx resolves again when it connects, so a DNS-rebinding race is theoretically possible; the endpoint is admin-only, which is why that residual risk is accepted and documented in the code.
- Real transactional email sending does not exist anywhere in the backend (no SMTP/SendGrid/etc). Any UI copy implying an email was sent should be treated with suspicion and verified against the actual code before trusting it.
