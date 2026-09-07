export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--color-muted)] ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-[var(--space-lg)] h-7 w-32" />
      <Skeleton className="mt-[var(--space-md)] h-3 w-40" />
    </div>
  );
}
