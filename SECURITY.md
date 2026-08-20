# Clann — Security Status

## Completed (steps 1–9)
- HTTPS/TLS + HSTS on both frontend and backend
- No secrets committed to GitHub; production secrets live in Render environment variables (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_TOKEN_SECRET, ADMIN_TOKEN_TTL_HOURS, CORS_ORIGINS, DB_NAME, MONGO_URL)
- Authentication and admin authorization block unauthenticated access at the frontend UI level (see Known Gaps — this has NOT been verified at the direct API level)
- Input validation rejects invalid/incomplete organizer submissions (required fields, email format, URL format) at the frontend level (see Known Gaps — backend-level validation bypass has not been independently confirmed)
- Generic 404s on unknown routes; no stack traces, internal paths, or credentials exposed on error
- MongoDB Atlas network access restricted to Render's outbound IP ranges; the temporary 0.0.0.0/0 wildcard used during development has been removed
- CORS restricted to the production frontend origin + localhost for development; no wildcard
- Security headers (Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy) confirmed active on the live site via a `frontend/public/_headers` file. Content-Security-Policy intentionally deferred until third-party resource requirements (Google auth, images, fonts) are fully audited — adding a restrictive CSP blindly risks breaking login.

## In progress
- Step 10 — Rate limiting. Not yet implemented. Target endpoints: admin login, authentication endpoints, event submission, other sensitive/high-abuse-risk routes.

## Known gaps — not yet scheduled, flagged for prioritization
- **No bot/automation abuse protection anywhere.** The public organizer submission form and admin login are both currently unprotected against scripted abuse (mass fake submissions, brute-force login attempts). No CAPTCHA, honeypot, or bot-detection exists. Recommended: a honeypot field on the submission form, and Cloudflare Turnstile or hCaptcha (both have free tiers) specifically on admin login.
- **All prior auth/validation checks (steps 3, 4, 5) were tested only through the frontend UI**, not by calling the backend API directly. This is a meaningfully weaker test than confirming the backend itself rejects unauthenticated or malformed requests — a real bug of exactly this class (GET requests to `/events` silently not carrying the admin token, hiding data from the admin's own view) was found and fixed in this codebase during development, proving this category of gap is not theoretical here.
- **Admin token is stored in `localStorage`** (`clann_admin_token`), which is readable by any JavaScript running on the page — if an XSS vulnerability is ever introduced anywhere in the app, this token is directly exposed. An HttpOnly cookie would not be readable by client-side JS at all and is a meaningfully stronger design.
- **No database backups.** MongoDB Atlas free/M0 tier does not include automatic backups. There is currently no backup strategy — a data loss or corruption event has no recovery path.
- **Dependency vulnerability scanning is not enabled.** Enabling GitHub Dependabot (free, repo settings) would flag known-vulnerable versions in both `frontend/package.json` and the backend's Python dependencies automatically.

## Recommended next order of work
1. Rate limiting (already planned as step 10) + admin login bot protection (CAPTCHA) + direct API-level authorization testing, bundled into one pass — these are the cheapest fixes closing the most concretely-demonstrated risk.
2. Database backup strategy.
3. Admin token storage hardening (move to HttpOnly cookie).
4. Remaining checklist items: backend API authorization audit, brute-force protection, request/body size limits, file upload security (N/A currently — no file uploads exist, URL-only images), auth/token security review, dependency vulnerability check, MongoDB database-user permissions, security logging/monitoring, CSP implementation, full production security review.
