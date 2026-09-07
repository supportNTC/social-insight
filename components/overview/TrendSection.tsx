"use client";

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
import type { Platform } from "@prisma/client";
import type { TrendPoint } from "@/lib/queries/overview";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatCompactNumber } from "@/lib/format";

export function TrendSection({ trend, platforms }: { trend: TrendPoint[]; platforms: Platform[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">Engagement ถ่วงน้ำหนักรายวัน</h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        แยกตามแพลตฟอร์ม — คำนวณจากยอด delta ของแต่ละวัน ไม่ใช่ยอดสะสม
      </p>

      <div className="mt-[var(--space-xl)] h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              {platforms.map((platform) => (
                <linearGradient key={platform} id={`fill-${platform}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PLATFORM_MARK_COLOR[platform]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={PLATFORM_MARK_COLOR[platform]} stopOpacity={0} />
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
            {platforms.map((platform) => (
              <Area
                key={platform}
                type="monotone"
                dataKey={platform}
                name={platform}
                stroke={PLATFORM_MARK_COLOR[platform]}
                strokeWidth={2}
                fill={`url(#fill-${platform})`}
                connectNulls
                animationDuration={300}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
