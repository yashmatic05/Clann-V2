# CLANN — Production Manual Verification Checklist (Real Stack)

**Date:** 2026-08-17 · **Scope:** deployed frontend `clann.netlify.app` + deployed backend `clann-backend.onrender.com` + live MongoDB + email
**Rule applied:** *This is NOT an end-to-end success report.* Several steps are impossible on the currently deployed stack, and this sandbox cannot execute browser/session flows (no outbound network, GET-only fetcher, no Google OAuth, no admin credentials). Every step below is marked **VERIFIED** (live probe / code-proof), **BROWSER** (must be run by you in a real Chrome session), or **BLOCKED** (cannot pass as deployed — reason + layer given).

---

## 0. Deployment-drift precondition (affects many steps)

The deployed stack is running **pre-session code** (repo commit `8d22506` — the only commit). Proof:

| Artifact | Deployed (verified live) | Session build (not deployed) |
|---|---|---|
| Backend `/docs` | `POST /api/submissions`, `GET /api/submissions/{id}/status`, `GET /api/admin/submissions`, approve/reject/delete — **no** `/submissions/mine`, **no** `/admin/submissions/{id}/note`, **no** `admin_note` | + `/submissions/mine`, + `/note`, + `admin_note` in status |
| `Profile.jsx` | **no** "My Organized Events" section (`git show HEAD` = 0 matches) | section present |
| `AdminPanel.jsx` | **no** detail modal / note UI (`git show HEAD` = 0 matches) | modal + note present |
| `Footer.jsx` | `src="/brand/monuments.png"` — **broken** (see step 23) | `src="/brand/categories/monuments.png"` |
| `Auth.jsx` / `OrganizerSubmit.jsx` / `Home.jsx` / `Footer.jsx` layout | pre-session (old subhead, stacked footer row, root `pb-24`, no auth footer) | session versions |
| **Email** | **no email feature exists anywhere** (grep of backend + frontend: no SMTP/SendGrid/Resend/Mailgun; requirements has only `email-validator`) | same — never built |

---

## The 26-step checklist

