/**
 * Image Finder behaviour — expiry in India time, batch duplicate detection,
 * preview quality warnings, load failures, and the "same image on several
 * events" cleanup section.
 *
 * Rendering approach: the repo has no @testing-library dependency (and this
 * work adds none), so components are mounted with react-dom/client inside
 * React.act and queried through plain DOM APIs. Network is mocked at the axios
 * wrapper (`@/lib/api`) and sonner is mocked so toasts are observable.
 */

const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const XLSX = require("xlsx");

jest.mock("@/lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const { api } = require("@/lib/api");
const { toast } = require("sonner");
const ImageFinderModule = require("./ImageFinder");

const ImageFinder = ImageFinderModule.default;
const { imageKey, qualityWarnings, applyDuplicateFlags } = ImageFinderModule;

global.IS_REACT_ACT_ENVIRONMENT = true;

const FAR_FUTURE = "2999-01-01";
const PAST = "2024-01-01";

let container;
let root;

beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

/** Let mocked promises and React state updates settle. */
const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const renderFinder = async (events) => {
  api.get.mockResolvedValue({ data: events });
  await act(async () => {
    root.render(React.createElement(ImageFinder));
  });
  await settle();
};

const byTestId = (id) => container.querySelector(`[data-testid="${id}"]`);
const allByTestId = (id) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
const click = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
};

const candidateImages = () =>
  Array.from(container.querySelectorAll('img[alt="Candidate poster preview"]'));

const fireLoad = async (img, width, height) => {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  await act(async () => {
    img.dispatchEvent(new Event("load", { bubbles: false }));
  });
  await settle(2);
};

const fireError = async (img) => {
  await act(async () => {
    img.dispatchEvent(new Event("error", { bubbles: false }));
  });
  await settle(2);
};

/* ------------------------------------------------------------------------- */
/* Pure helpers                                                               */
/* ------------------------------------------------------------------------- */

describe("imageKey", () => {
  test("ignores the query string, the hash and surrounding whitespace", () => {
    expect(imageKey(" https://cdn.test/poster.jpg?w=1200 ")).toBe("https://cdn.test/poster.jpg");
    expect(imageKey("https://cdn.test/poster.jpg#top")).toBe("https://cdn.test/poster.jpg");
    expect(imageKey("https://cdn.test/poster.jpg")).toBe("https://cdn.test/poster.jpg");
  });

  test("different assets stay different; empty input is empty", () => {
    expect(imageKey("https://cdn.test/a.jpg")).not.toBe(imageKey("https://cdn.test/b.jpg"));
    expect(imageKey("")).toBe("");
    expect(imageKey("   ")).toBe("");
    expect(imageKey(null)).toBe("");
    expect(imageKey(undefined)).toBe("");
  });
});

describe("qualityWarnings", () => {
  test("flags narrow images as low resolution", () => {
    expect(qualityWarnings({ width: 399, height: 300 })).toEqual([
      { key: "low-resolution", label: "Low resolution" },
    ]);
    expect(qualityWarnings({ width: 400, height: 300 })).toEqual([]);
  });

  test("flags very wide images as banner strips", () => {
    expect(qualityWarnings({ width: 3000, height: 900 })).toEqual([
      { key: "very-wide", label: "Very wide, may be a banner strip" },
    ]);
    // exactly 3:1 is not MORE than 3
    expect(qualityWarnings({ width: 3000, height: 1000 })).toEqual([]);
  });

  test("a normal poster has no warnings", () => {
    expect(qualityWarnings({ width: 1600, height: 900 })).toEqual([]);
  });

  test("unknown dimensions warn about nothing", () => {
    expect(qualityWarnings(null)).toEqual([]);
    expect(qualityWarnings({ width: 0, height: 0 })).toEqual([]);
    expect(qualityWarnings({ width: NaN, height: 10 })).toEqual([]);
  });
});

