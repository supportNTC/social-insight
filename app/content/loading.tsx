import { Skeleton } from "@/components/shared/Skeleton";

export default function ContentLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-[var(--space-xl)] h-10 w-full max-w-md" />
      <div className="mt-[var(--space-xl)] space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}
