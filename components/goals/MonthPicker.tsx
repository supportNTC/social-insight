"use client";

import { useRouter } from "next/navigation";
import { addMonths, currentMonthKey, type MonthKey } from "@/lib/queries/goals";
import { formatMonthLabel } from "@/lib/format";

const MONTHS_BACK = 12;
const MONTHS_FORWARD = 3;

export function MonthPicker({ month, anchorMonth }: { month: MonthKey; anchorMonth: MonthKey }) {
  const router = useRouter();

  const options: MonthKey[] = [];
  for (let i = -MONTHS_BACK; i <= MONTHS_FORWARD; i += 1) {
    options.push(addMonths(anchorMonth, i));
  }
  // Always include the currently-viewed month even if it falls outside the
  // generated range (e.g. a bookmarked link from further back).
  if (!options.includes(month)) options.push(month);
  options.sort();

  return (
    <select
      value={month}
      onChange={(e) => router.push(`/goals?month=${e.target.value}`)}
      aria-label="เดือน"
      className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
    >
      {options.map((key) => (
        <option key={key} value={key}>
          {formatMonthLabel(key)}
          {key === currentMonthKey(anchorMonth) ? " (เดือนนี้)" : ""}
        </option>
      ))}
    </select>
  );
}
