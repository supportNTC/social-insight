import { Info } from "@phosphor-icons/react/dist/ssr";
import {
  PLATFORM_LABEL,
  PLATFORM_SHARE,
  type PlatformShare,
} from "@/lib/mock/overview-prototype";
import { formatCompactNumber, formatPercent, formatSignedPercent } from "@/lib/format";

// Same fixed series colors as TrendSection — keep in sync with MASTER.md.
const MARK_COLOR: Record<PlatformShare["platform"], string> = {
  facebook: "#2a78d6",
  instagram: "#eb6834",
  tiktok: "#1baf7a",
};

export function PlatformSplit() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">
        สัดส่วน engagement ตามแพลตฟอร์ม
      </h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        คำนวณจาก engagement ถ่วงน้ำหนัก 30 วันล่าสุด
      </p>

      {/* 100%-stacked bar: exact comparison matters more here than pie
          aesthetics, and it stays readable without relying on hue alone. */}
      <div className="mt-[var(--space-xl)] flex h-3 w-full overflow-hidden rounded-full">
        {PLATFORM_SHARE.map((p) => (
          <div
            key={p.platform}
            style={{ width: `${p.share * 100}%`, backgroundColor: MARK_COLOR[p.platform] }}
            title={`${PLATFORM_LABEL[p.platform]}: ${formatPercent(p.share, 0)}`}
          />
        ))}
      </div>

      <ul className="mt-[var(--space-xl)] space-y-[var(--space-lg)]">
        {PLATFORM_SHARE.map((p) => (
          <li
            key={p.platform}
            className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-[var(--space-lg)] first:border-t-0 first:pt-0"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MARK_COLOR[p.platform] }}
                aria-hidden="true"
              />
              <span className="text-[14px] font-medium text-[var(--ink)]">
                {PLATFORM_LABEL[p.platform]}
              </span>
              <span className="font-mono text-[13px] text-[var(--ink-2)] tabular-nums">
                {formatPercent(p.share, 0)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="font-mono text-[13px] tabular-nums text-[var(--ink)]">
                  {p.engagementRate === null ? (
                    <span className="inline-flex items-center gap-1 text-[var(--ink-3)]">
                      —
                      <span
                        tabIndex={0}
                        title={`${PLATFORM_LABEL[p.platform]} ไม่ได้รายงานข้อมูล reach ในช่วงนี้ — ค่านี้ไม่ใช่ 0`}
                        className="cursor-help focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
                      >
                        <Info size={13} weight="bold" aria-hidden="true" />
                        <span className="sr-only">
                          {PLATFORM_LABEL[p.platform]} ไม่ได้รายงานข้อมูล reach ในช่วงนี้
                        </span>
                      </span>
                    </span>
                  ) : (
                    formatPercent(p.engagementRate)
                  )}
                </p>
                <p className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">
                  ER ({p.erBasis === "reach" ? "reach" : "views"})
                </p>
              </div>

              <div>
                <p className="font-mono text-[13px] tabular-nums text-[var(--ink)]">
                  {formatCompactNumber(p.followers)}
                </p>
                <p className="text-[11px] text-[var(--good-ink)]">
                  {formatSignedPercent((p.followerDelta / p.followers) * 100)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-[var(--space-xl)] text-[11px] text-[var(--ink-3)]">
        ER ของแต่ละแพลตฟอร์มคำนวณจากตัวหารต่างกัน (reach หรือ views) — ห้ามเทียบตรง ๆ ข้ามแพลตฟอร์ม
      </p>
    </div>
  );
}
