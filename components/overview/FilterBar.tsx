"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Platform } from "@prisma/client";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/queries/date-range";
import { ALL_PLATFORMS, PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";

export function FilterBar({
  range,
  platforms,
}: {
  range: DateRangeKey;
  platforms: Platform[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function toggleModule(platform: Platform) {
    const isSelected = platforms.includes(platform);
    // Never allow deselecting the last remaining platform — an empty filter
    // is ambiguous (does it mean "all" or "none"?), so the UI just disallows it.
    if (isSelected && platforms.length === 1) return;
    const next = isSelected ? platforms.filter((p) => p !== platform) : [...platforms, platform];
    pushParams({ platforms: next.join(",") });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="ช่วงเวลา" className="flex gap-1 rounded-lg bg-[var(--color-muted)] p-1">
        {DATE_RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => pushParams({ range: option.key })}
            aria-pressed={range === option.key}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none ${
              range === option.key
                ? "bg-[var(--color-card)] text-[var(--ink)] shadow-[var(--shadow-sm)]"
                : "text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="แพลตฟอร์ม" className="flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((platform) => {
          const selected = platforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => toggleModule(platform)}
              aria-pressed={selected}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none ${
                selected
                  ? "border-transparent bg-[var(--color-muted)] text-[var(--ink)]"
                  : "border-[var(--color-border)] text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selected ? PLATFORM_MARK_COLOR[platform] : "transparent", border: selected ? "none" : `1px solid ${PLATFORM_MARK_COLOR[platform]}` }}
                aria-hidden="true"
              />
              {PLATFORM_LABEL[platform]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
