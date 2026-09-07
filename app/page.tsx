import { ChartLineUp, Percent, Flame, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { KpiCard } from "@/components/overview/KpiCard";
import { TrendSection } from "@/components/overview/TrendSection";
import { PlatformSplit } from "@/components/overview/PlatformSplit";
import { RecommendationList } from "@/components/overview/RecommendationList";
import { ScrollReveal } from "@/components/overview/ScrollReveal";
import { KPI_SUMMARY } from "@/lib/mock/overview-prototype";
import { formatCompactNumber, formatPercent, formatSignedPercent } from "@/lib/format";

export default function OverviewPage() {
  const k = KPI_SUMMARY;

  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <header className="mb-[var(--space-3xl)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[var(--ink)]">
              Social Insight Dashboard
            </h1>
            <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[11px] font-medium tracking-wide text-[var(--ink-2)] uppercase">
              Prototype · ข้อมูลตัวอย่าง
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">
            ภาพรวม engagement จาก Facebook, Instagram และ TikTok — Stage 4 (sync engine
            จริง) ยังไม่เริ่ม ตัวเลขในหน้านี้เป็นข้อมูลตัวอย่างสำหรับดูดีไซน์เท่านั้น
          </p>
        </div>
      </header>

      <ScrollReveal>
        <div className="grid grid-cols-1 gap-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Reach รวม"
            value={formatCompactNumber(k.totalReach)}
            deltaLabel={formatSignedPercent(k.totalReachDeltaPct)}
            trend={k.totalReachDeltaPct >= 0 ? "up" : "down"}
            icon={ChartLineUp}
          />
          <KpiCard
            label="Engagement Rate เฉลี่ย"
            value={formatPercent(k.avgEngagementRate)}
            deltaLabel={formatSignedPercent(k.avgEngagementRateDeltaPct)}
            trend={k.avgEngagementRateDeltaPct >= 0 ? "up" : "down"}
            icon={Percent}
          />
          <KpiCard
            label="คอนเทนต์กำลังมาแรง"
            value={String(k.risingCount)}
            deltaLabel="72 ชม.ล่าสุด"
            trend="flat"
            icon={Flame}
          />
          <KpiCard
            label="ผู้ติดตามรวม"
            value={formatCompactNumber(k.totalFollowers)}
            deltaLabel={`+${formatCompactNumber(k.totalFollowerDelta)}`}
            trend="up"
            icon={UsersThree}
          />
        </div>
      </ScrollReveal>

      <div className="mt-[var(--space-2xl)] grid grid-cols-1 gap-[var(--space-2xl)] lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScrollReveal delayMs={60}>
            <TrendSection />
          </ScrollReveal>
        </div>
        <ScrollReveal delayMs={120}>
          <PlatformSplit />
        </ScrollReveal>
      </div>

      <div className="mt-[var(--space-2xl)]">
        <ScrollReveal delayMs={180}>
          <RecommendationList />
        </ScrollReveal>
      </div>
    </main>
  );
}
