/**
 * Image fallback tests — a REGRESSION LOCK on a read-only file.
 *
 * `src/lib/image-fallback.js` was declared out of bounds for the entire
 * design-system rollout ("image selection logic must stay untouched"). These
 * tests exist so that guarantee is enforced mechanically rather than by
 * memory: if the selection priority, the dedup behaviour or the render-time
 * fallback ever changes, this file fails.
 *
 * The most important assertion is the last group — that the onError handler
 * swaps only the displayed <img> src and never writes back to the event object,
 * which is what keeps a stock placeholder out of the database, the Excel
 * export and the API payload.
 */

const {
  MIN_LANDSCAPE_RATIO,
  STOCK_IMAGE_POOL,
  assignEventImages,
  eventImageHandlers,
  pickEventImage,
  pickStockImage,
} = require("./image-fallback");

const REAL_A = "https://cdn.example.com/real-a.jpg";
const REAL_B = "https://cdn.example.com/real-b.jpg";

const ev = (id, image_url) => ({ event_id: id, image_url });

describe("the stock pool", () => {
  test("is eight unique pre-vetted landscape images", () => {
    expect(STOCK_IMAGE_POOL).toHaveLength(8);
    expect(new Set(STOCK_IMAGE_POOL).size).toBe(8);
    for (const url of STOCK_IMAGE_POOL) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain("w=1600");
      expect(url).toContain("h=900");
    }
  });

  test("accepts 16:9 and 4:3 posters but rejects square and portrait", () => {
    expect(MIN_LANDSCAPE_RATIO).toBe(1.2);
    expect(16 / 9).toBeGreaterThan(MIN_LANDSCAPE_RATIO);
    expect(4 / 3).toBeGreaterThan(MIN_LANDSCAPE_RATIO);
    expect(1).toBeLessThan(MIN_LANDSCAPE_RATIO);
    expect(9 / 16).toBeLessThan(MIN_LANDSCAPE_RATIO);
  });
});

