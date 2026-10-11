import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Switch — DESIGN_SYSTEM.md R8 "Inputs".
 *
 * On-state is the `selected` token, NEVER orange, and there is no shadow.
 * The visible track is 24x44; the `before:` pseudo-element expands the
 * clickable box to 44px tall as well, so the tap target meets R6 without
 * making the control visually oversized. Call sites keep 16px row gaps, so
 * the 12px extension never overlaps a neighbouring control.
 *
 * NOTE: call sites must not pass `data-[state=checked]:bg-cta` style overrides
 * (AdminPanel still does; those are removed in Part 4).
 */
const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-line-input transition-colors duration-fast ease-standard before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] disabled:pointer-events-none disabled:bg-raised data-[state=checked]:bg-selected",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-canvas transition-transform duration-fast ease-standard data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
