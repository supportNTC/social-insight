import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { CheckCircle, GraduationCap, Target } from "@phosphor-icons/react/dist/ssr";
import type { GoalWithProgress } from "@/lib/queries/goals";
import { formatCompactNumber } from "@/lib/format";

/**
 * Same visual language as components/overview/KpiCard.tsx (icon badge, mono
 * value, muted caption) but without the delta/trend row — these are simple
 * counts for the month, not a period-over-period comparison.
 */
function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: ComponentType<IconProps>;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium tracking-wide text-[var(--ink-2)] uppercase">{label}</p>
        <span className="rounded-lg bg-[var(--color-muted)] p-1.5 text-[var(--accent-ink)]">
          <Icon size={18} weight="bold" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-[var(--space-lg)] font-mono text-[26px] leading-none font-semibold text-[var(--ink)] tabular-nums">
        {value}
      </p>
      <p className="mt-[var(--space-md)] text-[13px] text-[var(--ink-3)]">{caption}</p>
    </div>
  );
}

export function GoalSummary({ goals, courseTotal }: { goals: GoalWithProgress[]; courseTotal: number }) {
  const met = goals.filter((goal) => goal.progress.ratio !== null && goal.progress.ratio >= 1).length;

  return (
    <div className="grid grid-cols-1 gap-[var(--space-xl)] sm:grid-cols-3">
      <StatCard
        label="เป้าหมายเดือนนี้"
        value={String(goals.length)}
        caption={goals.length === 0 ? "ยังไม่ได้ตั้งเป้า" : "รายการที่ตั้งไว้ทั้งหมด"}
        icon={Target}
      />
      <StatCard
        label="บรรลุแล้ว"
        value={goals.length === 0 ? "—" : `${met}/${goals.length}`}
        caption="เป้าหมายที่ถึง 100% ขึ้นไป"
        icon={CheckCircle}
      />
      <StatCard
        label="ยอดสมัคร Course"
        value={formatCompactNumber(courseTotal)}
        caption="รวมทุกแพลตฟอร์มเดือนนี้"
        icon={GraduationCap}
      />
    </div>
  );
}
