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
- Public organizer submission workflow with an approval queue
- Analytics on registration clicks
- Image upload via object storage
