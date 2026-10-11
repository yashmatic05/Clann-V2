import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Checkbox — DESIGN_SYSTEM.md R8 "Inputs".
 *
 * On-state is the `selected` token with `on-selected` for the tick — never
 * orange, and no shadow. The visible box is 20px; the `before:` pseudo-element
 * grows the tap area to exactly 44x44 (R6) without oversizing the box.
 */
const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative h-5 w-5 shrink-0 rounded-sm border border-line-input bg-surface transition-colors duration-fast ease-standard before:absolute before:-inset-3 before:content-[''] hover:border-ink-2 focus-visible:border-ink aria-[invalid=true]:border-danger disabled:pointer-events-none disabled:bg-raised data-[state=checked]:border-selected data-[state=checked]:bg-selected data-[state=checked]:text-on-selected",
      className
    )}
    {...props}>
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check size={16} strokeWidth={1.75} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
