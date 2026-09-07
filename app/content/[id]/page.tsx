import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, Clock } from "@phosphor-icons/react/dist/ssr";
import { GrowthChart } from "@/components/content/GrowthChart";
import { getContentDetail } from "@/lib/queries/content-detail";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatDateTimeBangkok, formatNumber, formatPercentValue } from "@/lib/format";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const content = await getContentDetail(id);
  if (!content) notFound();

  const latest = content.growth.at(-1);

  return (
    <main className="mx-auto max-w-[900px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <Link
        href="/content"
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-colors duration-150 hover:text-[var(--ink)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        กลับไปหน้าคอนเทนต์
      </Link>

      <header className="mt-[var(--space-lg)]">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: PLATFORM_MARK_COLOR[content.platform] }}
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium text-[var(--ink-2)]">
            {PLATFORM_LABEL[content.platform]} · {content.accountName}
          </span>
        </div>
        <h1 className="mt-[var(--space-sm)] text-[20px] font-semibold text-[var(--ink)]">
          {content.caption ?? <span className="text-[var(--ink-3)] italic">ไม่มีแคปชัน</span>}
        </h1>
        <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--ink-2)]">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} aria-hidden="true" />
            {formatDateTimeBangkok(content.publishedAt)}
          </span>
          {content.durationSeconds !== null && <span>{content.durationSeconds} วินาที</span>}
          {content.permalink && (
            <a
              href={content.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 text-[var(--accent-ink)] hover:underline"
            >
              ดูโพสต์จริง
              <ArrowSquareOut size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      </header>

      <div className="mt-[var(--space-2xl)] grid grid-cols-2 gap-[var(--space-lg)] sm:grid-cols-4">
        <Stat label="Views" value={latest ? formatNumber(latest.views) : "—"} />
        <Stat label="Likes" value={latest ? formatNumber(latest.likes) : "—"} />
        <Stat label="Comments" value={latest ? formatNumber(latest.comments) : "—"} />
        <Stat
          label="Engagement Rate"
          value={content.latestEngagementRate ? formatPercentValue(content.latestEngagementRate.value) : "—"}
          hint={content.latestEngagementRate ? `(${content.latestEngagementRate.basis})` : undefined}
        />
      </div>

      <div className="mt-[var(--space-2xl)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">การเติบโตรายวัน</h2>
        <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
          ยอดสะสมนับตั้งแต่วันที่เผยแพร่ ({content.growth.length} วันของข้อมูล)
        </p>
        <div className="mt-[var(--space-xl)]">
          <GrowthChart growth={content.growth} />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-lg)]">
      <p className="text-[11px] font-medium tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-[var(--ink)]">
        {value} {hint && <span className="text-[11px] font-normal text-[var(--ink-3)]">{hint}</span>}
      </p>
    </div>
  );
}
