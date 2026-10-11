import React from "react";

/**
 * Theme-aware Clann wordmark — DESIGN_SYSTEM.md Part 1d.
 *
 * /brand/clann-logo.png is a single-colour near-white PNG. Rather than ship a
 * second asset for the light theme, the PNG is used as a CSS MASK over a block
 * of `rgb(var(--c-ink))`: the glyph shape comes from the file, the colour comes
 * from the active token set. The mark therefore renders cream in dark mode and
 * indigo in light mode with no branching and no new asset.
 *
 * Usage — height is driven by the className prop, width follows from the
 * intrinsic 864x492 aspect ratio:
 *   <ThemedLogo className="h-9 w-auto" />
 *
 * The ORANGE logo (/brand/clann-logo-color.png) in the Footer is a genuine
 * multi-colour brand asset and stays an <img>.
 */
const LOGO_SRC = "/brand/clann-logo.png";
const LOGO_ASPECT_RATIO = "864 / 492";

const ThemedLogo = ({ className = "", style, ...props }) => (
  <span
    role="img"
    aria-label="Clann"
    className={className}
    style={{
      display: "inline-block",
      backgroundColor: "rgb(var(--c-ink))",
      aspectRatio: LOGO_ASPECT_RATIO,
      maskImage: `url(${LOGO_SRC})`,
      WebkitMaskImage: `url(${LOGO_SRC})`,
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskPosition: "center",
      ...style,
    }}
    {...props}
  />
);

export default ThemedLogo;
