import Link from "next/link";
import { Clock, Eye, Flame } from "@phosphor-icons/react/dist/ssr";
import type { RisingItem } from "@/lib/queries/recommendations";
import { RISING_MAX_AGE_HOURS, RISING_VELOCITY_THRESHOLD } from "@/lib/metrics";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber } from "@/lib/format";

export function RisingList({ items }: { items: RisingItem[] }) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <Flame size={18} weight="fill" className="text-[var(--critical-ink)]" aria-hidden="true" />
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">กำลังมา</h2>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        velocity ≥ {RISING_VELOCITY_THRESHOLD.toFixed(1)} เท่าของค่ามัธยฐาน และโพสต์มาไม่เกิน{" "}
        {RISING_MAX_AGE_HOURS} ชั่วโมง
      </p>

      {items.length === 0 ? (
        <p className="mt-[var(--space-xl)] rounded-lg border border-dashed border-[var(--color-border)] px-[var(--space-lg)] py-[var(--space-xl)] text-center text-[13px] text-[var(--ink-2)]">
          ยังไม่มีคอนเทนต์ที่เข้าเกณฑ์ในช่วงที่เลือก
        </p>
      ) : (
        <ul className="mt-[var(--space-xl)] space-y-[var(--space-md)]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/content/${item.id}`}
                className="flex items-center gap-[var(--space-lg)] rounded-lg border border-[var(--color-border)] p-[var(--space-lg)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PLATFORM_MARK_COLOR[item.platform] }}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[var(--ink)]">
                    {item.caption ?? <span className="text-[var(--ink-3)] italic">ไม่มีแคปชัน</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-2)]">
                    <span>{PLATFORM_LABEL[item.platform]}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} aria-hidden="true" />
                      {Math.round(item.ageHours)} ชม.ที่แล้ว
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye size={12} aria-hidden="true" />
                      {formatCompactNumber(item.views)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-[14px] font-semibold tabular-nums text-[var(--good-ink)]">
                    {item.velocity.toFixed(1)}×
                  </p>
                  <p className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">velocity</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-[var(--space-xl)] text-[11px] text-[var(--ink-3)]">
        velocity = ยอดวิว 24 ชม.แรก ÷ ค่ามัธยฐานของ 20 คอนเทนต์ล่าสุดในบัญชีเดียวกัน — คอนเทนต์ที่ยังไม่มี
        baseline จะไม่แสดงในรายการนี้
      </p>
    </section>
  );
}
