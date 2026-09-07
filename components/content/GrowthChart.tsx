"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ContentGrowthPoint } from "@/lib/queries/content-detail";
import { formatCompactNumber } from "@/lib/format";

const VIEWS_COLOR = "#0080FF";
const REACH_COLOR = "#8b5cf6";

export function GrowthChart({ growth }: { growth: ContentGrowthPoint[] }) {
  const hasReach = growth.some((p) => p.reach !== null);

  return (
    <div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={growth} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="snapshotDate"
              tick={{ fontSize: 12, fill: "var(--ink-2)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--ink-2)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompactNumber(v)}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCompactNumber(Number(value)),
                name === "views" ? "Views" : "Reach",
              ]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ color: "var(--ink-2)", fontSize: 13 }}>
                  {value === "views" ? "Views" : "Reach"}
                </span>
              )}
              iconType="circle"
              iconSize={8}
            />
            <Line type="monotone" dataKey="views" name="views" stroke={VIEWS_COLOR} strokeWidth={2} dot={false} />
            {hasReach && (
              <Line
                type="monotone"
                dataKey="reach"
                name="reach"
                stroke={REACH_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!hasReach && (
        <p className="mt-[var(--space-md)] text-[12px] text-[var(--ink-3)]">
          แพลตฟอร์มนี้ไม่รายงานข้อมูล reach
        </p>
      )}
    </div>
  );
}
