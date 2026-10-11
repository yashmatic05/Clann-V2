import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "t-body-strong text-ink",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "secondary" }),
          "h-11 w-11 bg-transparent p-0 text-ink-muted hover:text-ink"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "t-caption text-ink-muted rounded-md w-11 font-normal",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-raised [&:has([aria-selected].day-outside)]:bg-raised [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "tertiary" }),
          "h-11 w-11 p-0 font-normal"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-selected text-on-selected hover:bg-selected hover:text-on-selected focus:bg-selected focus:text-on-selected",
        day_today: "bg-raised text-ink",
        day_outside:
          "day-outside text-ink-muted aria-selected:bg-raised aria-selected:text-ink-muted",
        day_disabled: "text-ink-disabled",
        day_range_middle:
          "aria-selected:bg-raised aria-selected:text-ink",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft size={16} strokeWidth={1.75} className={cn(className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight size={16} strokeWidth={1.75} className={cn(className)} {...props} />
        ),
      }}
      {...props} />
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