describe("applyDuplicateFlags", () => {
  const result = (url) => ({ status: "done", data: { alternatives: [url] }, idx: 0, natural: null });

  test("flags the same URL found for two events, ignoring the query string", () => {
    const flagged = applyDuplicateFlags({
      a: result("https://cdn.test/logo.png?w=1"),
      b: result("https://cdn.test/logo.png?w=2"),
      c: result("https://cdn.test/poster.jpg"),
    });
    expect(flagged.a.duplicateCount).toBe(2);
    expect(flagged.b.duplicateCount).toBe(2);
    expect(flagged.c.duplicateCount).toBe(1);
  });

  test("different URLs are not flagged", () => {
    const flagged = applyDuplicateFlags({
      a: result("https://cdn.test/a.jpg"),
      b: result("https://cdn.test/b.jpg"),
    });
    expect(flagged.a.duplicateCount).toBe(1);
    expect(flagged.b.duplicateCount).toBe(1);
  });
});

/* ------------------------------------------------------------------------- */
/* Section A — expired events never appear                                    */
/* ------------------------------------------------------------------------- */

describe("Section A — expiry in India time", () => {
  test("hides expired events and says how many it hid", async () => {
    await renderFinder([
      { event_id: "old", title: "Old", event_date: PAST, image_url: "", external_link: "https://x.test/old" },
      { event_id: "live", title: "Live", event_date: FAR_FUTURE, image_url: "", external_link: "https://x.test/live" },
    ]);

    expect(byTestId("imagefinder-row-live")).not.toBeNull();
    expect(byTestId("imagefinder-row-old")).toBeNull();
    expect(byTestId("imagefinder-expired-hidden").textContent).toBe("1 expired event hidden");
  });

  test("says nothing when no event is expired", async () => {
    await renderFinder([
      { event_id: "live", title: "Live", event_date: FAR_FUTURE, image_url: "", external_link: "https://x.test/live" },
    ]);
    expect(byTestId("imagefinder-expired-hidden")).toBeNull();
  });

  test("'Find all missing images' only processes the listed (non-expired) rows", async () => {
    api.post.mockResolvedValue({
      data: { image_url: "https://cdn.test/p.jpg", alternatives: ["https://cdn.test/p.jpg"], source: "og:image" },
    });
    await renderFinder([
      { event_id: "old", title: "Old", event_date: PAST, image_url: "", external_link: "https://x.test/old" },
      { event_id: "live", title: "Live", event_date: FAR_FUTURE, image_url: "", external_link: "https://x.test/live" },
    ]);

    await click(byTestId("imagefinder-find-all"));

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][1]).toEqual({ url: "https://x.test/live" });
  });
});

/* ------------------------------------------------------------------------- */
/* Section A — batch duplicate detection + quality badges                     */
/* ------------------------------------------------------------------------- */

const liveEvent = (id, link, overrides = {}) => ({
  event_id: id,
  title: `Event ${id}`,
  event_date: FAR_FUTURE,
  image_url: "",
  external_link: link,
  ...overrides,
});

describe("Section A — batch duplicate detection", () => {
  test("the same image found for 2 events is flagged and its button says 'Use anyway'", async () => {
    api.post.mockImplementation((_path, body) => {
      const url = body.url.endsWith("/a") ? "https://cdn.test/logo.png?w=1" : "https://cdn.test/logo.png?w=2";
      return Promise.resolve({ data: { image_url: url, alternatives: [url], source: "og:image" } });
    });
    await renderFinder([liveEvent("a", "https://x.test/a"), liveEvent("b", "https://x.test/b")]);

    await click(byTestId("imagefinder-find-all"));

    const badges = allByTestId("imagefinder-result-a-duplicate-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toContain(
      "Same image found for 2 events, probably a site logo or default banner"
    );
    expect(byTestId("imagefinder-result-b-duplicate-badge")).not.toBeNull();
    expect(byTestId("imagefinder-result-a-use").textContent).toContain("Use anyway");
  });

  test("different images are not flagged", async () => {
    api.post.mockImplementation((_path, body) => {
      const url = `https://cdn.test/${body.url.split("/").pop()}.jpg`;
      return Promise.resolve({ data: { image_url: url, alternatives: [url], source: "og:image" } });
    });
    await renderFinder([liveEvent("a", "https://x.test/a"), liveEvent("b", "https://x.test/b")]);

    await click(byTestId("imagefinder-find-all"));

    expect(byTestId("imagefinder-result-a-duplicate-badge")).toBeNull();
    expect(byTestId("imagefinder-result-b-duplicate-badge")).toBeNull();
    expect(byTestId("imagefinder-result-a-use").textContent).toContain("Use this image");
  });

  test("flagged results sort below the genuine ones", async () => {
    api.post.mockImplementation((_path, body) => {
      const last = body.url.split("/").pop();
      const url = last === "c" ? "https://cdn.test/unique.jpg" : "https://cdn.test/logo.png";
      return Promise.resolve({ data: { image_url: url, alternatives: [url], source: "og:image" } });
    });
    await renderFinder([
      liveEvent("a", "https://x.test/a"),
      liveEvent("b", "https://x.test/b"),
      liveEvent("c", "https://x.test/c"),
    ]);

    await click(byTestId("imagefinder-find-all"));

    const order = Array.from(
      container.querySelectorAll('[data-testid^="imagefinder-row-"]')
    ).map((el) => el.getAttribute("data-testid"));
    expect(order[0]).toBe("imagefinder-row-c");
    expect(order.slice(1).sort()).toEqual(["imagefinder-row-a", "imagefinder-row-b"]);
  });
});

