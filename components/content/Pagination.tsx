import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--ink-2)]">
      <p>
        {start}–{end} จาก {total} รายการ
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={page > 1 ? buildHref(page - 1) : null} label="ก่อนหน้า" icon={CaretLeft} />
        <span className="px-2 font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <PageLink href={page < totalPages ? buildHref(page + 1) : null} label="ถัดไป" icon={CaretRight} iconAfter />
      </div>
    </div>
  );
}

function PageLink({
  href,
  label,
  icon: Icon,
  iconAfter = false,
}: {
  href: string | null;
  label: string;
  icon: typeof CaretLeft;
  iconAfter?: boolean;
}) {
  const content = (
    <>
      {!iconAfter && <Icon size={14} aria-hidden="true" />}
      {label}
      {iconAfter && <Icon size={14} aria-hidden="true" />}
    </>
  );

  const className =
    "flex items-center gap-1 rounded-md px-2 py-1.5 font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none";

  if (!href) {
    return <span className={`${className} cursor-not-allowed text-[var(--ink-3)]`}>{content}</span>;
  }

  return (
    <Link href={href} className={`${className} cursor-pointer text-[var(--ink)] hover:bg-[var(--color-muted)]`}>
      {content}
    </Link>
  );
}
