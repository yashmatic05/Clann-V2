import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

/**
 * Sonner wrapper — DESIGN_SYSTEM.md R8 "Feedback and states".
 *
 * `resolvedTheme` (not `theme`) is passed down so sonner picks the concrete
 * light/dark stylesheet rather than re-deriving "system" itself. All colours
 * come from design tokens via Tailwind classes — no hex, no inline style
 * object, and `shadow-none` because toasts sit on a flat surface separated by
 * a border.
 */
const Toaster = ({
  ...props
}) => {
  const { resolvedTheme = "dark" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:border group-[.toaster]:border-line group-[.toaster]:shadow-none group-[.toaster]:rounded-md",
          title: "group-[.toast]:text-ink group-[.toast]:font-medium",
          description: "group-[.toast]:text-ink-muted",
          actionButton:
            "group-[.toast]:bg-cta group-[.toast]:text-on-cta",
          cancelButton:
            "group-[.toast]:bg-raised group-[.toast]:text-ink-muted",
          successIcon: "group-[.toast]:text-ok",
          errorIcon: "group-[.toast]:text-danger",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
