import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { CloudArrowDown } from "@phosphor-icons/react/dist/ssr";

export function EmptyState({
  title,
  description,
  icon: Icon = CloudArrowDown,
}: {
  title: string;
  description: string;
  icon?: ComponentType<IconProps>;
}) {
  return (
    <div className="flex flex-col items-center gap-[var(--space-lg)] rounded-xl border border-dashed border-[var(--color-border)] px-[var(--space-2xl)] py-[var(--space-3xl)] text-center">
      <span className="rounded-full bg-[var(--color-muted)] p-3 text-[var(--ink-3)]">
        <Icon size={24} weight="regular" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-medium text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">{description}</p>
      </div>
    </div>
  );
}
