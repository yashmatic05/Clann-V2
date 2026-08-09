/**
 * event-preview.test.mjs — offline test harness for the Netlify Edge Function
 * `frontend/netlify/edge-functions/event-preview.js`.
 *
 * The edge function ships as ESM while frontend/package.json is CommonJS, so we
 * load its source inside a sandboxed Function (export statements converted to
 * consts) with mocked Netlify.env / fetch / context.next(). No network, no
 * dependencies — run with:  node tests/event-preview.test.mjs
 *
 * Fixtures use REAL event IDs and metadata scraped from the live production
 * site (https://clann.netlify.app) on 2026-08-09.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EDGE_SRC = readFileSync(path.join(root, "frontend/netlify/edge-functions/event-preview.js"), "utf8");
const INDEX_HTML = readFileSync(path.join(root, "frontend/public/index.html"), "utf8");

const BACKEND = "https://api.clann-test.internal"; // test-only backend host (must never leak into HTML)
const SITE = "https://clann.netlify.app";
const LOGO = `${SITE}/brand/clann-logo.png`;
const SITE_NAME = "Clann — Explore More. Upskill More.";
const BRAND_DESC = "Discover workshops, meetups, hackathons, and conferences curated for students and young professionals.";

// ---- Real production event fixtures ----
const EVENTS = {
  "evt_3e09f460d0": {
    event_id: "evt_3e09f460d0",
    clann_event_id: "CLN-CONF-NTAA",
    title: "Google I/O Extended 2026 – New Delhi",
    category: "Conference",
    mode: "Offline",
    short_description: "Google I/O Extended 2026 by GDG New Delhi brings Google I/O content to the local developer community.",
    full_description:
      "Google I/O Extended 2026 by GDG New Delhi brings Google I/O content to the local developer community. " +
      "The event focuses on AI, Gemini, Google Cloud, Android, Web and other Google technologies, with workshops, demos and networking.",
    image_url:
      "https://res.cloudinary.com/startup-grind/image/upload/c_scale,w_2560/c_crop,h_640,w_2560," +
      "y_0.0_mul_h_sub_0.0_mul_640/c_crop,h_640,w_2560/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/" +
      "platform-data-goog/event_banners/blob_rVr3KXz",
  },
  "evt_e9e7b2a867": {
    event_id: "evt_e9e7b2a867",
    clann_event_id: "CLN-EVT-NDNS-01",
    title: "Plantation Drive",
    category: "Workshop",
    mode: "Offline",
    short_description: "Plantation Drive in Delhi with New Delhi Nature Society.",
    full_description:
      "Plantation Drive in Delhi with New Delhi Nature Society. Includes sapling planting, " +
      "composting demo, and a guided nature walk through Tughlaqabad Biodiversity Park.",
    image_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
  },
  "evt_cdaefbcfcd": {
    event_id: "evt_cdaefbcfcd",
    title: "Fireflies Workshop",
    category: "Workshop",
    mode: "Offline",
    short_description: "Fireflies Workshop in Delhi with New Delhi Nature Society.",
    full_description: "Fireflies Workshop in Delhi with New Delhi Nature Society.",
    image_url: "", // event without an image
  },
};

const CLOUDINARY_IMG = EVENTS["evt_3e09f460d0"].image_url;
const UNSPLASH_IMG = EVENTS["evt_e9e7b2a867"].image_url;

// ---- Test infra ----
let passCount = 0;
let failCount = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    passCount++;
  } else {
    failCount++;
    failures.push(`${name} ${extra}`.trim());
    console.log(`  FAIL ${name} ${extra}`.trim());
  }
}

function countOccurrences(haystack, needle) {
  let n = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    n++;
    idx = haystack.indexOf(needle, idx + 1);
  }
  return n;
}

function extractMetaContent(html, attr, attrVal) {
  const safe = attrVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<meta[^>]*\\b${attr}=["']${safe}["'][^>]*?content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : null;
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']*)["']/i);
  return m ? m[1] : null;
}

// Build a fetch mock keyed by full URL.
function makeFetch(routes) {
  return async (input, opts = {}) => {
    const u = String(input);
    const route = routes[u];
    if (!route) throw new Error(`Unexpected fetch in edge function: ${u}`);
    switch (route.type) {
      case "ok":
        return { ok: true, status: 200, json: async () => route.data };
      case "html":
        return { ok: true, status: 200, text: async () => route.html };
      case "status":
        return { ok: false, status: route.status, json: async () => ({ detail: route.detail || "nope" }) };
      case "abort":
        return new Promise((_, reject) => {
          if (opts.signal) opts.signal.addEventListener("abort", () => reject(new Error("Aborted by timeout")));
        });
      case "reject":
        return Promise.reject(new Error(route.reason || "network down"));
      default:
        throw new Error(`bad route ${u}`);
    }
  };
}

function eventRoute(eventId) {
  return `${BACKEND}/api/events/${encodeURIComponent(eventId)}`;
}

function loadHandler(fetchMock, { backendUrl = BACKEND, fakeTimers = false } = {}) {
  const src = EDGE_SRC.replace("export default async", "const __handler = async").replace("export const config", "const config");
  const factory = new Function(
    "Netlify", "fetch", "Response", "URL", "AbortController", "setTimeout", "clearTimeout", "console",
    `"use strict";\n${src}\nreturn { handler: __handler, config };`
  );
  const netlifyMock = backendUrl === undefined ? undefined : { env: { get: (k) => (k === "CLANN_BACKEND_URL" ? backendUrl : "") } };
  const setTimeoutFn = fakeTimers ? (cb) => setTimeout(cb, 10) : setTimeout;
  return factory(netlifyMock, fetchMock, Response, URL, AbortController, setTimeoutFn, clearTimeout, console);
}

function makeContext({ nextHtml = INDEX_HTML, throwNext = false } = {}) {
  return {
    next: async () => {
      if (throwNext) throw new Error("context.next failed");
      return new Response(nextHtml, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-powered-by": "Netlify",
          "cache-control": "public, max-age=0, must-revalidate",
        },
      });
    },
  };
}

async function run(urlStr, { backendUrl = BACKEND, routes = {}, nextHtml = INDEX_HTML, throwNext = false, fakeTimers = false } = {}) {
  const fetchMock = makeFetch(routes);
  const { handler } = loadHandler(fetchMock, { backendUrl, fakeTimers });
  const ctx = makeContext({ nextHtml, throwNext });
  return handler(new Request(urlStr), ctx);
}

// ---- Generic per-response assertions ----
function assertEventSuccess(html, res, { title, image, desc, eventId }) {
  const url = `${SITE}/event/${eventId}`;
  // URLs are HTML-escaped in attributes (& → &amp;), so compare against the escaped form
  const imageInHtml = image.replace(/&/g, "&amp;");
  check("status 200", res.status === 200);
  check("content-type html", (res.headers.get("content-type") || "").includes("text/html"));
  check("cache-control public max-age=300 must-revalidate", (res.headers.get("cache-control") || "") === "public, max-age=300, must-revalidate", `[${res.headers.get("cache-control")}]`);
  check("x-powered-by removed", res.headers.get("x-powered-by") === null);
  check("title tag = event title", extractTitle(html) === title, `[${extractTitle(html)}]`);
  check("og:title = event title", extractMetaContent(html, "property", "og:title") === title, `[${extractMetaContent(html, "property", "og:title")}]`);
  check("og:description = event desc", extractMetaContent(html, "property", "og:description") === desc, `[${extractMetaContent(html, "property", "og:description")}]`);
  check("meta description = event desc", extractMetaContent(html, "name", "description") === desc);
  check("og:image = event image", extractMetaContent(html, "property", "og:image") === imageInHtml, `[${extractMetaContent(html, "property", "og:image")}]`);
  check("og:image:alt = event title", extractMetaContent(html, "property", "og:image:alt") === title);
  check("og:url = event url", extractMetaContent(html, "property", "og:url") === url);
  check("og:site_name present", extractMetaContent(html, "property", "og:site_name") === SITE_NAME);
  check("og:type website", extractMetaContent(html, "property", "og:type") === "website");
  check("twitter:card summary_large_image", extractMetaContent(html, "name", "twitter:card") === "summary_large_image");
  check("twitter:title = event title", extractMetaContent(html, "name", "twitter:title") === title);
  check("twitter:description = event desc", extractMetaContent(html, "name", "twitter:description") === desc);
  check("twitter:image = event image", extractMetaContent(html, "name", "twitter:image") === imageInHtml);
  check("canonical = event url", extractCanonical(html) === url);
  check("og:image:width 1200", extractMetaContent(html, "property", "og:image:width") === "1200");
  check("og:image:height 630", extractMetaContent(html, "property", "og:image:height") === "630");

  // Exactly one of each critical tag (no duplicates from index.html defaults)
  for (const tag of ["property=\"og:title\"", "property=\"og:description\"", "property=\"og:image\"",
    "property=\"og:url\"", "name=\"twitter:title\"", "name=\"twitter:description\"", "name=\"twitter:image\"",
    "name=\"description\"", "rel=\"canonical\""]) {
    check(`exactly one ${tag}`, countOccurrences(html, tag) === 1, `[count=${countOccurrences(html, tag)}]`);
  }

  // SPA shell preserved
  check("React root preserved", html.includes('<div id="root"></div>'));
  check("noscript preserved", html.includes("<noscript>"));
  check("body close preserved", html.includes("</body>"));
  check("emergent script preserved", html.includes("assets.emergent.sh/scripts/emergent-main.js"));

  // Generic/stale content must NOT appear in a successful event response
  check("no 'A product of emergent.sh'", !html.includes("A product of emergent.sh"));
  check("og:title is not the generic brand title", extractMetaContent(html, "property", "og:title") !== SITE_NAME);

  // Security: no backend/env/private leaks
  // (MongoDB-style "_id" field only — posthog's "get_distinct_id" identifier is legitimate)
  check("backend URL not leaked", !html.includes(BACKEND));
  check("no _id leaked", !html.includes('"_id"'));
  check("no env var names leaked", !html.includes("CLANN_BACKEND_URL"));
}

function assertGenericFallback(html, res, { eventId }) {
  const url = `${SITE}/event/${eventId}`;
  check("fallback status 200", res.status === 200);
  check("fallback og:image = CLANN logo", extractMetaContent(html, "property", "og:image") === LOGO);
  check("fallback og:url still event url", extractMetaContent(html, "property", "og:url") === url);
  check("fallback canonical still event url", extractCanonical(html) === url);
  check("fallback twitter:image = logo", extractMetaContent(html, "name", "twitter:image") === LOGO);
  check("fallback title = site name", extractTitle(html) === SITE_NAME);
  check("fallback desc = brand desc", extractMetaContent(html, "name", "description") === BRAND_DESC);
  check("fallback React root preserved", html.includes('<div id="root"></div>'));
  check("fallback no 'A product of emergent.sh'", !html.includes("A product of emergent.sh"));
  check("fallback backend URL not leaked", !html.includes(BACKEND));
  check("fallback exactly one og:image", countOccurrences(html, 'property="og:image"') === 1);
  check("fallback exactly one meta description", countOccurrences(html, 'name="description"') === 1);
}

async function suite(name, fn) {
  console.log(`\n=== ${name} ===`);
  await fn();
}

// 1. Real event with Cloudinary banner image
await suite("Real event evt_3e09f460d0 (Cloudinary image)", async () => {
  const ev = EVENTS["evt_3e09f460d0"];
  const routes = { [eventRoute("evt_3e09f460d0")]: { type: "ok", data: ev } };
  const res = await run(`${SITE}/event/evt_3e09f460d0`, { routes });
  const html = await res.text();
  assertEventSuccess(html, res, { title: ev.title, image: CLOUDINARY_IMG, desc: ev.short_description, eventId: "evt_3e09f460d0" });
  check("no CLANN logo as og:image (valid image)", !html.includes(`<meta property="og:image" content="${LOGO}"`));
  check("cloudinary image present", html.includes(CLOUDINARY_IMG.replace(/&/g, "&amp;")));
});

// 2. Real event with Unsplash image
await suite("Real event evt_e9e7b2a867 (Unsplash image)", async () => {
  const ev = EVENTS["evt_e9e7b2a867"];
  const routes = { [eventRoute("evt_e9e7b2a867")]: { type: "ok", data: ev } };
  const res = await run(`${SITE}/event/evt_e9e7b2a867`, { routes });
  const html = await res.text();
  assertEventSuccess(html, res, { title: ev.title, image: UNSPLASH_IMG, desc: ev.short_description, eventId: "evt_e9e7b2a867" });
  check("unsplash image present", html.includes(UNSPLASH_IMG.replace(/&/g, "&amp;")));
});

// 3. Event without image → event title/desc, brand logo as og:image
await suite("Event without image (evt_cdaefbcfcd)", async () => {
  const ev = EVENTS["evt_cdaefbcfcd"];
  const routes = { [eventRoute("evt_cdaefbcfcd")]: { type: "ok", data: ev } };
  const res = await run(`${SITE}/event/evt_cdaefbcfcd`, { routes });
  const html = await res.text();
  check("title is event title", extractTitle(html) === ev.title);
  check("desc is event desc", extractMetaContent(html, "property", "og:description") === ev.short_description);
  check("og:image falls back to CLANN logo", extractMetaContent(html, "property", "og:image") === LOGO);
  check("twitter:image = logo", extractMetaContent(html, "name", "twitter:image") === LOGO);
  check("og:url event-specific", extractMetaContent(html, "property", "og:url") === `${SITE}/event/evt_cdaefbcfcd`);
  check("React root preserved", html.includes('<div id="root"></div>'));
  check("no stale description", !html.includes("A product of emergent.sh"));
});

// 4. Nonexistent event → backend 404 → generic fallback
await suite("Nonexistent event (404)", async () => {
  const routes = { [eventRoute("evt_0000000000")]: { type: "status", status: 404 } };
  const res = await run(`${SITE}/event/evt_0000000000`, { routes });
  const html = await res.text();
  assertGenericFallback(html, res, { eventId: "evt_0000000000" });
});

// 5. Backend timeout (abort) → generic fallback
await suite("Backend timeout (abort)", async () => {
  const routes = { [eventRoute("evt_3e09f460d0")]: { type: "abort" } };
  const res = await run(`${SITE}/event/evt_3e09f460d0`, { routes, fakeTimers: true });
  const html = await res.text();
  assertGenericFallback(html, res, { eventId: "evt_3e09f460d0" });
});

// 6. Missing CLANN_BACKEND_URL → generic fallback, no crash
await suite("Missing CLANN_BACKEND_URL", async () => {
  const res = await run(`${SITE}/event/evt_3e09f460d0`, { backendUrl: undefined, routes: {} });
  const html = await res.text();
  assertGenericFallback(html, res, { eventId: "evt_3e09f460d0" });
});

// 7. Invalid event IDs → passthrough (edge function declines; SPA fallback serves shell)
await suite("Invalid event IDs → passthrough", async () => {
  const bad = [
    "abc", // too short
    "..%2F..%2Fetc%2Fpasswd", // decodes to ../../etc/passwd
    "evt_3e09f460d0<script>", // invalid characters
    "e".repeat(81), // too long
    "evt_3e09f460d0..x", // dots
    "evt_x%5C..%5Csecret", // backslashes
    "evt_3e09f460d0%2Fadmin", // embedded slash after decode
  ];
  let i = 0;
  for (const raw of bad) {
    i++;
    const urlStr = `${SITE}/event/${encodeURIComponent(raw)}`;
    let threw = false;
    let res;
    try {
      res = await run(urlStr, { routes: {} }); // any fetch attempt throws "Unexpected fetch"
    } catch (e) {
      threw = true;
      check(`invalid id ${i} did not throw`, false, e.message);
    }
    if (!threw) {
      const html = await res.text();
      check(`invalid id ${i} passthrough body identical to index.html`, html === INDEX_HTML);
      check(`invalid id ${i} no og:url injected`, !html.includes('property="og:url"'));
      check(`invalid id ${i} status 200`, res.status === 200);
    }
  }
});

// 8. Invalid image URLs → safe fallback
await suite("Invalid image URLs → safe fallback", async () => {
  const cases = [
    ["javascript:alert(1)", "evt_jscase0001"],
    ["data:text/html;base64,PHNjcmlwdD4=", "evt_datacase01"],
    ["http://insecure.example.com/x.png", "evt_httpcase01"],
    ["https://localhost/x.png", "evt_lclhstcase1"],
    ["https://exa mple.com/x.png", "evt_spacecase1"],
    ["https://evil.com/x.png", "evt_httpscase1"], // https external host with a dot — accepted by design
  ];
  for (const [img, id] of cases) {
    const routes = { [eventRoute(id)]: { type: "ok", data: { event_id: id, title: `Evt ${id}`, short_description: "d", image_url: img } } };
    const res = await run(`${SITE}/event/${id}`, { routes });
    const html = await res.text();
    const ogImage = extractMetaContent(html, "property", "og:image");
    if (img === "https://evil.com/x.png") {
      check(`https external host accepted (${id})`, ogImage === img);
    } else {
      check(`blocked image falls back to logo (${id})`, ogImage === LOGO, `[og:image=${ogImage}]`);
    }
    check(`no JS injection in ${id}`, !html.includes("javascript:alert") && !html.includes("base64,"));
  }
});

// 9. Non-event routes passthrough
await suite("Non-event routes passthrough (/ /profile /calendar /auth /admin)", async () => {
  const paths = ["/", "/profile", "/calendar", "/auth", "/admin-clann-secret", "/events", "/saved", "/complete-profile"];
  for (const p of paths) {
    const res = await run(`${SITE}${p}`, { routes: {} });
    const html = await res.text();
    check(`passthrough ${p} body identical to index.html`, html === INDEX_HTML);
    check(`passthrough ${p} status 200`, res.status === 200);
  }
});

// 10. Event URL variants (trailing slash, query string / cache-buster)
await suite("Event URL variants (trailing slash, query)", async () => {
  const ev = EVENTS["evt_3e09f460d0"];
  const routes = { [eventRoute("evt_3e09f460d0")]: { type: "ok", data: ev } };
  for (const variant of [`${SITE}/event/evt_3e09f460d0/`, `${SITE}/event/evt_3e09f460d0?v=2`, `${SITE}/event/evt_3e09f460d0/?utm_source=whatsapp`]) {
    const res = await run(variant, { routes });
    const html = await res.text();
    check(`variant ${variant} og:title`, extractMetaContent(html, "property", "og:title") === ev.title);
    check(`variant ${variant} og:image`, extractMetaContent(html, "property", "og:image") === CLOUDINARY_IMG);
    check(`variant ${variant} canonical`, extractCanonical(html) === `${SITE}/event/evt_3e09f460d0`);
  }
});

// 11. HTML-injection safety in title/description
await suite("Escaping of title/description (XSS-safe OG)", async () => {
  const ev = {
    event_id: "evt_escapetest1",
    title: `<b>Hack</b> & "Sale" 'Now'`,
    short_description: "<p>Hello & welcome</p>",
    full_description: "",
    image_url: UNSPLASH_IMG,
  };
  const routes = { [eventRoute("evt_escapetest1")]: { type: "ok", data: ev } };
  const res = await run(`${SITE}/event/evt_escapetest1`, { routes });
  const html = await res.text();
  check("og:title escaped", extractMetaContent(html, "property", "og:title") === "&lt;b&gt;Hack&lt;/b&gt; &amp; &quot;Sale&quot; &#39;Now&#39;", `[${extractMetaContent(html, "property", "og:title")}]`);
  check("description stripped of HTML tags", extractMetaContent(html, "property", "og:description") === "Hello &amp; welcome", `[${extractMetaContent(html, "property", "og:description")}]`);
  check("no raw <b> in title tag", !(extractTitle(html) || "").startsWith("<b>"));
  check("no script injection", !html.includes("<script>Hack"));
});

// 12. context.next() failure → fallback to origin /index.html fetch
await suite("context.next() failure → origin index.html fetch", async () => {
  const ev = EVENTS["evt_3e09f460d0"];
  const routes = {
    [eventRoute("evt_3e09f460d0")]: { type: "ok", data: ev },
    [`${SITE}/index.html`]: { type: "html", html: INDEX_HTML },
  };
  const fetchMock = makeFetch(routes);
  const { handler } = loadHandler(fetchMock);
  const ctx = makeContext({ throwNext: true });
  const res = await handler(new Request(`${SITE}/event/evt_3e09f460d0`), ctx);
  const html = await res.text();
  check("origin-fallback og:title", extractMetaContent(html, "property", "og:title") === ev.title);
  check("origin-fallback og:image", extractMetaContent(html, "property", "og:image") === CLOUDINARY_IMG);
  check("origin-fallback React root", html.includes('<div id="root"></div>'));
});

// 13. Config export intact
await suite("Config export", async () => {
  const { config } = loadHandler(makeFetch({}));
  check("config.path === /event/*", config.path === "/event/*", `[${JSON.stringify(config)}]`);
});

// ---- Summary ----
console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
