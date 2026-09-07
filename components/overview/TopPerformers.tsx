import Link from "next/link";
import { Trophy } from "@phosphor-icons/react/dist/ssr";
import type { RecommendationItem } from "@/lib/queries/recommendations";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber, formatDateBangkok, formatPercentValue } from "@/lib/format";

/**
 * One ranking across every platform. That is only safe because the ranking key
 * is the performance score — each content divided by its OWN account's median,
 * so the reach-vs-views denominator cancels out. The raw ER column next to it
 * does not cancel out, so every row carries its basis badge and the footnote
 * spells the rule out (CLAUDE.md rule 4).
 */
export function TopPerformers({
  items,
  mixesErBasis,
}: {
  items: RecommendationItem[];
  mixesErBasis: boolean;
}) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <Trophy size={18} weight="fill" className="text-[var(--warning-ink)]" aria-hidden="true" />
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Top 10 ช่วงนี้</h2>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        เรียงตาม performance score — ER ของคอนเทนต์ ÷ ค่ามัธยฐาน ER 30 วันของบัญชีเดียวกัน (1.00× = ปกติ)
      </p>

      {items.length === 0 ? (
        <p className="mt-[var(--space-xl)] rounded-lg border border-dashed border-[var(--color-border)] px-[var(--space-lg)] py-[var(--space-xl)] text-center text-[13px] text-[var(--ink-2)]">
          ยังไม่มีคอนเทนต์ที่คำนวณ performance score ได้ในช่วงที่เลือก
        </p>
      ) : (
        <div className="mt-[var(--space-xl)] -mx-[var(--space-lg)] overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[12px] tracking-wide text-[var(--ink-3)] uppercase">
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  #
                </th>
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  คอนเทนต์
                </th>
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  วันที่
                </th>
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  Views
                </th>
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  ER
                </th>
                <th scope="col" className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-muted)]"
                >
                  <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono text-[var(--ink-3)] tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-[var(--space-lg)] py-[var(--space-md)]">
                    <Link
                      href={`/content/${item.id}`}
                      className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PLATFORM_MARK_COLOR[item.platform] }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block max-w-[240px] truncate font-medium text-[var(--ink)]">
                          {item.caption ?? <span className="text-[var(--ink-3)] italic">ไม่มีแคปชัน</span>}
                        </span>
                        <span className="block text-[12px] text-[var(--ink-2)]">
                          {PLATFORM_LABEL[item.platform]}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-[var(--space-lg)] py-[var(--space-md)] whitespace-nowrap text-[var(--ink-2)]">
                    {formatDateBangkok(item.publishedAt)}
                  </td>
                  <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono tabular-nums">
                    {formatCompactNumber(item.views)}
                  </td>
                  <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono whitespace-nowrap tabular-nums">
                    {formatPercentValue(item.engagementRate.value)}
                    <span className="ml-1 rounded-full bg-[var(--color-muted)] px-1.5 py-0.5 font-sans text-[10px] tracking-wide text-[var(--ink-2)] uppercase">
                      {item.engagementRate.basis}
                    </span>
                  </td>
                  <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono font-medium tabular-nums text-[var(--good-ink)]">
                    {item.performanceScore.toFixed(2)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-auto pt-[var(--space-xl)] text-[11px] text-[var(--ink-3)]">
        {mixesErBasis
          ? "ตารางนี้มีทั้งคอนเทนต์ที่คิด ER จาก reach และจาก views — เรียงอันดับด้วย performance score ซึ่งเทียบกับค่าปกติของบัญชีตัวเองแล้ว จึงข้าม basis ได้ ส่วนคอลัมน์ ER ห้ามเทียบข้ามแถวที่ basis ต่างกัน (ดู badge กำกับ)"
          : "คอลัมน์ ER ของทุกแถวคิดจากตัวหารเดียวกัน (ดู badge กำกับ) — ถ้ามีคอนเทนต์จาก basis อื่นเข้ามา ระบบจะขึ้นคำเตือนตรงนี้"}
      </p>
    </section>
  );
}
