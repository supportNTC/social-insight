import Link from "next/link";
import { Info, TrendDown } from "@phosphor-icons/react/dist/ssr";
import type { UnderperformingItem } from "@/lib/queries/recommendations";
import type { UnderperformanceStage, UnderperformanceThresholds } from "@/lib/metrics";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber, formatDateBangkok, formatPercent } from "@/lib/format";

const STAGE_LABEL: Record<UnderperformanceStage, string> = {
  reach: "reach ต่ำ",
  views: "ดูน้อย",
  engagement: "ดูแล้วไม่ interact",
};

const STAGE_EXPLANATION: Record<UnderperformanceStage, string> = {
  reach: "แพลตฟอร์มกระจายให้คนเห็นน้อยกว่าปกติของบัญชีนี้ — ปัญหาเกิดตั้งแต่ขั้นแรกของ funnel",
  views: "คนเห็นตามปกติ แต่กดเข้าดูน้อยกว่าปกติ — ปก/ประโยคเปิดอาจไม่ดึงดูดพอ",
  engagement: "คนเห็นและกดดูตามปกติ แต่ไม่กดไลก์/คอมเมนต์/แชร์ — เนื้อหาไม่ทำให้อยากมีส่วนร่วม",
};

/**
 * The funnel stops at the FIRST broken step, so each row says one thing only.
 * Content younger than a few days, or without a baseline to compare against,
 * never reaches this list — "ยังไม่รู้" must not be shown as "แย่ที่สุด".
 */
export function UnderperformingList({
  items,
  thresholds,
  maturityDays,
}: {
  items: UnderperformingItem[];
  thresholds: UnderperformanceThresholds;
  maturityDays: number;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <TrendDown size={18} weight="bold" className="text-[var(--critical-ink)]" aria-hidden="true" />
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">ต่ำกว่าปกติ</h2>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        เช็คเป็นลำดับ: reach &lt; {formatPercent(thresholds.reachRatio, 0)} → views &lt;{" "}
        {formatPercent(thresholds.viewsRatio, 0)} ของค่ามัธยฐานบัญชี → performance score &lt;{" "}
        {thresholds.performanceScore.toFixed(2)} — แสดงเฉพาะขั้นแรกที่พัง
      </p>

      {items.length === 0 ? (
        <p className="mt-[var(--space-xl)] rounded-lg border border-dashed border-[var(--color-border)] px-[var(--space-lg)] py-[var(--space-xl)] text-center text-[13px] text-[var(--ink-2)]">
          ไม่มีคอนเทนต์ที่ต่ำกว่าเกณฑ์ในช่วงที่เลือก
        </p>
      ) : (
        <ul className="mt-[var(--space-xl)] grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/content/${item.id}`}
                className="flex h-full items-start gap-[var(--space-lg)] rounded-lg border border-[var(--color-border)] p-[var(--space-lg)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PLATFORM_MARK_COLOR[item.platform] }}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[var(--ink)]">
                    {item.caption ?? <span className="text-[var(--ink-3)] italic">ไม่มีแคปชัน</span>}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-2)]">
                    <span>{PLATFORM_LABEL[item.platform]}</span>
                    <span>{formatDateBangkok(item.publishedAt)}</span>
                    <span className="font-mono tabular-nums">
                      views {formatCompactNumber(item.viewsAtMaturity)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      reach{" "}
                      {item.reachAtMaturity === null ? (
                        <span
                          tabIndex={0}
                          title={`${PLATFORM_LABEL[item.platform]} ไม่ให้ข้อมูล reach ระดับคอนเทนต์ — ข้ามไปตรวจขั้น views แทน`}
                          className="inline-flex cursor-help items-center gap-1 text-[var(--ink-3)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
                        >
                          —
                          <Info size={12} weight="bold" aria-hidden="true" />
                          <span className="sr-only">
                            {PLATFORM_LABEL[item.platform]} ไม่ให้ข้อมูล reach ระดับคอนเทนต์
                          </span>
                        </span>
                      ) : (
                        formatCompactNumber(item.reachAtMaturity)
                      )}
                    </span>
                  </div>

                  <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--critical-ink)]">
                      {STAGE_LABEL[item.diagnosis.stage]}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-[var(--ink-2)]">
                      {formatPercent(item.diagnosis.ratio, 0)} ของค่าปกติ
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-[var(--ink-2)]">
                    {STAGE_EXPLANATION[item.diagnosis.stage]}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-[var(--space-xl)] text-[11px] text-[var(--ink-3)]">
        เทียบที่อายุเท่ากัน: ทุกคอนเทนต์ใช้ยอดสะสม {maturityDays} วันแรกของตัวเอง เทียบกับค่ามัธยฐาน{" "}
        {maturityDays} วันแรกของคอนเทนต์ในบัญชีเดียวกัน (ย้อนหลัง 30 วัน) — คอนเทนต์ที่โพสต์ไม่ถึง 3 วัน
        หรือยังไม่มี baseline จะไม่ถูกตัดสินในรายการนี้
      </p>
    </section>
  );
}
