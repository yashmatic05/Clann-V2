import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Tabs — DESIGN_SYSTEM.md R8 "Chips, badges, tabs".
 *
 *   list    bg-raised rounded-full p-1 h-auto
 *   trigger rounded-full px-4 min-h-9 text-ink-2
 *           data-[state=active]:bg-selected data-[state=active]:text-on-selected
 *
 * The selected state is the `selected` token — NEVER orange. Call sites must
 * not add their own data-[state=active] colour overrides; those are deleted in
 * Parts 3 and 4. Any framer-motion sliding indicator a caller adds keeps
 * working, it just needs recoloring to bg-selected.
 */
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto items-center justify-center rounded-full bg-raised p-1 text-ink-2",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 t-button text-ink-2 transition-colors duration-fast ease-standard hover:text-ink data-[state=active]:bg-selected data-[state=active]:text-on-selected data-[state=active]:hover:text-on-selected disabled:pointer-events-none disabled:text-ink-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-2", className)}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
