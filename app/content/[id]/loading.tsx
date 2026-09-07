import { Skeleton } from "@/components/shared/Skeleton";

export default function ContentDetailLoading() {
  return (
    <main className="mx-auto max-w-[900px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-[var(--space-lg)] h-6 w-96" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-[var(--space-2xl)] grid grid-cols-2 gap-[var(--space-lg)] sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="mt-[var(--space-2xl)] h-[340px]" />
    </main>
  );
}
