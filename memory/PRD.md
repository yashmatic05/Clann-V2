# Clann — Product Requirements Document

## Original Problem Statement
Build a clean, modern web application called **Clann** — a local event discovery platform. Three user types: Attendees (browse events), Organizers (sign up to list events; profile only), and a single Admin who creates & manages all event listings.

Brand: Clann. Tagline: "Explore More. Upskill More." Font: Satoshi.
Colors: Orange #F84E00 (CTA), Purple #280049/#46176D/#BF72FF, Card #18002C, BG #0D0D0D, White #FFFBE9.

## User Choices (locked)
- Auth: Emergent-managed Google Auth (attendees + organizers)
- Images: URL only (no file upload)
- WhatsApp reminder: collect phone number (no actual sending)
- Seed data: 3 sample events auto-loaded on first startup
- Admin: `admin@clann.com` / `Clann@2026` at `/admin-clann-secret`

## Architecture
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + Satoshi
- Backend: FastAPI + Motor + MongoDB
- Auth: Emergent Google Auth (session cookie), Admin (env-based token in `X-Admin-Token` header)

## Implemented (Feb 16, 2026)
### Backend (`/app/backend/server.py`)
- `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/complete-profile`
- `POST /api/admin/login`, `GET /api/admin/stats`
- `GET /api/events` with filters (category, mode, city, q, featured)
- `GET/POST/PUT/DELETE /api/events/{id}`
- `POST/DELETE /api/events/{id}/save`, `GET /api/saved`
- `POST /api/events/{id}/whatsapp-remind`
- Auto-seed 3 events on first startup

### Frontend
- `/` Home — hero carousel, category chips, mode toggle, search, event grid
- `/event/:id` — full detail + WhatsApp reminder toggle + related events
- `/auth` — Google Sign Up / Login tabs
- `/complete-profile` — Attendee/Organizer profile completion after Google auth
- `/saved`, `/profile`
- `/admin-clann-secret` (login), `/admin` (dashboard + event CRUD + featured toggle)
- Mobile bottom tab bar

## Testing
- Iteration 1 testing subagent: all backend endpoints + core frontend flows pass.
- Iteration 2 testing subagent: **28/28 backend tests pass, all 8 change requests verified working end-to-end**. Reports: `/app/test_reports/iteration_1.json`, `/app/test_reports/iteration_2.json`.

## Iteration 9 (Aug 12, 2026) — Strict enforcement + audit of image architecture
- Audited every Unsplash/stock URL in the repo (RULE 11): the only remaining occurrences are the 8-URL fallback pool in `frontend/src/lib/image-fallback.js` (+ inert design-spec images in `design_guidelines.json`, which nothing imports).
- Fixes applied: (a) `backend/server.py` SEED_EVENTS no longer store Unsplash URLs — demo events now seed `image_url: ""` (frontend renders fallback imagery); (b) `EventCreate.image_url` is now `Optional` (omitted field no longer 422s, TEST 9); `prepare_event_doc` stores `image_url or ""`.
- Verified end-to-end with real code, no mocks of the logic: frontend node suite (TESTS 1–6, 12 + extras: real-first, blank→stock, null→stock, broken→visual fallback with DB untouched, 5 blanks→5 distinct stocks, duplicate real→2nd render stock only, no network/persistence in fallback file) — 21/21; backend TestClient suite (TESTS 7–10 + seed compliance + no stock in DB) — 11/11; regression on create/update/duplicate/register/save/registered/delete — 9/9.
- Production DB audit NOT performed (sandbox cannot reach the deployed Mongo/backend). Command for the testing agent: `db.events.find({image_url: {$regex: 'images.unsplash.com'}}, {title:1, image_url:1})` — report count before any cleanup (RULE 12: no existing records modified).

## Iteration 8 (Aug 12, 2026) — Real event images are primary; stock only as render-time fallback
- Root cause: Excel template sample row contained an Unsplash URL; importer + manual form + submission form *required* image_url (blank rows were rejected) → forced stock URLs into stored data.
- Fix: `image_url` is now OPTIONAL everywhere (Excel import, manual create/edit, public submission form, backend submission model). Blank rows import fine and are stored as `""`. The template's sample row no longer contains a stock URL.
- `image-fallback.js` is the single fallback authority: new pure `assignEventImages(list)` (real image wins on first occurrence; duplicates/blanks get an unused stock; no repeats per list; StrictMode-safe) + `eventImageHandlers` (broken real image → visual-only stock fallback via onError, DB never touched). Applied to EventCard, CompactEventCard, HeroBanner, MobileEventFeed, EventsListPage, EventDetail (banner + related), Home, Search, Saved, CalendarPage, Profile.
- No existing DB records modified. Production DB stock-URL audit left for the user (see test_result.md note) — no Mongo access from sandbox.

## Iteration 7 (Aug 12, 2026) — Organizer Submission Workflow (from backlog)
- **Public organizer submission form** at `/organizer` — anyone can propose an event: organizer name/email/phone, title, category, mode, descriptions, image URL, location, city, date/time, deadline, paid toggle + price, seats, registration link, notes. No login required.
- **Backend** (`backend/server.py`): `POST /api/submissions` (stores as `pending` in `submissions` collection), `GET /api/submissions/{id}/status?email=` (public status lookup, gated by submitter email), `GET /api/admin/submissions?status=` (queue), `POST /api/admin/submissions/{id}/approve` (creates a real event via the shared `prepare_event_doc` — CLN event ID, auto tags, seats_left — blocks duplicate titles with 409), `POST /api/admin/submissions/{id}/reject` (optional reason), `DELETE /api/admin/submissions/{id}`. `/admin/stats` now returns `pending_submissions`.
- **Admin Panel** — new "Submissions" tab with Pending/Approved/Rejected filters, organizer contact info, approve/reject/delete actions, link to the live event after approval.
- **Entry points** — Home page "Organizing an event?" CTA section + footer "List Your Event" link. Navbar intentionally untouched (keeps Iteration-6 verified structure).
- Refactor: `create_event` and submission approval now share `find_duplicate_event()` + `prepare_event_doc()` so both paths produce identical event records.
- Tests: `backend/tests/test_clann_iteration7.py` (submit, status gating, validation, queue auth, approve→publish, duplicate-title 409, reject flow, delete, stats regression). Local smoke suite: 32/32 checks green (mongomock-motor).

## Iteration 2 (Feb 16, 2026) — Changes Applied
- Hero banner reduced to image + Free/Paid chip + outlined "Know More" CTA (no title/desc)
- Every event card now has dual CTAs — filled Register + outlined Know More
- Complete Profile: mandatory Mobile Number with `+91` prefix box, WhatsApp reminders toggle (default ON)
- Reusable WhatsAppReminderBar strip on Home (below hero) + Saved (top). Per-event inline WhatsApp toggle on Event Detail
- Calendar page at `/calendar` — orange dot for each registered event, amber highlight + count badge on overlapping days, prev/next arrows, click-to-see-events panel
- Saved page unsave: confirm dialog → fade-out → toast; empty state with "Browse Events" CTA
- Profile "How's your Clann experience?" section with 1–5 stars + 300-char textarea; admin panel has a new Feedback tab
- Register Now: always opens external link new tab; disabled with tooltip when link is empty; fires `/api/events/{id}/register` for logged-in users to feed the calendar

## Backlog / P1
- Real WhatsApp reminder sending (Twilio) — currently prefs are stored but no outbound messages
- Analytics on registration clicks
- Image upload via object storage (note: "URL only" is a locked user choice — revisit with the user before building)
