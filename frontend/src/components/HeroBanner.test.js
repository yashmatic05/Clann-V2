/**
 * HeroBanner — real, wide, upcoming event images only.
 *
 * Two layers are tested:
 *   1. the pure selection rules (orderHeroCandidates / isHeroWorthy), which
 *      decide what may become a slide at all;
 *   2. the mounted component, with `window.Image` replaced by a fake preloader
 *      so "did this image load, and is it wide enough?" can be scripted without
 *      any network access.
 *
 * The hero must never show a placeholder or a stock photo, and must render
 * nothing at all when no candidate passes.
 */

const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");

/* react-router-dom 7.15's published package points `main` at dist/main.js,
 * which the tarball does not contain, so Jest's CJS resolver cannot load it
 * (webpack uses the `exports` map and is unaffected). A virtual mock of the one
 * hook the hero needs is enough here and keeps this test dependency-free. */
jest.mock("react-router-dom", () => ({ useNavigate: () => () => {} }), { virtual: true });

const HeroBanner = require("./HeroBanner").default;
const { orderHeroCandidates, isHeroWorthy, HERO_MAX_SLIDES } = require("./HeroBanner");

global.IS_REACT_ACT_ENVIRONMENT = true;

const LIVE = "2999-01-01";
const PAST = "2024-01-01";

const ev = (id, overrides = {}) => ({
  event_id: id,
  title: `Event ${id}`,
  image_url: `https://cdn.example.test/${id}.jpg`,
  event_date: LIVE,
  featured: false,
  ...overrides,
});

describe("orderHeroCandidates", () => {
  test("drops events with no image, a whitespace image, or a stock image", () => {
    const out = orderHeroCandidates([
      ev("none", { image_url: "" }),
      ev("blank", { image_url: "   " }),
      ev("stock", { image_url: "https://images.unsplash.com/photo-1?w=1600" }),
      ev("real"),
    ]);
    expect(out.map((e) => e.event_id)).toEqual(["real"]);
  });

  test("drops expired events", () => {
    const out = orderHeroCandidates([ev("old", { event_date: PAST }), ev("live")]);
    expect(out.map((e) => e.event_id)).toEqual(["live"]);
  });

  test("featured events come first, then the rest by soonest date", () => {
    const out = orderHeroCandidates([
      ev("later", { event_date: "2999-06-01" }),
      ev("featured", { event_date: "2999-09-01", featured: true }),
      ev("sooner", { event_date: "2999-02-01" }),
    ]);
    expect(out.map((e) => e.event_id)).toEqual(["featured", "sooner", "later"]);
  });

  test("does not require featured === true any more", () => {
    const out = orderHeroCandidates([ev("ordinary")]);
    expect(out).toHaveLength(1);
  });

  test("is capped at 5 slides", () => {
    const many = Array.from({ length: 9 }, (_, i) => ev(`e${i}`, { event_date: `2999-01-0${i + 1}` }));
    expect(orderHeroCandidates(many)).toHaveLength(HERO_MAX_SLIDES);
    expect(HERO_MAX_SLIDES).toBe(5);
  });

  test("tolerates an empty or missing list", () => {
    expect(orderHeroCandidates([])).toEqual([]);
    expect(orderHeroCandidates(null)).toEqual([]);
    expect(orderHeroCandidates(undefined)).toEqual([]);
  });
});

describe("isHeroWorthy", () => {
  test("needs at least 800px of width and a 1.5 ratio", () => {
    expect(isHeroWorthy(1600, 900)).toBe(true);
    expect(isHeroWorthy(800, 500)).toBe(true);
    expect(isHeroWorthy(799, 400)).toBe(false); // too small
    expect(isHeroWorthy(1600, 1200)).toBe(false); // 1.33, too square
    expect(isHeroWorthy(900, 1600)).toBe(false); // portrait
    expect(isHeroWorthy(0, 0)).toBe(false);
    expect(isHeroWorthy(NaN, 900)).toBe(false);
  });
});

/* ------------------------------------------------------------------------- */
/* Mounted component                                                         */
/* ------------------------------------------------------------------------- */

const DIMENSIONS = {};
const RealImage = global.Image;

class FakeImage {
  constructor() {
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
    this._src = "";
    this.referrerPolicy = "";
  }

