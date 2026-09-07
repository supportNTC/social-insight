"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp, Gear, Table } from "@phosphor-icons/react";
import { formatDateTimeBangkok } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: ChartLineUp },
  { href: "/content", label: "คอนเทนต์", icon: Table },
  { href: "/settings", label: "ตั้งค่า", icon: Gear },
];

export function AppHeader({ lastSyncFinishedAt }: { lastSyncFinishedAt: Date | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-[var(--space-2xl)] py-[var(--space-lg)]">
        <div className="flex items-center gap-[var(--space-2xl)]">
          <span className="text-[15px] font-semibold whitespace-nowrap text-[var(--ink)]">
            Social Insight
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none ${
                    active
                      ? "bg-[var(--color-muted)] text-[var(--ink)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--color-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <p className="text-[12px] text-[var(--ink-3)]" title="เวลา sync ล่าสุดที่สำเร็จ">
          {lastSyncFinishedAt
            ? `sync ล่าสุด: ${formatDateTimeBangkok(lastSyncFinishedAt)}`
            : "ยังไม่เคย sync — รัน pnpm sync"}
        </p>
      </div>
    </header>
  );
}
