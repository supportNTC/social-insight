import { Target } from "@phosphor-icons/react/dist/ssr";
import { GoalList } from "@/components/goals/GoalList";
import type { GoalWithProgress } from "@/lib/queries/goals";

/**
 * Header+card wrapper for /goals specifically — GoalList itself stays a bare
 * renderer (reused inside Overview's own card, app/page.tsx) so its header
 * doesn't double up there. Keeping the header visible even with zero goals
 * (GoalList swaps only its body for EmptyState) means an empty month still
 * reads as "this is where goal progress lives", not a headless blank card.
 */
export function GoalProgressCard({ goals }: { goals: GoalWithProgress[] }) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <Target size={18} weight="fill" className="text-[var(--accent-ink)]" aria-hidden="true" />
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">ความคืบหน้าเป้าหมาย</h2>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">เทียบยอดจริงสะสมในเดือนนี้กับเป้าที่ตั้งไว้</p>

      <div className="mt-[var(--space-xl)]">
        <GoalList goals={goals} />
      </div>
    </section>
  );
}
