import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/**
 * Badges — DESIGN_SYSTEM.md R8.
 *
 * R8 fixes badges at h-6 (24px) with rounded-md, px-2 and .t-caption. They are
 * status labels, not controls, so there is no hover state and no orange: the
 * filled "default" badge uses the selected/on-selected pair, which leaves the
 * cta orange free for the one primary action per card (R2, R4).
 */
const badgeVariants = cva(
  "inline-flex h-6 shrink-0 items-center rounded-md border px-2 t-caption font-semibold whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-selected text-on-selected",
        secondary: "border-line bg-raised text-ink-2",
        destructive: "border-danger bg-danger-bg text-danger",
        outline: "border-line-input bg-transparent text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
