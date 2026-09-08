import { Trash } from "@phosphor-icons/react/dist/ssr";
import { deleteGoalAction } from "@/app/goals/actions";
import type { GoalWithProgress } from "@/lib/queries/goals";
import { GOAL_METRIC_LABEL, GOAL_METRIC_UNIT } from "@/lib/goal-labels";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber, formatPercent, formatSignedCompactNumber } from "@/lib/format";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Bare list renderer, no card/header of its own — reused as-is inside
 * Overview's own "เป้าหมายเดือนนี้" card (app/page.tsx) and inside
 * GoalProgressCard's header+card on /goals (components/goals/GoalProgressCard.tsx).
 * Each caller supplies its own surrounding chrome.
 */
export function GoalList({ goals }: { goals: GoalWithProgress[] }) {
  if (goals.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีเป้าหมายเดือนนี้"
        description="ตั้งเป้าหมายแรกด้วยฟอร์มด้านล่าง"
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-[var(--space-lg)] sm:grid-cols-2">
      {goals.map((goal) => (
        <li
          key={goal.id}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-lg)] shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-medium text-[var(--ink)]">{GOAL_METRIC_LABEL[goal.metric]}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
                {goal.platform && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_MARK_COLOR[goal.platform] }}
                    aria-hidden="true"
                  />
                )}
                {goal.platform ? PLATFORM_LABEL[goal.platform] : "ทุกแพลตฟอร์มรวมกัน"}
              </div>
            </div>

            <form action={deleteGoalAction}>
              <input type="hidden" name="id" value={goal.id} />
              <button
                type="submit"
                aria-label="ลบเป้าหมาย"
                title="ลบเป้าหมาย"
                className="cursor-pointer rounded-md p-1.5 text-[var(--ink-3)] transition-colors duration-150 hover:bg-[var(--color-muted)] hover:text-[var(--critical-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
              >
                <Trash size={14} aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="mt-[var(--space-md)] h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, (goal.progress.ratio ?? 0) * 100))}%`,
                backgroundColor:
                  goal.progress.ratio === null
                    ? "var(--ink-3)"
                    : goal.progress.ratio >= 1
                      ? "var(--good)"
                      : goal.progress.ratio >= 0.5
                        ? "var(--warning)"
                        : "var(--critical)",
              }}
            />
          </div>

          <div className="mt-[var(--space-sm)] flex items-center justify-between text-[12px]">
            <span className="font-mono tabular-nums text-[var(--ink)]">
              {goal.metric === "followers"
                ? formatSignedCompactNumber(goal.progress.actual)
                : formatCompactNumber(goal.progress.actual)}{" "}
              <span className="text-[var(--ink-3)]">/ {formatCompactNumber(goal.progress.target)}</span>{" "}
              <span className="text-[var(--ink-3)]">{GOAL_METRIC_UNIT[goal.metric]}</span>
            </span>
            <span className="font-mono font-semibold tabular-nums text-[var(--ink)]">
              {goal.progress.ratio === null ? "—" : formatPercent(goal.progress.ratio, 0)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
