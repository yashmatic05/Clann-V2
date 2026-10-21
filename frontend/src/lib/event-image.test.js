/**
 * Tests for the shared event-poster rules in src/lib/event-image.js.
 *
 * isStockImageUrl is a FLAG, not a source: it identifies stock-hosted URLs the
 * admin should replace, and must never fire on look-alike domains.
 */

const {
  MIN_LANDSCAPE_RATIO,
  isLandscape,
  STOCK_IMAGE_HOSTS,
  isStockImageUrl,
} = require("./event-image");

describe("MIN_LANDSCAPE_RATIO", () => {
  test("is the same 1.2 threshold image-fallback.js uses for display", () => {
    expect(MIN_LANDSCAPE_RATIO).toBe(1.2);
  });
});

describe("isLandscape", () => {
  test("needs BOTH dimensions to be positive", () => {
    expect(isLandscape(0, 100)).toBe(false);
    expect(isLandscape(100, 0)).toBe(false);
    expect(isLandscape(0, 0)).toBe(false);
    expect(isLandscape(-1600, -900)).toBe(false);
    expect(isLandscape(null, null)).toBe(false);
    expect(isLandscape(undefined, 900)).toBe(false);
    expect(isLandscape(NaN, 900)).toBe(false);
    expect(isLandscape("wide", 900)).toBe(false);
  });

  test("exact ratio boundary is landscape (>=)", () => {
    expect(isLandscape(1200, 1000)).toBe(true);
    expect(MIN_LANDSCAPE_RATIO * 1000).toBe(1200);
  });

  test("just under the boundary is not landscape", () => {
    expect(isLandscape(1199, 1000)).toBe(false);
    expect(isLandscape(1600, 1334)).toBe(false);
  });

  test("typical card ratios", () => {
    expect(isLandscape(1920, 1080)).toBe(true); // 16:9
    expect(isLandscape(1600, 1200)).toBe(true); // 4:3
    expect(isLandscape(1000, 1000)).toBe(false); // square
    expect(isLandscape(1080, 1920)).toBe(false); // portrait
  });

  test("accepts numeric strings as well as numbers", () => {
    expect(isLandscape("1600", "900")).toBe(true);
    expect(isLandscape("1000", "900")).toBe(false);
  });
});

describe("isStockImageUrl", () => {
  test("matches the known stock hosts exactly and as subdomains", () => {
    expect(STOCK_IMAGE_HOSTS).toContain("unsplash.com");
    expect(STOCK_IMAGE_HOSTS).toContain("stock.adobe.com");
    expect(STOCK_IMAGE_HOSTS.length).toBe(11);

    expect(isStockImageUrl("https://images.unsplash.com/photo-123?w=1600")).toBe(true);
    expect(isStockImageUrl("https://unsplash.com/photo.jpg")).toBe(true);
    expect(isStockImageUrl("http://www.pexels.com/photo/a.jpg")).toBe(true);
    expect(isStockImageUrl("https://as2.ftcdn.net/..")).toBe(false); // not a listed host
    expect(isStockImageUrl("https://stock.adobe.com/assets/x.jpg")).toBe(true);
    expect(isStockImageUrl("https://tuyos.stock.adobe.com/x.jpg")).toBe(true);
  });

  test("look-alike hosts must be false", () => {
    expect(isStockImageUrl("https://notunsplash.com/a.jpg")).toBe(false);
    expect(isStockImageUrl("https://myunsplash.com/a.jpg")).toBe(false);
    expect(isStockImageUrl("https://unsplash.com.evil.net/a.jpg")).toBe(false);
    expect(isStockImageUrl("https://gettyimages.com.ru/a.jpg")).toBe(false);
    expect(isStockImageUrl("https://example.com/unsplash.com/a.jpg")).toBe(false);
    // the stock host is a suffix of a different domain's label — not a match
    expect(isStockImageUrl("https://not-pexels.com/a.jpg")).toBe(false);
    expect(isStockImageUrl("https://freepik.com.gr/a.jpg")).toBe(false);
  });

  test("invalid or empty input is false, never throws", () => {
    expect(isStockImageUrl("")).toBe(false);
    expect(isStockImageUrl("   ")).toBe(false);
    expect(isStockImageUrl(null)).toBe(false);
    expect(isStockImageUrl(undefined)).toBe(false);
    expect(isStockImageUrl(42)).toBe(false);
    expect(isStockImageUrl({})).toBe(false);
    expect(isStockImageUrl("not a url")).toBe(false);
    expect(isStockImageUrl("https://")).toBe(false);
    expect(isStockImageUrl("images.unsplash.com/x.jpg")).toBe(false); // no scheme -> not a valid URL
  });

  test("case-insensitive and trailing-dot tolerant", () => {
    expect(isStockImageUrl("HTTPS://Images.Unsplash.Com/x.jpg")).toBe(true);
    expect(isStockImageUrl("https://unsplash.com./x.jpg")).toBe(true);
  });
});
