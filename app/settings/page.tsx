import { WeightsForm } from "@/components/settings/WeightsForm";
import { AccountStatusList } from "@/components/settings/AccountStatusList";
import { getMetricWeights } from "@/lib/queries/weights";
import { getAccountSyncStatuses } from "@/lib/queries/sync-status";

// No searchParams/params to force dynamic rendering on their own, but this
// page reads live DB state (weights, sync status) that changes after every
// sync and every settings edit — it must never be frozen as a build-time
// static snapshot the way Next would otherwise optimize it into.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [weights, accounts] = await Promise.all([getMetricWeights(), getAccountSyncStatuses()]);

  return (
    <main className="mx-auto max-w-[900px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <header className="mb-[var(--space-2xl)]">
        <h1 className="text-[20px] font-semibold text-[var(--ink)]">ตั้งค่า</h1>
        <p className="mt-1 text-[14px] text-[var(--ink-2)]">
          ปรับน้ำหนัก metric และตรวจสอบสถานะบัญชี
        </p>
      </header>

      <div className="flex flex-col gap-[var(--space-2xl)]">
        <WeightsForm weights={weights} />
        <AccountStatusList accounts={accounts} />
      </div>
    </main>
  );
}
