import { Skeleton } from "@/components/shared/Skeleton";

export default function GoalsLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <div className="mb-[var(--space-2xl)] flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex flex-col gap-[var(--space-2xl)]">
        <div className="grid grid-cols-1 gap-[var(--space-lg)] sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </main>
  );
}
