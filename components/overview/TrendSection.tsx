"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTrend, PLATFORM_LABEL, type Platform } from "@/lib/mock/overview-prototype";
import { formatCompactNumber } from "@/lib/format";

// Validated in design-system/social-insight-dashboard/MASTER.md — fixed CVD
// pairing, do not substitute. Light-mode values (dark handled via CSS vars
// on the chart wrapper, recharts needs literal hex per series).
const SERIES: { key: Platform; color: string }[] = [
  { key: "facebook", color: "#2a78d6" },
  { key: "instagram", color: "#eb6834" },
  { key: "tiktok", color: "#1baf7a" },
];

const RANGES = [
  { key: "7d" as const, label: "7 วัน" },
  { key: "30d" as const, label: "30 วัน" },
];

export function TrendSection() {
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const data = getTrend(range);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">
            ยอด engagement รายวัน
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
            แยกตามแพลตฟอร์ม — ยอดสะสมของแต่ละวัน (ไม่ใช่ยอด delta)
          </p>
        </div>

        <div
          role="group"
          aria-label="ช่วงเวลา"
          className="flex gap-1 rounded-lg bg-[var(--color-muted)] p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none ${
                range === r.key
                  ? "bg-[var(--color-card)] text-[var(--ink)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[var(--space-xl)] h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
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
                PLATFORM_LABEL[name as Platform],
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
                  {PLATFORM_LABEL[value as Platform]}
                </span>
              )}
              iconType="circle"
              iconSize={8}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                animationDuration={300}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
