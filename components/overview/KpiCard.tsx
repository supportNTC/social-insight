import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { CaretUp, CaretDown } from "@phosphor-icons/react/dist/ssr";

type Trend = "up" | "down" | "flat";

export function KpiCard({
  label,
  value,
  deltaLabel,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  deltaLabel: string;
  trend: Trend;
  icon: ComponentType<IconProps>;
}) {
  const trendColor =
    trend === "up"
      ? "text-[var(--good-ink)]"
      : trend === "down"
        ? "text-[var(--critical-ink)]"
        : "text-[var(--ink-2)]";

  return (
    <div className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium tracking-wide text-[var(--ink-2)] uppercase">
          {label}
        </p>
        <span className="rounded-lg bg-[var(--color-muted)] p-1.5 text-[var(--accent-ink)]">
          <Icon size={18} weight="bold" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-[var(--space-lg)] font-mono text-[26px] leading-none font-semibold text-[var(--ink)] tabular-nums">
        {value}
      </p>

      <div
        className={`mt-[var(--space-md)] flex items-center gap-1 text-[13px] font-medium ${trendColor}`}
      >
        {trend === "up" && <CaretUp size={13} weight="bold" aria-hidden="true" />}
        {trend === "down" && <CaretDown size={13} weight="bold" aria-hidden="true" />}
        <span className="font-mono tabular-nums">{deltaLabel}</span>
        <span className="text-[var(--ink-3)]">เทียบช่วงก่อนหน้า</span>
      </div>
    </div>
  );
}