describe("Section A — preview quality badges and button labels", () => {
  const single = async (width, height) => {
    api.post.mockResolvedValue({
      data: {
        image_url: "https://cdn.test/p.jpg",
        alternatives: ["https://cdn.test/p.jpg"],
        source: "og:image",
      },
    });
    await renderFinder([liveEvent("a", "https://x.test/a")]);
    await click(byTestId("imagefinder-find-a"));
    const img = candidateImages()[0];
    await fireLoad(img, width, height);
  };

  test("a low-resolution image is flagged and the label becomes 'Use anyway'", async () => {
    await single(300, 200);
    expect(byTestId("imagefinder-result-a-quality-low-resolution").textContent).toContain(
      "Low resolution"
    );
    expect(byTestId("imagefinder-result-a-use").textContent).toContain("Use anyway");
  });

  test("a very wide image is flagged as a banner strip", async () => {
    await single(2400, 600);
    expect(byTestId("imagefinder-result-a-quality-very-wide").textContent).toContain(
      "Very wide, may be a banner strip"
    );
    expect(byTestId("imagefinder-result-a-use").textContent).toContain("Use anyway");
  });

  test("a good landscape poster keeps the normal label and shows no warnings", async () => {
    await single(1600, 900);
    expect(byTestId("imagefinder-result-a-quality-low-resolution")).toBeNull();
    expect(byTestId("imagefinder-result-a-quality-very-wide")).toBeNull();
    expect(byTestId("imagefinder-result-a-use").textContent).toContain("Use this image");
    expect(byTestId("imagefinder-orientation-badge").textContent).toContain("Landscape");
  });

  test("warnings never block saving: the primary button still calls PUT", async () => {
    await single(300, 200);
    api.put.mockResolvedValue({ data: {} });
    await click(byTestId("imagefinder-result-a-use"));
    expect(api.put).toHaveBeenCalledWith("/events/a", { image_url: "https://cdn.test/p.jpg" });
  });
});

describe("Section A — the site's own default image", () => {
  test("explains that the page only has a logo and asks for a pasted link", async () => {
    api.post.mockResolvedValue({
      data: { image_url: null, alternatives: [], source: null, reason: "site_default_image" },
    });
    await renderFinder([liveEvent("a", "https://x.test/a")]);
    await click(byTestId("imagefinder-find-a"));

    expect(byTestId("imagefinder-result-a-note").textContent).toContain(
      "This page only has the site's default logo, not a poster for this event. Paste an image link instead."
    );
    // the paste field is still the next step
    expect(byTestId("imagefinder-result-a-paste")).not.toBeNull();
  });
});

describe("Section A — a preview the browser cannot load", () => {
  test("shows the honest note instead of a broken image", async () => {
    api.post.mockResolvedValue({
      data: {
        image_url: "https://cdn.test/blocked.jpg",
        alternatives: ["https://cdn.test/blocked.jpg"],
        source: "og:image",
      },
    });
    await renderFinder([liveEvent("a", "https://x.test/a")]);
    await click(byTestId("imagefinder-find-a"));
    await fireError(candidateImages()[0]);

    expect(byTestId("imagefinder-result-a-preview-note").textContent).toContain(
      "The image link was found but your browser could not load it. Try another image or paste a link."
    );
    // the broken <img> is gone, replaced by a flat block
    expect(byTestId("imagefinder-result-a").querySelector("img")).toBeNull();
    expect(byTestId("imagefinder-result-a-preview-unavailable")).not.toBeNull();
  });
});

