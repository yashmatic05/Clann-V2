import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Radio group — DESIGN_SYSTEM.md R8 "Inputs".
 * On-state is the `selected` token, never orange, no shadow, and the tap area
 * is expanded to 44x44 by a pseudo-element (R6).
 */
const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (<RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />);
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "relative aspect-square h-5 w-5 rounded-full border border-line-input bg-surface text-ink transition-colors duration-fast ease-standard before:absolute before:-inset-3 before:content-[''] hover:border-ink-2 focus-visible:border-ink disabled:pointer-events-none disabled:bg-raised data-[state=checked]:border-selected data-[state=checked]:bg-selected data-[state=checked]:text-on-selected",
        className
      )}
      {...props}>
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle size={16} strokeWidth={1.75} className="fill-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
