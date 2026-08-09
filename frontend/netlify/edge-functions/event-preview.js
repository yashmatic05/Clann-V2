/**
 * Netlify Edge Function — Dynamic OG metadata for CLANN event previews
 * Path: /event/*
 * Fetches public event data from existing backend GET /api/events/{event_id}
 * and injects Open Graph + Twitter meta tags into index.html before serving
 * to crawlers (WhatsApp, Facebook, Telegram, etc.).
 * Preserves React SPA for normal browsers — no UI changes.
 *
 * READ-ONLY: never modifies DB, never exposes private fields, _id, or credentials.
 * Production-safe: uses CLANN_BACKEND_URL via Netlify.env, no preview fallback.
 *
 * Every OG/Twitter tag is REPLACED (if already present in the shell) or inserted
 * (if missing) so the final HTML contains exactly one of each — a stale default
 * from index.html can never survive into an event response.
 */

export default async (request, context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle /event/{event_id} — skip if not matching
  const match = pathname.match(/^\/event\/([^\/?#]+)\/?$/);
  if (!match) {
    return context.next();
  }
  const rawId = match[1] || "";
  let eventId;
  try {
    eventId = decodeURIComponent(rawId).trim();
  } catch {
    return context.next();
  }
  // Strict validation: event_id is expected to be like evt_xxxxxxxxxx (10 hex chars)
  // Allow legacy/alternate but block path traversal, dots, slashes, and excessively long ids
  // Must be 6-80 chars, alphanumeric + _ -
  if (
    !eventId ||
    eventId.length < 6 ||
    eventId.length > 80 ||
    !/^[a-zA-Z0-9_-]+$/.test(eventId) ||
    eventId.includes("..") ||
    eventId.includes("/") ||
    eventId.includes("\\")
  ) {
    return context.next();
  }

  // Resolve backend URL via dedicated Netlify Edge env variable
  // DO NOT fallback to Emergent/preview backend in production
  let backendUrl = "";
  let backendStatus = "unset";
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      backendUrl = Netlify.env.get("CLANN_BACKEND_URL") || "";
    }
  } catch {}
  // Note: REACT_APP_BACKEND_URL is a build-time CRA variable and is NOT available at Edge runtime;
  // we intentionally do NOT read it here to avoid confusion.

  // If CLANN_BACKEND_URL is missing, do NOT query another backend.
  // Safely serve generic SPA HTML with brand OG.
  const missingBackend = !backendUrl || !backendUrl.trim();
  let event = null;
  if (!missingBackend) {
    backendUrl = backendUrl.trim().replace(/\/$/, "");
    // Basic URL validation — must be https
    let validBackend = false;
    try {
      const u = new URL(backendUrl);
      validBackend = u.protocol === "https:" && u.hostname.includes(".");
    } catch {
      validBackend = false;
    }
    if (validBackend) {
      backendStatus = "ok";
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        // Read-only public endpoint, no credentials, no admin token
        const resp = await fetch(`${backendUrl}/api/events/${encodeURIComponent(eventId)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          if (data && typeof data === "object" && data.event_id) {
            event = data;
          }
        } else {
          // Log status only (event_id is public — it is the URL path). No secrets.
          try {
            console.warn(`[event-preview] backend HTTP ${resp.status} for event=${eventId}`);
          } catch {}
        }
      } catch (_) {
        // Network/timeout/404 — fall through to generic OG
        // Do not expose error details
        event = null;
        try {
          console.warn(`[event-preview] backend fetch failed or timed out for event=${eventId}; serving generic OG`);
        } catch {}
      }
    } else {
      backendStatus = "invalid";
      // Invalid backend URL — log safe diagnostic server-side only
      try {
        console.warn("[event-preview] CLANN_BACKEND_URL is not a valid https URL");
      } catch {}
    }
  } else {
    // Missing env — safe diagnostic, no HTML exposure
    try {
      console.warn("[event-preview] CLANN_BACKEND_URL is not set; serving generic OG");
    } catch {}
  }

  // Fetch original HTML shell (index.html) via context.next()
  let response;
  try {
    response = await context.next();
  } catch {
    try {
      const origin = `${url.origin}/index.html`;
      response = await fetch(origin);
    } catch {
      return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }
  }

  let html;
  try {
    html = await response.text();
  } catch {
    return response;
  }

  if (!html.includes("<head") && !html.includes("<html")) {
    return new Response(html, response);
  }

  // ---- Build OG metadata ----
  const SITE_NAME = "Clann — Explore More. Upskill More.";
  const SITE_URL = "https://clann.netlify.app";
  const FALLBACK_IMAGE = `${SITE_URL}/brand/clann-logo.png`;
  const FALLBACK_DESC = "Discover workshops, meetups, hackathons, and conferences curated for students and young professionals.";

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const stripHtml = (str) =>
    String(str).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  let title = SITE_NAME;
  let description = FALLBACK_DESC;
  let image = FALLBACK_IMAGE;
  const ogUrl = `${SITE_URL}/event/${encodeURIComponent(eventId)}`;

  if (event && typeof event === "object") {
    if (event.title && String(event.title).trim()) {
      title = String(event.title).trim();
    }
    const rawDesc =
      event.short_description && String(event.short_description).trim()
        ? String(event.short_description)
        : event.full_description && String(event.full_description).trim()
          ? String(event.full_description)
          : FALLBACK_DESC;
    let clean = stripHtml(rawDesc);
    if (clean.length > 200) clean = clean.slice(0, 197).trim() + "...";
    description = clean || FALLBACK_DESC;

    const candidate = event.image_url && String(event.image_url).trim();
    // Strict: absolute https only, no javascript:, data:, file:, blob:, no whitespace, no control chars
    const blockedPrefixes = ["javascript:", "data:", "file:", "blob:", "vbscript:"];
    const lower = candidate ? candidate.toLowerCase() : "";
    const isBlocked = blockedPrefixes.some((p) => lower.startsWith(p));
    if (
      candidate &&
      !isBlocked &&
      /^https:\/\//i.test(candidate) &&
      !/\s/.test(candidate) &&
      !/[\x00-\x1f\x7f]/.test(candidate)
    ) {
      try {
        const u = new URL(candidate);
        if (u.protocol === "https:" && u.hostname.includes(".") && u.hostname.length >= 3) {
          // Basic sanity: must have at least one dot, not localhost
          image = candidate;
        }
      } catch {}
    }
  }

  const escTitle = escapeHtml(title);
  const escDesc = escapeHtml(description);
  const escImage = escapeHtml(image);
  const escUrl = escapeHtml(ogUrl);
  const escSiteName = escapeHtml(SITE_NAME);
  const escImageAlt = escTitle;

  // Determine image type/width/height safely where possible
  // Default to 1200x630 jpeg; detect png/webp from extension
  let imageType = "image/jpeg";
  const lowerImg = image.toLowerCase();
  if (lowerImg.endsWith(".png")) imageType = "image/png";
  else if (lowerImg.endsWith(".webp")) imageType = "image/webp";
  // Unsplash and most event images are jpeg; keep generic dimensions (hints only)

  // Safe diagnostic for Netlify logs: event_id is public (it is the URL path).
  try {
    const imageState = event ? (image !== FALLBACK_IMAGE ? "event" : "none-or-rejected") : "n/a";
    console.log(`[event-preview] event=${eventId} status=${event ? "resolved" : "fallback"} backend=${backendStatus} image=${imageState}`);
  } catch {}

  // ---- Inject metadata: REPLACE any existing tag, otherwise INSERT ----
  const insertBeforeHeadClose = (html, tag) => {
    if (html.includes("</head>")) return html.replace("</head>", `${tag}</head>`);
    if (html.includes("<head>")) return html.replace("<head>", `<head>${tag}`);
    return tag + html;
  };

  // Replace the first <meta attribute="value" ...> (attribute order agnostic,
  // single or double quotes) or insert the tag before </head> when absent.
  // NOTE: must test() before replace() — when the new tag is byte-identical to
  // the existing one (e.g. fallback values equal the index.html defaults),
  // replace() returns the same string and must not be mistaken for "not found".
  const setMeta = (html, attr, attrVal, tag) => {
    const safeVal = attrVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`<meta[^>]*\\b${attr}=["']${safeVal}["'][^>]*>`, "i");
    if (re.test(html)) return html.replace(re, tag);
    return insertBeforeHeadClose(html, tag);
  };

  const setCanonical = (html, tag) => {
    const re = /<link[^>]*\brel=["']canonical["'][^>]*>/i;
    if (re.test(html)) return html.replace(re, tag);
    return insertBeforeHeadClose(html, tag);
  };

  // <title> — replace when present, otherwise insert.
  if (/<title>/i.test(html)) {
    html = html.replace(/<title>.*?<\/title>/is, `<title>${escTitle}</title>`);
  } else {
    html = insertBeforeHeadClose(html, `<title>${escTitle}</title>`);
  }

  // Replace the shell's meta description — never let a stale generic
  // description (e.g. "A product of emergent.sh") survive into event HTML.
  html = setMeta(html, "name", "description", `<meta name="description" content="${escDesc}" />`);
  html = setMeta(html, "property", "og:type", `<meta property="og:type" content="website" />`);
  html = setMeta(html, "property", "og:title", `<meta property="og:title" content="${escTitle}" />`);
  html = setMeta(html, "property", "og:description", `<meta property="og:description" content="${escDesc}" />`);
  html = setMeta(html, "property", "og:image", `<meta property="og:image" content="${escImage}" />`);
  html = setMeta(html, "property", "og:image:width", `<meta property="og:image:width" content="1200" />`);
  html = setMeta(html, "property", "og:image:height", `<meta property="og:image:height" content="630" />`);
  html = setMeta(html, "property", "og:image:type", `<meta property="og:image:type" content="${escapeHtml(imageType)}" />`);
  html = setMeta(html, "property", "og:image:alt", `<meta property="og:image:alt" content="${escImageAlt}" />`);
  html = setMeta(html, "property", "og:url", `<meta property="og:url" content="${escUrl}" />`);
  html = setMeta(html, "property", "og:site_name", `<meta property="og:site_name" content="${escSiteName}" />`);
  html = setMeta(html, "name", "twitter:card", `<meta name="twitter:card" content="summary_large_image" />`);
  html = setMeta(html, "name", "twitter:title", `<meta name="twitter:title" content="${escTitle}" />`);
  html = setMeta(html, "name", "twitter:description", `<meta name="twitter:description" content="${escDesc}" />`);
  html = setMeta(html, "name", "twitter:image", `<meta name="twitter:image" content="${escImage}" />`);
  html = setCanonical(html, `<link rel="canonical" href="${escUrl}" />`);

  const modified = new Response(html, response);
  modified.headers.set("Content-Type", "text/html; charset=utf-8");
  // Dynamic per-event metadata must not be pinned by shared caches. Netlify does
  // not cache Edge Function responses unless explicitly opted in; removing
  // s-maxage also prevents any other intermediary from holding a generic
  // fallback response for 10 minutes.
  modified.headers.set("Cache-Control", "public, max-age=300, must-revalidate");
  modified.headers.delete("x-powered-by");
  // Do not expose backend URL or env values
  return modified;
};

export const config = {
  path: "/event/*",
};