  set src(value) {
    this._src = value;
    const dims = DIMENSIONS[value];
    setTimeout(() => {
      if (dims) {
        this.naturalWidth = dims[0];
        this.naturalHeight = dims[1];
        if (this.onload) this.onload();
      } else if (this.onerror) {
        this.onerror();
      }
    }, 0);
  }

  get src() {
    return this._src;
  }
}

let container;
let root;

beforeEach(() => {
  Object.keys(DIMENSIONS).forEach((key) => delete DIMENSIONS[key]);
  global.Image = FakeImage;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  global.Image = RealImage;
});

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const mount = async (events) => {
  await act(async () => {
    root.render(React.createElement(HeroBanner, { events }));
  });
};

const byTestId = (id) => container.querySelector(`[data-testid="${id}"]`);

describe("mounted hero", () => {
  test("shows only the images that load and are wide enough", async () => {
    DIMENSIONS["https://cdn.example.test/wide.jpg"] = [1600, 900];
    DIMENSIONS["https://cdn.example.test/tall.jpg"] = [900, 1600];
    DIMENSIONS["https://cdn.example.test/small.jpg"] = [400, 225];

    await mount([
      ev("wide"),
      ev("tall"),
      ev("small"),
      ev("broken", { image_url: "https://cdn.example.test/broken.jpg" }),
    ]);
    await settle();

    expect(byTestId("hero-banner")).not.toBeNull();
    expect(byTestId("hero-slide-0")).not.toBeNull();
    expect(byTestId("hero-slide-1")).toBeNull();
    expect(byTestId("hero-slide-2")).toBeNull();

    const slides = container.querySelectorAll('[data-testid^="hero-slide-"]');
    expect(slides).toHaveLength(1);
    expect(slides[0].querySelector("img").getAttribute("src")).toBe(
      "https://cdn.example.test/wide.jpg"
    );
  });

  test("never renders a placeholder or a stock image", async () => {
    DIMENSIONS["https://cdn.example.test/wide.jpg"] = [1600, 900];
    await mount([
      ev("wide"),
      ev("stock", { image_url: "https://images.unsplash.com/photo-9?w=1600" }),
      ev("none", { image_url: "" }),
    ]);
    await settle();
    expect(container.innerHTML).not.toContain("unsplash");
    expect(container.innerHTML).not.toContain("event-image-placeholder");
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  test("a slide image sends no Referer", async () => {
    DIMENSIONS["https://cdn.example.test/wide.jpg"] = [1600, 900];
    await mount([ev("wide")]);
    await settle();
    const img = container.querySelector('[data-testid="hero-slide-0"] img');
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  test("hides itself entirely when nothing passes", async () => {
    DIMENSIONS["https://cdn.example.test/tall.jpg"] = [900, 1600];
    DIMENSIONS["https://cdn.example.test/small.jpg"] = [400, 225];

    await mount([ev("tall"), ev("small")]);
    await settle();

    expect(byTestId("hero-banner")).toBeNull();
    expect(byTestId("hero-banner-loading")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  test("hides itself when there are no candidates at all", async () => {
    await mount([ev("old", { event_date: PAST }), ev("none", { image_url: "" })]);
    await settle();
    expect(container.innerHTML).toBe("");
  });

  test("shows a flat raised block while candidates load, then the real hero", async () => {
    DIMENSIONS["https://cdn.example.test/wide.jpg"] = [1600, 900];
    await mount([ev("wide")]);

    // Initial render: the preload has not resolved yet.
    const loading = byTestId("hero-banner-loading");
    expect(loading).not.toBeNull();
    expect(loading.textContent).toBe("");

    await settle();
    expect(byTestId("hero-banner-loading")).toBeNull();
    expect(byTestId("hero-banner")).not.toBeNull();
  });

  test("featured events lead the carousel", async () => {
    DIMENSIONS["https://cdn.example.test/featured.jpg"] = [1600, 900];
    DIMENSIONS["https://cdn.example.test/early.jpg"] = [1600, 900];

    await mount([
      ev("early", { event_date: "2999-01-01" }),
      ev("featured", { event_date: "2999-12-01", featured: true }),
    ]);
    await settle();

    const first = byTestId("hero-slide-0").querySelector("img");
    expect(first.getAttribute("src")).toBe("https://cdn.example.test/featured.jpg");
    expect(byTestId("hero-slide-1").querySelector("img").getAttribute("src")).toBe(
      "https://cdn.example.test/early.jpg"
    );
  });
});
