import { Skeleton, SkeletonCard } from "@/components/shared/Skeleton";

export default function OverviewLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-[var(--space-xl)] grid grid-cols-1 gap-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="mt-[var(--space-2xl)] grid grid-cols-1 gap-[var(--space-2xl)] lg:grid-cols-3">
        <Skeleton className="h-[340px] lg:col-span-2" />
        <Skeleton className="h-[340px]" />
      </div>

      {/* Recommendation sections: rising + top 10, then "ต่ำกว่าปกติ". */}
      <div className="mt-[var(--space-2xl)] grid grid-cols-1 gap-[var(--space-2xl)] lg:grid-cols-3">
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[320px] lg:col-span-2" />
      </div>
      <Skeleton className="mt-[var(--space-2xl)] h-[240px]" />
    </main>
  );
}
