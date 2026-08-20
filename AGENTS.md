# Working on this repo — for AI agents and future developers

Before making any change to this codebase, read these files in this order:
1. `memory/PRD.md` — what's been built and when (historical changelog)
2. `ARCHITECTURE.md` — how the system is actually structured right now
3. `ROADMAP.md` — what's shipped, what's drafted-but-unverified, what's deliberately not built, and current open product-direction questions
4. `SECURITY.md` — current security status and known gaps

Do not duplicate logic that already exists in `frontend/src/lib/` (image handling, date formatting) — extend the existing utility instead of writing a parallel one. Do not assume a feature described in a past prompt or PR is actually live in production — verify against the current deployed app or the code itself, since drafted changes have previously gone unmerged without anyone noticing until much later.

After any change, update `ROADMAP.md` if it affects what's shipped, drafted, or deferred — keep it accurate, not just `memory/PRD.md`.
