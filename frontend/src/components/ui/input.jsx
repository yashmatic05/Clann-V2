import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Shared field classes — DESIGN_SYSTEM.md R8 "Inputs".
 *
 * `fieldBaseClassNames` is the single source of truth for every text-entry
 * surface (input, textarea, select trigger) so they cannot drift apart.
 * Height and padding are added per component:
 *   input         h-11 px-4
 *   textarea      min-h-24 px-4 py-3
 *   select        h-11 px-4
 *
 * `text-base` below md and `text-sm` from md is deliberate: iOS Safari zooms
 * the page on focus for any input smaller than 16px.
 *
 * There is no `focus-visible:outline-none` — the global 2px focus ring from
 * index.css (R7) must stay visible. Focus additionally darkens the border to
 * `border-ink`, and `aria-invalid="true"` turns it red.
 */
export const fieldBaseClassNames =
  "w-full rounded-md border border-line-input bg-surface text-ink text-base md:text-sm transition-colors duration-fast ease-standard placeholder:text-ink-muted hover:border-ink-2 focus-visible:border-ink aria-[invalid=true]:border-danger disabled:bg-raised disabled:text-ink-disabled"

/** The shared input class string referenced by R8. Import this rather than
 *  re-typing field classes in a page. */
export const inputClassNames = cn(
  fieldBaseClassNames,
  "flex h-11 px-4 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink"
)

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(inputClassNames, className)}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