describe("pickStockImage", () => {
  test("is deterministic for a given event_id", () => {
    const first = pickStockImage(ev("evt-42"), new Set());
    const second = pickStockImage(ev("evt-42"), new Set());
    expect(first).toBe(second);
    expect(STOCK_IMAGE_POOL).toContain(first);
  });

  test("marks the image as used so the next pick differs", () => {
    const used = new Set();
    const a = pickStockImage(ev("evt-1"), used);
    const b = pickStockImage(ev("evt-2"), used);
    expect(used.has(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  test("tolerates a missing or non-Set used collection", () => {
    expect(STOCK_IMAGE_POOL).toContain(pickStockImage(ev("evt-9"), undefined));
    expect(STOCK_IMAGE_POOL).toContain(pickStockImage(ev("evt-9"), "not a set"));
    expect(STOCK_IMAGE_POOL).toContain(pickStockImage(null, new Set()));
  });

  test("still returns something once the pool is exhausted (never undefined)", () => {
    const used = new Set(STOCK_IMAGE_POOL);
    expect(STOCK_IMAGE_POOL).toContain(pickStockImage(ev("evt-7"), used));
  });
});

describe("assignEventImages — selection priority", () => {
  test("a real image is used for its first occurrence, preserved exactly", () => {
    const { map } = assignEventImages([ev("1", REAL_A), ev("2", REAL_B)]);
    expect(map.get("1")).toBe(REAL_A);
    expect(map.get("2")).toBe(REAL_B);
  });

  test("a later duplicate of the same real URL gets a stock image instead", () => {
    const { map } = assignEventImages([ev("1", REAL_A), ev("2", REAL_A)]);
    expect(map.get("1")).toBe(REAL_A);
    expect(map.get("2")).not.toBe(REAL_A);
    expect(STOCK_IMAGE_POOL).toContain(map.get("2"));
  });

  test("an empty or missing image_url gets a stock image", () => {
    const { map } = assignEventImages([
      ev("1", ""),
      ev("2", "   "),
      { event_id: "3" },
      ev("4", null),
    ]);
    for (const id of ["1", "2", "3", "4"]) {
      expect(STOCK_IMAGE_POOL).toContain(map.get(id));
    }
  });

  test("stock images never repeat within one list, until the pool runs out", () => {
    const events = Array.from({ length: 8 }, (_, i) => ev(`e${i}`, ""));
    const { map } = assignEventImages(events);
    const assigned = events.map((e) => map.get(e.event_id));
    expect(new Set(assigned).size).toBe(8);
  });

  test("beyond the pool size it keeps returning a valid image", () => {
    const events = Array.from({ length: 20 }, (_, i) => ev(`e${i}`, ""));
    const { map } = assignEventImages(events);
    for (const e of events) {
      expect(STOCK_IMAGE_POOL).toContain(map.get(e.event_id));
    }
  });

  test("the returned used-set also holds the real URLs, so a card fallback cannot steal one", () => {
    const { used } = assignEventImages([ev("1", REAL_A), ev("2", "")]);
    expect(used.has(REAL_A)).toBe(true);
  });

  test("skips entries with no event_id rather than colliding on undefined", () => {
    const { map } = assignEventImages([ev("1", REAL_A), { image_url: REAL_B }, null]);
    expect(map.size).toBe(1);
    expect(map.has(undefined)).toBe(false);
  });

  test("tolerates an empty or missing list", () => {
    expect(assignEventImages([]).map.size).toBe(0);
    expect(assignEventImages(null).map.size).toBe(0);
    expect(assignEventImages(undefined).map.size).toBe(0);
  });
});

describe("assignEventImages — purity (StrictMode double-render safety)", () => {
  const build = () => [ev("1", REAL_A), ev("2", REAL_A), ev("3", ""), { event_id: "4" }];

  test("never mutates the events it was given", () => {
    const events = build();
    const before = JSON.stringify(events);
    assignEventImages(events);
    expect(JSON.stringify(events)).toBe(before);
  });

  test("returns the same assignment when called twice on the same list", () => {
    const a = assignEventImages(build()).map;
    const b = assignEventImages(build()).map;
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test("creates its own used-set, so two lists do not interfere", () => {
    const first = assignEventImages([ev("x", "")]);
    const second = assignEventImages([ev("x", "")]);
    expect(first.map.get("x")).toBe(second.map.get("x"));
  });
});

describe("pickEventImage (single-event legacy path)", () => {
  test("prefers a real image and records it in the caller's used-set", () => {
    const used = new Set();
    expect(pickEventImage(ev("1", REAL_A), used)).toBe(REAL_A);
    expect(used.has(REAL_A)).toBe(true);
  });

  test("a second call with the same URL falls back to stock", () => {
    const used = new Set();
    pickEventImage(ev("1", REAL_A), used);
    const second = pickEventImage(ev("2", REAL_A), used);
    expect(second).not.toBe(REAL_A);
    expect(STOCK_IMAGE_POOL).toContain(second);
  });

  test("trims surrounding whitespace from a stored URL", () => {
    expect(pickEventImage(ev("1", `  ${REAL_A}  `), new Set())).toBe(REAL_A);
  });

  test("tolerates a missing used-set", () => {
    expect(pickEventImage(ev("1", REAL_A), undefined)).toBe(REAL_A);
  });
});

describe("eventImageHandlers — the display-only contract", () => {
  test("uses the list-level preferredSrc when one is supplied", () => {
    const { src } = eventImageHandlers(ev("1", REAL_A), new Set(), REAL_B);
    expect(src).toBe(REAL_B);
  });

  test("falls back to single-event selection when no preferredSrc is given", () => {
    const { src } = eventImageHandlers(ev("1", REAL_A), new Set());
    expect(src).toBe(REAL_A);
  });

  test("onError swaps ONLY the <img> src — the event object is never written to", () => {
    const event = ev("1", REAL_A);
    const snapshot = JSON.stringify(event);
    const { onError } = eventImageHandlers(event, new Set());

    const img = { src: REAL_A };
    onError({ currentTarget: img });

    expect(STOCK_IMAGE_POOL).toContain(img.src);
    expect(event.image_url).toBe(REAL_A);
    expect(JSON.stringify(event)).toBe(snapshot);
  });

  test("onError is a no-op when the image already shows that fallback", () => {
    const used = new Set();
    const event = ev("1", "");

    // preferredSrc is supplied so that building the handlers does not itself
    // consume an entry from `used`; the fallback onError picks must therefore
    // be the event's first stock image, which is what img.src already shows.
    const { onError } = eventImageHandlers(event, used, REAL_A);
    const expected = pickStockImage(event, new Set());
    expect(used.size).toBe(0);

    const img = { src: expected };
    onError({ currentTarget: img });
    expect(img.src).toBe(expected);
  });

  test("onError moves to a DIFFERENT stock image when the first one also fails", () => {
    const used = new Set();
    const event = ev("1", "");
    const { onError } = eventImageHandlers(event, used, REAL_A);

    const first = pickStockImage(event, new Set());
    const img = { src: REAL_A };
    onError({ currentTarget: img });
    expect(img.src).toBe(first);

    onError({ currentTarget: img });
    expect(img.src).not.toBe(first);
    expect(STOCK_IMAGE_POOL).toContain(img.src);
  });

  test("onError survives a malformed event argument", () => {
    const { onError } = eventImageHandlers(ev("1", REAL_A), new Set());
    expect(() => onError(null)).not.toThrow();
    expect(() => onError({})).not.toThrow();
  });

  test("onLoad never re-validates a stock image (that would loop forever)", () => {
    const event = ev("1", "");
    const used = new Set();
    const stock = pickStockImage(event, new Set());
    const { onLoad } = eventImageHandlers(event, used);

    // A square stock image would otherwise be rejected and swapped again.
    const img = { src: stock, naturalWidth: 100, naturalHeight: 100 };
    onLoad({ currentTarget: img });
    expect(img.src).toBe(stock);
  });

  test("onLoad replaces a real image that turns out to be portrait", () => {
    const event = ev("1", REAL_A);
    const { onLoad } = eventImageHandlers(event, new Set());
    const img = { src: REAL_A, naturalWidth: 900, naturalHeight: 1600 };

    onLoad({ currentTarget: img });
    expect(STOCK_IMAGE_POOL).toContain(img.src);
    expect(event.image_url).toBe(REAL_A);
  });

  test("onLoad keeps a real landscape image untouched", () => {
    const event = ev("1", REAL_A);
    const { onLoad } = eventImageHandlers(event, new Set());
    const img = { src: REAL_A, naturalWidth: 1600, naturalHeight: 900 };

    onLoad({ currentTarget: img });
    expect(img.src).toBe(REAL_A);
  });

  test("onLoad does nothing before the browser knows the natural size", () => {
    const event = ev("1", REAL_A);
    const { onLoad } = eventImageHandlers(event, new Set());
    const img = { src: REAL_A, naturalWidth: 0, naturalHeight: 0 };

    onLoad({ currentTarget: img });
    expect(img.src).toBe(REAL_A);

    expect(() => onLoad(null)).not.toThrow();
    expect(() => onLoad({})).not.toThrow();
  });
});
