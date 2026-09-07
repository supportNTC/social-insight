import { Binoculars, Eye, Heart, Percent, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { KpiCard } from "@/components/overview/KpiCard";
import { TrendSection } from "@/components/overview/TrendSection";
import { PlatformSplit } from "@/components/overview/PlatformSplit";
import { FilterBar } from "@/components/overview/FilterBar";
import { RisingList } from "@/components/overview/RisingList";
import { TopPerformers } from "@/components/overview/TopPerformers";
import { UnderperformingList } from "@/components/overview/UnderperformingList";
import { ScrollReveal } from "@/components/overview/ScrollReveal";
import { EmptyState } from "@/components/shared/EmptyState";
import { getOverviewData } from "@/lib/queries/overview";
import { getRecommendations } from "@/lib/queries/recommendations";
import { parseDateRangeKey } from "@/lib/queries/date-range";
import { parsePlatformList } from "@/lib/platform";
import { formatCompactNumber, formatPercentValue, formatSignedCompactNumber, formatSignedPercent } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const range = parseDateRangeKey(params.range);
  const platforms = parsePlatformList(params.platforms);

  const [data, recommendations] = await Promise.all([
    getOverviewData({ range, platforms }),
    getRecommendations({ range, platforms }),
  ]);

  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <header className="mb-[var(--space-2xl)]">
        <h1 className="text-[20px] font-semibold text-[var(--ink)]">Overview</h1>
        <p className="mt-1 text-[14px] text-[var(--ink-2)]">
          ภาพรวม engagement จาก Facebook, Instagram และ TikTok
        </p>
      </header>

      <div className="mb-[var(--space-xl)]">
        <FilterBar range={range} platforms={platforms} />
      </div>

      {!data ? (
        <EmptyState
          title="ยังไม่มีข้อมูล"
          description="ยังไม่เคยรัน sync เลย — รัน pnpm sync เพื่อดึงข้อมูลตัวอย่างจาก MockProvider เข้าระบบ"
        />
      ) : (
        <>
          <ScrollReveal>
            <div className="grid grid-cols-1 gap-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard
                label="Views รวม"
                value={formatCompactNumber(data.kpis.views.total ?? 0)}
                deltaLabel={data.kpis.views.deltaPct === null ? "–" : formatSignedPercent(data.kpis.views.deltaPct)}
                trend={trendOf(data.kpis.views.deltaPct)}
                icon={Eye}
              />
              <KpiCard
                label="Reach รวม"
                value={data.kpis.reach.total === null ? "—" : formatCompactNumber(data.kpis.reach.total)}
                deltaLabel={data.kpis.reach.deltaPct === null ? "–" : formatSignedPercent(data.kpis.reach.deltaPct)}
                trend={trendOf(data.kpis.reach.deltaPct)}
                icon={Binoculars}
              />
              <KpiCard
                label="Engagement ถ่วงน้ำหนัก"
                value={formatCompactNumber(data.kpis.weightedEngagement.total ?? 0)}
                deltaLabel={
                  data.kpis.weightedEngagement.deltaPct === null
                    ? "–"
                    : formatSignedPercent(data.kpis.weightedEngagement.deltaPct)
                }
                trend={trendOf(data.kpis.weightedEngagement.deltaPct)}
                icon={Heart}
              />
              <KpiCard
                label="Engagement Rate"
                value={data.kpis.engagementRate.value === null ? "—" : formatPercentValue(data.kpis.engagementRate.value)}
                deltaLabel={
                  data.kpis.engagementRate.deltaPct === null ? "–" : formatSignedPercent(data.kpis.engagementRate.deltaPct)
                }
                trend={trendOf(data.kpis.engagementRate.deltaPct)}
                icon={Percent}
              />
              <KpiCard
                label="ผู้ติดตามรวม"
                value={formatCompactNumber(data.kpis.followers.total)}
                deltaLabel={formatSignedCompactNumber(data.kpis.followers.delta)}
                compareLabel="เพิ่มขึ้นในช่วงนี้"
                trend={data.kpis.followers.delta > 0 ? "up" : data.kpis.followers.delta < 0 ? "down" : "flat"}
                icon={UsersThree}
              />
            </div>
          </ScrollReveal>

          <div className="mt-[var(--space-2xl)] grid grid-cols-1 gap-[var(--space-2xl)] lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ScrollReveal delayMs={60}>
                <TrendSection trend={data.trend} platforms={platforms} />
              </ScrollReveal>
            </div>
            <ScrollReveal delayMs={120}>
              <PlatformSplit breakdown={data.platformBreakdown} />
            </ScrollReveal>
          </div>

          {recommendations && (
            <>
              <div className="mt-[var(--space-2xl)] grid grid-cols-1 gap-[var(--space-2xl)] lg:grid-cols-3">
                <ScrollReveal delayMs={60}>
                  <RisingList items={recommendations.rising} />
                </ScrollReveal>
                <div className="lg:col-span-2">
                  <ScrollReveal delayMs={120}>
                    <TopPerformers
                      items={recommendations.top}
                      mixesErBasis={recommendations.topMixesErBasis}
                    />
                  </ScrollReveal>
                </div>
              </div>

              <div className="mt-[var(--space-2xl)]">
                <ScrollReveal delayMs={60}>
                  <UnderperformingList
                    items={recommendations.underperforming}
                    thresholds={recommendations.thresholds}
                    maturityDays={recommendations.maturityDays}
                  />
                </ScrollReveal>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function trendOf(deltaPct: number | null): "up" | "down" | "flat" {
  if (deltaPct === null) return "flat";
  return deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat";
}
