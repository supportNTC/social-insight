import { Skeleton } from "@/components/shared/Skeleton";

export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-[900px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-[var(--space-2xl)] flex flex-col gap-[var(--space-2xl)]">
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    </main>
  );
}
