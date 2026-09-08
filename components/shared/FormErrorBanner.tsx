import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * `role="alert"` + `tabIndex={-1}` so a screen reader announces it immediately
 * and it's a valid focus target — the `ref` prop (React 19: plain prop, no
 * forwardRef needed) must land on THIS element, not a wrapper around it, or
 * `.focus()` in the caller silently does nothing (non-focusable node).
 */
export function FormErrorBanner({
  message,
  ref,
}: {
  message: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mb-[var(--space-lg)] flex items-start gap-2 rounded-lg border border-[var(--critical)] bg-[var(--critical)]/10 px-3 py-2 text-[13px] text-[var(--critical-ink)] focus:ring-2 focus:ring-[var(--color-ring)] focus:outline-none"
    >
      <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