describe("every preview image is hotlink-safe and lazy", () => {
  test("candidate previews send no Referer and decode asynchronously", async () => {
    api.post.mockResolvedValue({
      data: {
        image_url: "https://cdn.test/p.jpg",
        alternatives: ["https://cdn.test/p.jpg"],
        source: "og:image",
      },
    });
    await renderFinder([liveEvent("a", "https://x.test/a")]);
    await click(byTestId("imagefinder-find-a"));

    const img = candidateImages()[0];
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("src")).toBe("https://cdn.test/p.jpg");
  });
});

/* ------------------------------------------------------------------------- */
/* Section B — spreadsheet rows                                               */
/* ------------------------------------------------------------------------- */

const sheetBytes = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Events");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
};

const SHEET_ROWS = [
  ["title", "event_date", "external_link", "image_url"],
  ["Already happened", PAST, "https://x.test/old", ""],
  ["Still upcoming", FAR_FUTURE, "https://x.test/live", ""],
  ["Date unclear", "TBA", "https://x.test/unclear", ""],
];

const uploadSheet = async (rows = SHEET_ROWS) => {
  const input = byTestId("imagefinder-sheet-input");
  const file = { name: "events.xlsx", arrayBuffer: async () => sheetBytes(rows) };
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
};

describe("Section B — expiry before any lookup", () => {
  test("an expired row is skipped, noted, and excluded from the counts", async () => {
    await renderFinder([]);
    await uploadSheet();

    expect(byTestId("imagefinder-sheet-expired-0").textContent).toContain(
      "Event date has passed, skipped"
    );
    expect(byTestId("imagefinder-sheet-find-row-0")).toBeNull();
    expect(byTestId("imagefinder-sheet-summary").textContent).toContain("2 of 3 rows need an image");
  });

  test("a row with an unparseable date is processed normally with a 'Date unclear' note", async () => {
    await renderFinder([]);
    await uploadSheet();

    expect(byTestId("imagefinder-sheet-unclear-2").textContent).toContain("Date unclear");
    expect(byTestId("imagefinder-sheet-find-row-2")).not.toBeNull();
  });

  test("a sheet run never looks anything up for the expired row", async () => {
    api.post.mockResolvedValue({
      data: { image_url: "https://cdn.test/p.jpg", alternatives: ["https://cdn.test/p.jpg"] },
    });
    await renderFinder([]);
    await uploadSheet();
    await click(byTestId("imagefinder-sheet-find"));

    const urls = api.post.mock.calls.map(([, body]) => body.url);
    expect(urls).not.toContain("https://x.test/old");
    expect(urls.sort()).toEqual(["https://x.test/live", "https://x.test/unclear"]);
  });

  test("the downloaded sheet leaves skipped rows exactly as uploaded", async () => {
    await renderFinder([]);
    await uploadSheet();

    const RealBlob = global.Blob;
    let captured = null;
    global.Blob = function CaptureBlob(parts, opts) {
      captured = parts[0];
      return new RealBlob(parts, opts);
    };
    const createObjectURL = jest.fn(() => "blob:test");
    const revokeObjectURL = jest.fn();
    const originalCreate = global.URL.createObjectURL;
    const originalRevoke = global.URL.revokeObjectURL;
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const anchorClick = jest
      .spyOn(global.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      await click(byTestId("imagefinder-sheet-download"));
    } finally {
      anchorClick.mockRestore();
      global.URL.createObjectURL = originalCreate;
      global.URL.revokeObjectURL = originalRevoke;
      global.Blob = RealBlob;
    }

    expect(createObjectURL).toHaveBeenCalled();
    const out = XLSX.read(new Uint8Array(captured), { type: "array" });
    const aoa = XLSX.utils.sheet_to_json(out.Sheets[out.SheetNames[0]], {
      header: 1,
      raw: false,
      defval: "",
    });
    expect(aoa[0]).toEqual(SHEET_ROWS[0]);
    expect(aoa[1]).toEqual(SHEET_ROWS[1]); // expired row unchanged
    expect(aoa.slice(1).map((row) => row[3])).toEqual(["", "", ""]);
  });
});

