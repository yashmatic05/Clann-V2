/**
 * EventImage — the single authority for rendering an event image.
 *
 * The contract that matters most: the rendered `src` is ALWAYS the event's own
 * image_url (trimmed) or there is no image at all. Nothing in this component
 * may swap, dedupe, proxy or substitute a different URL, and a stock URL is
 * never displayed.
 *
 * Mounted with react-dom/client inside React.act (the repo has no
 * @testing-library dependency and this work adds none).
 */

const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");

const EventImage = require("./EventImage").default;
const { hasUsableImage } = require("@/lib/event-image");

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
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

const render = async (props) => {
  await act(async () => {
    root.render(React.createElement(EventImage, props));
  });
};

const fire = async (el, type) => {
  await act(async () => {
    el.dispatchEvent(new Event(type, { bubbles: false }));
  });
};

const withDimensions = (el, width, height) => {
  Object.defineProperty(el, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(el, "naturalHeight", { value: height, configurable: true });
};

const frame = () => container.querySelector('[data-testid="event-image"]');
const img = () => container.querySelector('[data-testid="event-image-img"]');
const placeholder = () => container.querySelector('[data-testid="event-image-placeholder"]');

const event = (overrides = {}) => ({
  event_id: "evt-1",
  title: "Watercolour meetup",
  category: "Workshop",
  image_url: "https://cdn.example.test/poster.jpg",
  ...overrides,
});

describe("placeholder states", () => {
  test("a blank image_url renders the flat category placeholder, not an <img>", async () => {
    await render({ event: event({ image_url: "" }) });
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
    expect(frame().getAttribute("role")).toBe("img");
    expect(frame().getAttribute("aria-label")).toBe("Workshop event, no poster yet");
    expect(frame().className).toContain("bg-raised");
    // the category name is spelled out at md and lg only
    expect(placeholder().textContent).toContain("Workshop");
  });

  test("a whitespace-only image_url is treated as empty", async () => {
    await render({ event: event({ image_url: "   " }) });
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  test("a stock-hosted image_url is never displayed", async () => {
    await render({ event: event({ image_url: "https://images.unsplash.com/photo-1?w=1600" }) });
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
    expect(container.innerHTML).not.toContain("unsplash");
  });

  test("a broken image falls back to the placeholder on error", async () => {
    await render({ event: event() });
    expect(img()).not.toBeNull();
    await fire(img(), "error");
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  test("the category picks the icon; anything unknown falls back to Calendar", async () => {
    const cases = [
      ["Hackathon", "hackathon"],
      ["Walk", "walk"],
      ["Art & Sketch", "art & sketch"],
      ["Conference", "conference"],
      ["Meetup", "meetup"],
      ["Something else", "something else"],
    ];
    for (const [category, expected] of cases) {
      // eslint-disable-next-line no-await-in-loop
      await render({ event: event({ category, image_url: "" }) });
      expect(placeholder().getAttribute("data-category")).toBe(expected);
      expect(placeholder().querySelector("svg")).not.toBeNull();
    }
  });

  test("small and large frames keep the same structure but different icon sizes", async () => {
    await render({ event: event({ image_url: "" }), size: "sm" });
    const sm = placeholder().querySelector("svg");
    expect(sm.getAttribute("width")).toBe("24");
    expect(placeholder().textContent).toBe(""); // no caption at sm

    await render({ event: event({ image_url: "" }), size: "lg" });
    expect(placeholder().querySelector("svg").getAttribute("width")).toBe("48");
    expect(placeholder().textContent).toContain("Workshop");
  });
});

describe("real images", () => {
  test("a landscape image fills the frame with object-cover", async () => {
    await render({ event: event(), className: "h-48 w-full" });
    withDimensions(img(), 1600, 900);
    await fire(img(), "load");
    expect(img().className).toContain("object-cover");
    expect(img().className).not.toContain("object-contain");
    // the frame keeps the caller's size in every state
    expect(frame().className).toContain("h-48");
    expect(frame().className).toContain("w-full");
    expect(frame().className).toContain("bg-raised");
  });

  test("a portrait image is shown whole (object-contain), never cropped", async () => {
    await render({ event: event() });
    withDimensions(img(), 900, 1600);
    await fire(img(), "load");
    expect(img().className).toContain("object-contain");
    expect(img().src).toBe("https://cdn.example.test/poster.jpg");
  });

  test("a square image is shown whole (object-contain)", async () => {
    await render({ event: event() });
    withDimensions(img(), 1000, 1000);
    await fire(img(), "load");
    expect(img().className).toContain("object-contain");
  });

  test("the src is exactly the event's own URL, trimmed", async () => {
    await render({ event: event({ image_url: "  https://cdn.example.test/poster.jpg  " }) });
    expect(img().getAttribute("src")).toBe("https://cdn.example.test/poster.jpg");
  });

  test("no other URL is ever rendered, in any state", async () => {
    const urls = [
      "https://cdn.example.test/a.jpg",
      "https://cdn.example.test/b.jpg?w=1200",
      "  https://cdn.example.test/c.jpg  ",
    ];
    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      await render({ event: event({ image_url: url }) });
      expect(img().getAttribute("src")).toBe(url.trim());
      // eslint-disable-next-line no-await-in-loop
      await fire(img(), "error");
      expect(container.querySelectorAll("img")).toHaveLength(0);
      expect(frame().className).toContain("bg-raised"); // the frame never disappears
    }
  });

  test("hotlink-safe, async and lazy by default; eager when priority", async () => {
    await render({ event: event() });
    expect(img().getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img().getAttribute("decoding")).toBe("async");
    expect(img().getAttribute("loading")).toBe("lazy");

    await render({ event: event(), priority: true });
    expect(img().getAttribute("loading")).toBe("eager");
  });

  test("the alt text falls back to the event title", async () => {
    await render({ event: event() });
    expect(img().getAttribute("alt")).toBe("Watercolour meetup");
    await render({ event: event(), alt: "Custom alt" });
    expect(img().getAttribute("alt")).toBe("Custom alt");
  });

  test("state resets when image_url changes", async () => {
    await render({ event: event() });
    withDimensions(img(), 900, 1600);
    await fire(img(), "load");
    expect(img().className).toContain("object-contain");

    await render({ event: event({ image_url: "https://cdn.example.test/second.jpg" }) });
    expect(img().getAttribute("src")).toBe("https://cdn.example.test/second.jpg");
    expect(img().className).toContain("object-cover");

    await fire(img(), "error");
    expect(placeholder()).not.toBeNull();

    await render({ event: event({ image_url: "https://cdn.example.test/third.jpg" }) });
    expect(img()).not.toBeNull();
    expect(img().getAttribute("src")).toBe("https://cdn.example.test/third.jpg");
  });
});

describe("hasUsableImage — the shared gate", () => {
  test("true only for a non-empty, non-stock image_url", () => {
    expect(hasUsableImage({ image_url: "https://cdn.example.test/a.jpg" })).toBe(true);
    expect(hasUsableImage({ image_url: "  https://cdn.example.test/a.jpg  " })).toBe(true);
    expect(hasUsableImage({ image_url: "" })).toBe(false);
    expect(hasUsableImage({ image_url: "   " })).toBe(false);
    expect(hasUsableImage({})).toBe(false);
    expect(hasUsableImage(null)).toBe(false);
    expect(hasUsableImage({ image_url: "https://images.pexels.com/photos/1.jpeg" })).toBe(false);
    expect(hasUsableImage({ image_url: "https://stock.adobe.com/x.jpg" })).toBe(false);
  });
});
