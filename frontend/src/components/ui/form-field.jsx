import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * FormField — DESIGN_SYSTEM.md R8 "Inputs".
 *
 * Wraps any single form control with its label, optional hint and optional
 * error, and wires the accessibility for you:
 *
 *   - label sits ABOVE the field in .t-label text-ink-2; a required field's
 *     label ends with " *"
 *   - hint is .t-caption text-ink-muted
 *   - error is a 16px AlertCircle plus a sentence in .t-caption text-danger
 *   - the control receives `id`, `aria-invalid` and `aria-describedby`
 *
 * The child is cloned, never re-created, so every prop the caller set —
 * including `data-testid`, `value`, `onChange` and validation handlers — is
 * preserved exactly. That is what lets the existing forms adopt FormField
 * without touching their logic or their test ids.
 *
 * Validation TIMING belongs to the caller, per R8: validate on blur and on
 * submit, and clear the error while typing. Pass the resulting message as
 * `error` (a falsy value means "no error").
 *
 *   <FormField label="Email" required hint="We only use this to reply."
 *              error={errors.email}>
 *     <Input data-testid="sub-email" type="email" value={...} onChange={...}
 *            onBlur={...} />
 *   </FormField>
 */
const FormField = React.forwardRef(
  (
    {
      label,
      hint,
      error,
      required = false,
      id,
      htmlFor,
      className,
      labelClassName,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const fieldId = id || htmlFor || generatedId
    const hintId = `${fieldId}-hint`
    const errorId = `${fieldId}-error`
    const hasError = Boolean(error)

    // An error replaces the hint so the two messages never compete; whichever
    // is shown is the one announced via aria-describedby.
    const describedBy = hasError ? errorId : hint ? hintId : undefined

    const kids = React.Children.toArray(children)
    const single = kids.length === 1 ? kids[0] : null
    const control =
      single && React.isValidElement(single)
        ? React.cloneElement(single, {
            id: single.props.id || fieldId,
            "aria-invalid": hasError ? true : single.props["aria-invalid"],
            "aria-describedby":
              single.props["aria-describedby"] || describedBy,
            ref: single.props.ref || ref,
          })
        : children

    return (
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {label ? (
          <label
            htmlFor={fieldId}
            className={cn("t-label text-ink-2", labelClassName)}>
            {label}
            {required ? " *" : ""}
          </label>
        ) : null}

        {control}

        {!hasError && hint ? (
          <p id={hintId} className="t-caption text-ink-muted">
            {hint}
          </p>
        ) : null}

        {hasError ? (
          <p
            id={errorId}
            role="alert"
            className="t-caption inline-flex items-start gap-2 text-danger">
            <AlertCircle
              size={16}
              strokeWidth={1.75}
              className="shrink-0"
              aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    )
  })
FormField.displayName = "FormField"

export { FormField }
export default FormField