/* ------------------------------------------------------------------------- */
/* Section C — same image on several events                                   */
/* ------------------------------------------------------------------------- */

const sharedEvents = [
  {
    event_id: "a1",
    title: "First event",
    event_date: FAR_FUTURE,
    image_url: "https://cdn.test/shared.png?w=800",
  },
  {
    event_id: "a2",
    title: "Second event",
    event_date: FAR_FUTURE,
    image_url: " https://cdn.test/shared.png?w=1600 ",
  },
  {
    event_id: "b1",
    title: "Own poster",
    event_date: FAR_FUTURE,
    image_url: "https://cdn.test/own.jpg",
  },
  { event_id: "c1", title: "No image", event_date: FAR_FUTURE, image_url: "" },
  { event_id: "c2", title: "Blank image", event_date: FAR_FUTURE, image_url: "   " },
  {
    event_id: "old1",
    title: "Expired duplicate",
    event_date: PAST,
    image_url: "https://cdn.test/shared.png?w=99",
  },
];

describe("Section C — shared images", () => {
  test("groups by URL ignoring query strings and empty values", async () => {
    await renderFinder(sharedEvents);

    const groups = container.querySelectorAll('[data-testid^="imagefinder-shared-group-"]');
    expect(groups).toHaveLength(1);
    expect(groups[0].textContent).toContain("Used by 2 events");
    expect(groups[0].textContent).toContain("First event");
    expect(groups[0].textContent).toContain("Second event");
    // a single-event image and an expired duplicate are never listed
    expect(container.textContent).not.toContain("Own poster");
    expect(container.textContent).not.toContain("Expired duplicate");
  });

  test("the thumbnail never sends a Referer", async () => {
    await renderFinder(sharedEvents);
    const img = container.querySelector('img[alt="Image used by several events"]');
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  test("Remove asks first, then clears image_url on every event in the group", async () => {
    api.put.mockResolvedValue({ data: {} });
    await renderFinder(sharedEvents);

    const removeBtn = byTestId("imagefinder-shared-remove-https://cdn.test/shared.png");
    expect(removeBtn.textContent).toContain("Remove from all 2 events");
    await click(removeBtn);

    expect(byTestId("imagefinder-shared-confirm").textContent).toContain(
      "Remove this image from 2 events? The events keep everything else and will need a new poster."
    );
    expect(api.put).not.toHaveBeenCalled(); // nothing happens until confirmed

    await click(byTestId("imagefinder-shared-confirm-btn"));

    expect(api.put).toHaveBeenCalledTimes(2);
    expect(api.put).toHaveBeenCalledWith("/events/a1", { image_url: "" });
    expect(api.put).toHaveBeenCalledWith("/events/a2", { image_url: "" });
    expect(toast.success).toHaveBeenCalledWith("Image removed from 2 events");
    expect(byTestId("imagefinder-shared-empty")).not.toBeNull();
  });

  test("Cancel makes no calls and keeps the group", async () => {
    await renderFinder(sharedEvents);

    await click(byTestId("imagefinder-shared-remove-https://cdn.test/shared.png"));
    await click(byTestId("imagefinder-shared-cancel"));

    expect(api.put).not.toHaveBeenCalled();
    expect(byTestId("imagefinder-shared-confirm")).toBeNull();
    expect(
      byTestId("imagefinder-shared-group-https://cdn.test/shared.png")
    ).not.toBeNull();
  });

  test("Keep removes the group from the list without writing anything", async () => {
    await renderFinder(sharedEvents);
    await click(byTestId("imagefinder-shared-keep-https://cdn.test/shared.png"));

    expect(api.put).not.toHaveBeenCalled();
    expect(byTestId("imagefinder-shared-empty")).not.toBeNull();
  });

  test("shows the quiet empty state when nothing is shared", async () => {
    await renderFinder([
      { event_id: "solo", title: "Solo", event_date: FAR_FUTURE, image_url: "https://cdn.test/one.jpg" },
      { event_id: "none", title: "None", event_date: FAR_FUTURE, image_url: "" },
    ]);
    expect(byTestId("imagefinder-shared-empty").textContent).toBe(
      "No image is shared between events."
    );
  });
});
