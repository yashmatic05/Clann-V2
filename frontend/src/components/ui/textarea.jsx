import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldBaseClassNames } from "@/components/ui/input"

/**
 * Textarea — DESIGN_SYSTEM.md R8 "Inputs".
 * Shares `fieldBaseClassNames` with Input and Select so all three match;
 * adds min-h-24 plus px-4 py-3.
 */
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(fieldBaseClassNames, "flex min-h-24 px-4 py-3", className)}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
