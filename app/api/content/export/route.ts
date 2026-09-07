import { NextResponse } from "next/server";
import { getAllMatchingContent, isContentSortKey } from "@/lib/queries/content-list";
import { parsePlatformList, PLATFORM_LABEL } from "@/lib/platform";
import { formatDateBangkok, formatPercentValue } from "@/lib/format";
import { toCsv } from "@/lib/csv";

const HEADER_ROW = [
  "แพลตฟอร์ม",
  "ประเภท",
  "แคปชัน",
  "วันที่เผยแพร่",
  "Views",
  "Likes",
  "Comments",
  "Shares",
  "Engagement Rate",
  "ER Basis",
  "Performance Score",
];

/** Same filters as /content — exports exactly what's on screen, unpaginated. */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const platforms = parsePlatformList(url.searchParams.get("platforms") ?? undefined);
  const search = url.searchParams.get("search") ?? "";
  const sortParam = url.searchParams.get("sort") ?? undefined;
  const sort = isContentSortKey(sortParam) ? sortParam : "published_desc";

  const result = await getAllMatchingContent({ platforms, search, sort });

  const rows = result.rows.map((row) => [
    PLATFORM_LABEL[row.platform],
    row.kind,
    row.caption,
    formatDateBangkok(row.publishedAt),
    row.views,
    row.likes,
    row.comments,
    row.shares,
    row.engagementRate ? formatPercentValue(row.engagementRate.value) : "",
    row.engagementRate?.basis ?? "",
    row.performanceScore !== null ? row.performanceScore.toFixed(2) : "",
  ]);

  const csv = toCsv([HEADER_ROW, ...rows]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="content-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
