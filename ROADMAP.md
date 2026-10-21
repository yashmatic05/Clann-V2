# Clann — Roadmap

`memory/PRD.md` records what was built, iteration by iteration. This file tracks what's shipped-and-confirmed-live, what's drafted-but-unverified, what's deliberately not built yet, and where the product direction is currently being weighed. Update this file whenever a prompt is run against the codebase — don't let it go stale.

## Shipped and confirmed live
- Event browsing, search (including partial Clan ID prefix matching), save, register, calendar view
- Admin event CRUD, Excel bulk import (image_url optional; only title/external_link/event_date required)
- Public organizer submission workflow at `/organizer`: submit → pending → admin approves (creates a real event) or rejects (optional reason) → organizer can track status by submission ID + email
- Image system: **real images only**. `<EventImage>` shows the event's own image (landscape fills the frame, portrait/square shown whole) or a flat category placeholder. The 8-URL stock pool, the duplicate-swap rule and the sub-1.2-ratio swap rule were all removed — a stock photo is never displayed anywhere.
- Admin Image Finder (`POST /api/admin/fetch-image`, suggest-only; human approval required): finds a real poster on the event's own registration page, refuses the site's own default logo/banner, flags probable repeats across events, flags low-resolution / banner-strip images, previews fail safely, can fill a spreadsheet before import, and can remove an image that is shared by several events.
- Event expiry in India time (Asia/Kolkata) for the public list and the Image Finder; expired events are never offered for image work.
- Hero banner: real, upcoming, genuinely wide event images only (>=800px, >=1.5 ratio); it renders nothing when none qualify instead of showing a placeholder or a stock photo.
- WhatsApp reminder toggle (stores preference only — no outbound messages are actually sent yet)
- Category pill filter (in-place filtering on Home)
- Keep-alive workflow + `/api/health` endpoint preventing Render cold starts

## Drafted but needs re-verification before being trusted as "live"
These were written and merged in earlier sessions but have NOT been independently reconfirmed against the current deployed app. Before building on top of any of these, actually check the live site first:
- CategoryShowcase icon grid (intended to replace the pill filter on Home) — last confirmed check showed the old pill filter still active in production; verify which is actually live before assuming the grid shipped.
- Profile page "My Organized Events" section, AdminPanel submission detail modal + admin feedback notes — written in a later session; confirm merge + deploy status before relying on them.

## Deliberately not built yet (and why)
- Real email confirmations to organizers — requires a transactional email provider (SendGrid/Resend/AWS SES) with an API key; no infrastructure for this exists. Do not add UI copy implying emails are sent until this is actually built.
- AI-generated event poster fallback — requires an image-generation API integration and ongoing cost; deferred pending a decision on budget/provider.
- Automatic web-wide event scraping (crawling external sites for events without organizer submission) — raises real legal/ToS questions around scraping and image hotlinking at scale; needs legal review before any engineering investment. Current event collection is human-guided (manual research + admin/Excel import), not autonomous.
- Automatic image search across the wider web (beyond the event's own registration page) — the Image Finder deliberately reads only the event's own page; a search-engine or third-party image-search integration is not built.
- Per-event link previews inside the admin panel (a live card preview of the event page) — not built; the Image Finder shows the candidate image itself and the page URL.

- Real WhatsApp message sending (Twilio integration) — preference is stored, no send logic exists.
- Image upload via object storage — locked decision to stay URL-only for now per the original PRD; revisit only after explicit re-discussion, not silently.

## Business direction — under consideration, not decided
Currently exploring a possible repositioning from "curated Delhi event platform" toward a Pinterest-style discovery model: broader, higher-volume event listings (still Delhi-only, still scoped to upskilling/creative events — not concerts/nightlife), registration always redirects externally to the source, monetization later via organizers paying for featured placement once real audience scale exists (this is a proven category in India — see AllEvents.in, 10times — not a novel idea).

Open risks flagged before committing to this direction:
- Image/content sourcing at scale multiplies the same trust and legal-exposure problems already solved once at small scale — needs real legal input, not assumed to be fine by analogy to Pinterest.
- "Automatic" listing requires real scraping infrastructure; current event collection is manual/AI-assisted research, which does not scale to "most events in Delhi" without significant additional engineering or cost.
- Monetization only becomes viable after real audience scale — until then this is a pure cost center; no committed timeline for that gap exists yet.

A possible middle path being considered: keep the current organizer-submission track as the "verified" tier, and test a second higher-volume, lower-review-bar track fed by the existing research process, labeled distinctly, to validate whether raw listing volume actually drives organic traffic before investing in real scraping infrastructure.

## Security hardening status
Full status lives in SECURITY.md. Summary: steps 1–9 of the original hardening pass are complete (HTTPS/HSTS, secrets management, frontend-level auth gating, frontend-level admin gating, input validation, error exposure, MongoDB network restriction, CORS, security headers). Rate limiting (step 10) is next. Bot/automation abuse protection, direct API-level authorization testing, admin token storage hardening, and database backups are identified gaps not yet scheduled — see SECURITY.md for detail.
