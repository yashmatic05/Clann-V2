import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Clann buttons — DESIGN_SYSTEM.md R8.
 *
 * Use `buttonVariants` for EVERY button-like element, including a `<Link>` or
 * `<a>` styled as a button (pass the class string, or use <Button asChild>).
 * Never hand-roll an ad-hoc button class string.
 *
 * All buttons are pill-shaped, bold and set in .t-button.
 *
 *   primary      the one orange action per card / per screen
 *   secondary    bordered, quiet — the companion to a primary
 *   tertiary     bare text with an underline on hover
 *   destructive  RED outline, never orange; always followed by a confirm dialog
 *   link         inline text link in the accent-text token
 *
 * There is deliberately no focus-visible:outline-none here — the global
 * `:focus-visible` ring from index.css (R7) must stay visible on every button.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full t-button transition-colors duration-fast ease-standard active:scale-[0.98] disabled:pointer-events-none disabled:bg-raised disabled:text-ink-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-cta text-on-cta hover:bg-cta-hover",
        secondary:
          "border border-line-input bg-transparent text-ink hover:bg-raised",
        tertiary: "bg-transparent text-ink hover:underline",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger-bg",
        link: "text-cta-text hover:underline",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-[52px] px-8 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

/**
 * `size="icon"` has no label, so it must carry an aria-label. Warn in
 * development rather than shipping a silent a11y hole.
 */
const warnIfIconWithoutLabel = (size, props) => {
  if (process.env.NODE_ENV === "production") return;
  if (size !== "icon") return;
  if (props["aria-label"] || props["aria-labelledby"] || props.title) return;
  // eslint-disable-next-line no-console
  console.warn(
    "[ui/button] size=\"icon\" requires an aria-label (DESIGN_SYSTEM.md R8)."
  );
};

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const resolvedSize = size ?? "md";
    warnIfIconWithoutLabel(resolvedSize, props);

    // asChild hands rendering to a caller-supplied element (e.g. a <Link>); we
    // cannot safely inject a spinner into an arbitrary child, so `loading` is
    // not supported there.
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}>
          {children}
        </Slot>
      );
    }

    // Loading: a 16px Loader2 REPLACES the icon, the label stays, and because
    // the spinner is the same 16px box the button width does not jump.
    let content = children;
    if (loading) {
      const parts = React.Children.toArray(children);
      const first = parts[0];
      const firstIsIcon =
        React.isValidElement(first) && typeof first.type !== "string";
      content = [
        <Loader2
          key="clann-button-spinner"
          size={16}
          strokeWidth={1.75}
          className="animate-spin"
          aria-hidden="true" />,
        ...(firstIsIcon ? parts.slice(1) : parts),
      ];
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        disabled={loading || props.disabled}>
        {content}
      </button>
    );
  })
Button.displayName = "Button"

export { Button, buttonVariants }
