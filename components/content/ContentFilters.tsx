"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Platform } from "@prisma/client";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { ALL_PLATFORMS, PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";

export function ContentFilters({
  search,
  platforms,
}: {
  search: string;
  platforms: Platform[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);

  // Debounced so every keystroke doesn't trigger a navigation/fetch.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput === search) return;
      pushParams({ search: searchInput, page: "1" });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function togglePlatform(platform: Platform) {
    const isSelected = platforms.includes(platform);
    if (isSelected && platforms.length === 1) return; // never allow an empty (ambiguous) filter
    const next = isSelected ? platforms.filter((p) => p !== platform) : [...platforms, platform];
    pushParams({ platforms: next.join(","), page: "1" });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ink-3)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ค้นหาแคปชัน..."
          aria-label="ค้นหาแคปชัน"
          className="w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pr-3 pl-9 text-[13px] text-[var(--ink)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
        />
      </div>

      <div role="group" aria-label="แพลตฟอร์ม" className="flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((platform) => {
          const selected = platforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              aria-pressed={selected}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none ${
                selected
                  ? "border-transparent bg-[var(--color-muted)] text-[var(--ink)]"
                  : "border-[var(--color-border)] text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: selected ? PLATFORM_MARK_COLOR[platform] : "transparent",
                  border: selected ? "none" : `1px solid ${PLATFORM_MARK_COLOR[platform]}`,
                }}
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