| # | Step | Status | Notes / exact browser procedure |
|---|---|---|---|
| 1 | Open deployed Clann website | ✅ **VERIFIED** (probe) | `https://clann.netlify.app` loads and renders (hero, chips, organizer CTA). NOTE: rendered probe showed mode counts `(0)`; the `/events` page showed 30+ events, so data path works — confirm counts in a real browser (possible CORS check, step 9 of prior diagnosis). |
| 2 | Create a real test organizer account | 🔒 **BROWSER** | Auth is Google OAuth via `auth.emergentagent.com` (`Auth.jsx:11`) — no password signup exists. In Chrome: `clann.netlify.app/auth` → "Continue with Google" → complete OAuth → Profile shows. Use a disposable Gmail you control. |
| 3 | Submit a test event with a real test email | 🔒 **BROWSER** | `clann.netlify.app/organizer` form renders (probe-verified). POST `/api/submissions` exists in deployed backend (docs + code). Fill ALL fields (name, email, title, category, mode, short desc, full desc, date, times, deadline, paid/price, seats, location, city, link, notes). |
| 4 | Confirm a submission ID is generated | 🔒 **BROWSER** | Success screen shows `sub_xxxxxxxxxx` (deployed code returns it; `POST /api/submissions` returns `submission_id`). |
| 5 | Event appears under Profile → My Organized Events | 🚫 **BLOCKED — deployed Profile has no such section** | **Layer:** frontend. **Cause:** the section exists only in the session build, never deployed. **Code change required:** YES (deploy session Profile.jsx + backend `/submissions/mine`). |
| 6 | Refresh; submission remains available | 🔒 **BROWSER** (partial) | The submission persists in the DB (refresh-safe). The deployed tracker does **not** auto-restore ID/email from localStorage (that's session Change 9) — you must re-enter ID + email on "Check submission status". Profile section (step 5) not available. |
| 7 | Submission ID can be copied | 🔒 **BROWSER** (deployed) | Deployed success screen: the ID is plain text (no copy button — that's session Change 8). You can manually select+copy; the button will only exist after deploying the session frontend. |
| 8 | Login to admin panel | 🔒 **BROWSER** | `clann.netlify.app/admin-clann-secret` renders Email/Password login (probe-verified). Needs `ADMIN_EMAIL`/`ADMIN_PASSWORD` from Render env. |
| 9 | Submission appears under Pending Requests | 🔒 **BROWSER** | Deployed admin has Submissions tab + pending filter (code + docs verified). |
| 10 | Open the submission, verify EVERY field | 🚫 **BLOCKED — deployed admin shows summary columns only** | **Layer:** frontend. **Cause:** full-detail modal (`submission-detail-modal` with all 15 DetailRows) is session-only. Deployed table shows organizer/event/date/status/submitted only. **Code change required:** YES (deploy session AdminPanel.jsx). |
| 11 | Add an admin note | 🚫 **BLOCKED — no note endpoint/UI in production** | **Layer:** backend + frontend. **Cause:** `/admin/submissions/{id}/note` and `admin_note` don't exist in deployed backend; note UI is session-only. **Code change required:** YES (deploy session backend + AdminPanel). |
| 12 | Save the note | 🚫 **BLOCKED** (same as 11) | — |
| 13 | Organizer sees admin note/status | 🚫 **BLOCKED** (same as 11) | Deployed tracker shows status + reject reason only; no "Note from Clann team". |
| 14 | Approve the event | 🔒 **BROWSER** | Deployed: approve button + `POST /admin/submissions/{id}/approve` (code + docs verified). |
| 15 | Event actually created in real DB | 🔒 **BROWSER + mongosh** (code-proof) | `approve_submission` inserts into `db.events` via the same `db` client that `list_events` reads. Read-only check: `mongosh "mongodb+srv://…" --quiet --eval 'db.getSiblingDB("<DB_NAME>").events.countDocuments({"title":"<your test event>"})'` → expect 1. |
| 16 | `/api/events` contains the approved event | ✅ **VERIFIED (endpoint works)** + 🔒 for your event | `https://clann-backend.onrender.com/api/events` returns JSON (probe-verified; ~30+ events). After approval, search for your title. |
| 17 | Event appears on homepage | 🔒 **BROWSER** | Deployed `/events` page renders all events (probe-verified). Homepage grid needs a real-browser confirm (renderer snapshot artifact showed `(0)` counts while hero loaded). |
| 18 | Open the event, all functionality works | ✅ **VERIFIED (surface)** + 🔒 (interactions) | `/event/evt_0b49f5f657` rendered full detail (probe) and `/api/events/{id}` returned JSON (probe). Register/remind/save need a logged-in browser. |
| 19 | Event does NOT appear before approval | ✅ **VERIFIED (code-proof)** | `approve_submission` creates the event doc at approval time; pending submissions are never rendered by any list endpoint. |
| 20 | Rejection reason reaches organizer | 🔒 **BROWSER** | Deployed: reject endpoint stores `reject_reason`; tracker displays it (code + docs verified). |
| 21 | **Real email notification to a real inbox** | 🚫 **BLOCKED — the feature does not exist** | **Layer:** backend (email). **Cause:** grep of `backend/server.py` + `frontend/src` finds zero email-sending code (no SMTP/SendGrid/Resend/Mailgun/SES); requirements only has `email-validator` (validation, not delivery). There is nothing to call, in any build. **Code change required:** YES — build an email notification feature (e.g., status-approval/rejection emails via Resend/SendGrid/SES + templates + env config), then re-verify against a real inbox. |
| 22 | Signup/login buttons visually | 🚫 **BLOCKED (deployed = old styling)** | Deployed Auth tabs lack the session `py-3`/`h-auto` height fix. Verify visually after deploying session Auth.jsx; until then the deployed version is what's live. |
| 23 | Footer + monument illustration, desktop | 🚫 **BLOCKED (deployed = broken image)** | **Layer:** frontend asset. **Cause:** deployed build references `/brand/monuments.png`; live probe of that path returns the **SPA-fallback HTML** (Netlify `/* → /index.html`), so the `<img>` loads HTML → broken icon. Repo file lives at `public/brand/categories/monuments.png`. **Code change required:** YES (deploy session Footer.jsx path fix). |
| 24 | Footer + monument, mobile viewport | 🚫 **BLOCKED** (same as 23; see 25–26 for layout) | Use Chrome DevTools responsive mode after deploying session build. |
| 25 | No excessive gap between bottom nav and footer | 🚫 **BLOCKED (deployed = old padding)** | Deployed Home keeps `pb-24 md:pb-6` on the root container (session moved it to organizer-cta) → the gap you asked to remove still exists in production. **Code change required:** YES (deploy session Home.jsx). |
| 26 | Footer copyright row horizontal on mobile | 🚫 **BLOCKED (deployed = old layout)** | Deployed footer bottom row is `flex-col` on mobile (stacks vertically). The session `flex-row flex-wrap` change is not deployed. **Code change required:** YES (deploy session Footer.jsx). |

---

## Failed / blocked flows — required format

| Exact failed flow | Likely cause | Layer | Code changes required? |
|---|---|---|---|
| 5 — Profile → My Organized Events | Feature never deployed (session-only) | Frontend (+ backend `/submissions/mine`) | ✅ YES — deploy session changes |
| 10 — Admin opens submission w/ every field | Detail modal never deployed | Frontend | ✅ YES — deploy session AdminPanel.jsx |
| 11–13 — Admin note saved; organizer sees it | `/note` endpoint + `admin_note` + note UI never deployed | Backend + Frontend | ✅ YES — deploy session backend + AdminPanel + OrganizerSubmit/Profile |
| 21 — Real email notification | **Email feature does not exist in the codebase** | Backend (email) | ✅ YES — build email feature first (not just deploy) |
| 23–24 — Footer monument illustration | Deployed build references missing `/brand/monuments.png` (verified: path serves SPA HTML) | Frontend (asset path) | ✅ YES — deploy session Footer.jsx fix |
| 25 — Bottom-nav/footer gap | Deployed Home still has root `pb-24 md:pb-6` | Frontend | ✅ YES — deploy session Home.jsx |
| 26 — Footer copyright row horizontal | Deployed row is `flex-col` on mobile | Frontend | ✅ YES — deploy session Footer.jsx |
| 22 — Auth button heights | Deployed Auth predates session `py-3`/`h-auto` | Frontend | ✅ YES — deploy session Auth.jsx |
| 7 — Copy submission ID (button) | Deployed success screen has no copy button (session-only) | Frontend | ✅ YES (optional; deploy session OrganizerSubmit.jsx) |

## Steps you can pass RIGHT NOW in a real Chrome session (deployed stack)

1, 2 (Google sign-in), 3, 4, 6 (DB-persistent, re-enter ID), 8, 9, 14, 15 (verify via mongosh), 16, 17, 18, 19 (code-proven), 20 — **but note steps 5, 7, 10, 11–13, 21, 22–26 fail regardless of browser, because the deployed build predates the session fixes and the email feature doesn't exist.**

---

## Bottom line

- **Not an E2E success.** The deployed stack cannot pass this checklist as-is.
- **Two independent blockers:** (a) the session's fixes/features are **not deployed** (Profile organized section, admin detail modal + note, `/submissions/mine` + `/note` endpoints, footer path + layout, auth/home/organizer UI); (b) the **email-notification feature does not exist in any build** — step 21 requires building it, not just deploying.
- **The 57/57 automated suite** validated logic against mocks/jsdom only; it does **not** cover deployed integration, email delivery, or visual checks — consistent with these findings.
- **Action required before any PR:** deploy the session changes (backend + frontend), build + configure the email feature, then re-run steps 1–26 in Chrome + a real inbox.
- No code was changed and no PR was created during this verification.
