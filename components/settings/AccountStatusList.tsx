import type { SyncStatus } from "@prisma/client";
import { CheckCircle, Clock, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { AccountSyncStatus } from "@/lib/queries/sync-status";
import { PLATFORM_LABEL, PLATFORM_MARK_COLOR } from "@/lib/platform";
import { formatDateTimeBangkok, formatNumber } from "@/lib/format";

const STATUS_ICON: Record<SyncStatus, typeof CheckCircle> = {
  success: CheckCircle,
  failed: XCircle,
  partial: WarningCircle,
  running: Clock,
};
const STATUS_LABEL: Record<SyncStatus, string> = {
  success: "สำเร็จ",
  failed: "ล้มเหลว",
  partial: "สำเร็จบางส่วน",
  running: "กำลังทำงาน",
};
const STATUS_COLOR: Record<SyncStatus, string> = {
  success: "text-[var(--good-ink)]",
  failed: "text-[var(--critical-ink)]",
  partial: "text-[var(--warning-ink)]",
  running: "text-[var(--ink-2)]",
};

export function AccountStatusList({ accounts }: { accounts: AccountSyncStatus[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]">
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">สถานะบัญชี</h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">บัญชีที่เชื่อมต่อและเวลา sync ล่าสุด</p>

      {accounts.length === 0 ? (
        <p className="mt-[var(--space-lg)] text-[13px] text-[var(--ink-3)]">
          ยังไม่มีบัญชี — รัน <code>pnpm sync</code> เพื่อสร้างบัญชีตัวอย่าง
        </p>
      ) : (
        <ul className="mt-[var(--space-xl)] divide-y divide-[var(--color-border)]">
          {accounts.map((account) => {
            const Icon = account.lastSync ? STATUS_ICON[account.lastSync.status] : Clock;
            return (
              <li key={account.accountId} className="flex items-center justify-between gap-3 py-[var(--space-lg)] first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PLATFORM_MARK_COLOR[account.platform] }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-[14px] font-medium text-[var(--ink)]">{account.name}</p>
                    <p className="text-[12px] text-[var(--ink-2)]">{PLATFORM_LABEL[account.platform]}</p>
                  </div>
                </div>

                <div className="text-right">
                  {account.lastSync ? (
                    <>
                      <p className={`flex items-center justify-end gap-1 text-[13px] font-medium ${STATUS_COLOR[account.lastSync.status]}`}>
                        <Icon size={14} aria-hidden="true" />
                        {STATUS_LABEL[account.lastSync.status]}
                      </p>
                      <p className="text-[12px] text-[var(--ink-2)]">
                        {account.lastSync.finishedAt ? formatDateTimeBangkok(account.lastSync.finishedAt) : "กำลังทำงาน"} ·{" "}
                        {formatNumber(account.lastSync.itemsSynced)} รายการ
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-[var(--ink-3)]">ยังไม่เคย sync</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
