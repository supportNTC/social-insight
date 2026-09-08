import { Trash } from "@phosphor-icons/react/dist/ssr";
import { deleteCourseConversionAction } from "@/app/goals/actions";
import type { CourseConversionEntryView } from "@/lib/queries/goals";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatDateBangkok, formatNumber } from "@/lib/format";
import { snapshotDateToColumn } from "@/lib/datetime";

export function CourseConversionList({ entries }: { entries: CourseConversionEntryView[] }) {
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">รายการที่บันทึกไว้เดือนนี้</h2>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">
          รวม {formatNumber(total)} คน
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-[var(--space-lg)] text-[13px] text-[var(--ink-3)]">ยังไม่มีรายการในเดือนนี้</p>
      ) : (
        <ul className="mt-[var(--space-lg)] divide-y divide-[var(--color-border)]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-[var(--space-md)] first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-mono tabular-nums text-[var(--ink-2)]">
                  {formatDateBangkok(snapshotDateToColumn(entry.entryDate))}
                </span>
                {entry.platform && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_MARK_COLOR[entry.platform] }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-[var(--ink-2)]">{entry.platform ? PLATFORM_LABEL[entry.platform] : "ไม่ระบุแพลตฟอร์ม"}</span>
                {entry.note && <span className="text-[var(--ink-3)] italic">— {entry.note}</span>}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                  {formatNumber(entry.count)} คน
                </span>
                <form action={deleteCourseConversionAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    aria-label="ลบรายการ"
                    title="ลบรายการ"
                    className="cursor-pointer rounded-md p-1 text-[var(--ink-3)] transition-colors duration-150 hover:bg-[var(--color-muted)] hover:text-[var(--critical-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
                  >
                    <Trash size={13} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
