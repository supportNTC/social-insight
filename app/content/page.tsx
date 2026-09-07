import Link from "next/link";
import {
  FilmSlate,
  Image as ImageIcon,
  SquaresFour,
  VideoCamera,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import { ContentFilters } from "@/components/content/ContentFilters";
import { Pagination } from "@/components/content/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { getContentList, isContentSortKey, type ContentSortKey } from "@/lib/queries/content-list";
import { parsePlatformList, PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber, formatDateBangkok, formatPercentValue } from "@/lib/format";
import type { ContentKind } from "@prisma/client";

const PAGE_SIZE = 20;

const KIND_ICON: Record<ContentKind, typeof VideoCamera> = {
  video: VideoCamera,
  image: ImageIcon,
  reel: FilmSlate,
  carousel: SquaresFour,
};

const COLUMNS: { key: ContentSortKey; label: string }[] = [
  { key: "published_desc", label: "วันที่เผยแพร่" },
  { key: "views_desc", label: "Views" },
  { key: "er_desc", label: "Engagement Rate" },
  { key: "score_desc", label: "Performance Score" },
];
// A column header always links to its own "_desc" variant first, then
// flips to "_asc" once that's already the active sort.
function otherDirection(sort: ContentSortKey): ContentSortKey {
  return sort.endsWith("_desc")
    ? (sort.replace("_desc", "_asc") as ContentSortKey)
    : (sort.replace("_asc", "_desc") as ContentSortKey);
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const platforms = parsePlatformList(params.platforms);
  const search = params.search ?? "";
  const sort = isContentSortKey(params.sort) ? params.sort : "published_desc";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const result = await getContentList({ platforms, search, sort, page, pageSize: PAGE_SIZE });

  function buildHref(overrides: Record<string, string>): string {
    const query = new URLSearchParams({
      platforms: platforms.join(","),
      search,
      sort,
      page: String(page),
      ...overrides,
    });
    return `/content?${query.toString()}`;
  }

  const exportHref = `/api/content/export?${new URLSearchParams({ platforms: platforms.join(","), search, sort }).toString()}`;

  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <header className="mb-[var(--space-2xl)] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--ink)]">คอนเทนต์</h1>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">
            คอนเทนต์ทั้งหมดจาก Facebook, Instagram และ TikTok
          </p>
        </div>
        <a
          href={exportHref}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
        >
          <DownloadSimple size={16} aria-hidden="true" />
          Export CSV
        </a>
      </header>

      <div className="mb-[var(--space-xl)]">
        <ContentFilters search={search} platforms={platforms} />
      </div>

      {result.anchor === null ? (
        <EmptyState
          title="ยังไม่มีข้อมูล"
          description="ยังไม่เคยรัน sync เลย — รัน pnpm sync เพื่อดึงข้อมูลตัวอย่างเข้าระบบ"
        />
      ) : result.total === 0 ? (
        <EmptyState title="ไม่พบคอนเทนต์" description="ลองเปลี่ยนคำค้นหาหรือตัวกรองแพลตฟอร์ม" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-md)]">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[12px] tracking-wide text-[var(--ink-3)] uppercase">
                  <th className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">คอนเทนต์</th>
                  {COLUMNS.map((column) => {
                    const active = sort.startsWith(column.key.split("_")[0] ?? "");
                    const nextSort = active ? otherDirection(sort) : column.key;
                    return (
                      <th key={column.key} className="px-[var(--space-lg)] py-[var(--space-md)] font-medium">
                        <Link
                          href={buildHref({ sort: nextSort, page: "1" })}
                          className={`cursor-pointer transition-colors duration-150 hover:text-[var(--ink)] ${active ? "text-[var(--accent-ink)]" : ""}`}
                        >
                          {column.label}
                          {active && (sort.endsWith("_desc") ? " ↓" : " ↑")}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const KindIcon = KIND_ICON[row.kind];
                  const scoreColor =
                    row.performanceScore === null
                      ? "text-[var(--ink-3)]"
                      : row.performanceScore >= 1.2
                        ? "text-[var(--good-ink)]"
                        : row.performanceScore < 0.8
                          ? "text-[var(--critical-ink)]"
                          : "text-[var(--ink-2)]";

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-muted)]"
                    >
                      <td className="px-[var(--space-lg)] py-[var(--space-md)]">
                        <Link href={`/content/${row.id}`} className="flex cursor-pointer items-center gap-3">
                          {/* Mock thumbnailUrl points to a non-resolving domain — a
                              styled placeholder until real providers (Stage 6)
                              supply resolvable thumbnails. */}
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${PLATFORM_MARK_COLOR[row.platform]}22` }}
                          >
                            <KindIcon size={18} style={{ color: PLATFORM_MARK_COLOR[row.platform] }} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[280px] truncate font-medium text-[var(--ink)]">
                              {row.caption ?? <span className="text-[var(--ink-3)] italic">ไม่มีแคปชัน</span>}
                            </p>
                            <p className="text-[12px] text-[var(--ink-2)]">{PLATFORM_LABEL[row.platform]}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-[var(--space-lg)] py-[var(--space-md)] whitespace-nowrap text-[var(--ink-2)]">
                        {formatDateBangkok(row.publishedAt)}
                      </td>
                      <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono tabular-nums">
                        {formatCompactNumber(row.views)}
                      </td>
                      <td className="px-[var(--space-lg)] py-[var(--space-md)] font-mono tabular-nums">
                        {row.engagementRate ? (
                          <>
                            {formatPercentValue(row.engagementRate.value)}
                            <span className="ml-1 text-[11px] text-[var(--ink-3)]">({row.engagementRate.basis})</span>
                          </>
                        ) : (
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </td>
                      <td className={`px-[var(--space-lg)] py-[var(--space-md)] font-mono font-medium tabular-nums ${scoreColor}`}>
                        {row.performanceScore === null ? "—" : `${row.performanceScore.toFixed(2)}×`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-[var(--space-xl)]">
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              buildHref={(p) => buildHref({ page: String(p) })}
            />
          </div>
        </>
      )}
    </main>
  );
}
