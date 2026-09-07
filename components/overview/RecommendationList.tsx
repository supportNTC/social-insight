import { Flame, Eye, Clock } from "@phosphor-icons/react/dist/ssr";
import { PLATFORM_LABEL, RISING_CONTENT } from "@/lib/mock/overview-prototype";
import { formatCompactNumber } from "@/lib/format";

const MARK_COLOR: Record<string, string> = {
  facebook: "#2a78d6",
  instagram: "#eb6834",
  tiktok: "#1baf7a",
};

export function RecommendationList() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <Flame size={18} weight="fill" className="text-[var(--critical-ink)]" aria-hidden="true" />
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">คอนเทนต์ที่กำลังมาแรง</h2>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        velocity ≥ 1.5 เท่าของค่ามัธยฐาน และโพสต์มาไม่เกิน 72 ชั่วโมง
      </p>

      <ul className="mt-[var(--space-xl)] space-y-[var(--space-md)]">
        {RISING_CONTENT.map((c) => (
          <li
            key={c.id}
            className="flex cursor-pointer items-center gap-[var(--space-lg)] rounded-lg border border-[var(--color-border)] p-[var(--space-lg)] transition-colors duration-150 hover:bg-[var(--color-muted)]"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: MARK_COLOR[c.platform] }}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--ink)]">{c.caption}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-2)]">
                <span>{PLATFORM_LABEL[c.platform]}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} aria-hidden="true" />
                  {c.publishedHoursAgo} ชม.ที่แล้ว
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye size={12} aria-hidden="true" />
                  {formatCompactNumber(c.views)}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-[14px] font-semibold tabular-nums text-[var(--good-ink)]">
                {c.velocity.toFixed(1)}×
              </p>
              <p className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">velocity</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
