"use client";

import { useActionState, useEffect, useRef } from "react";
import { upsertGoalAction } from "@/app/goals/actions";
import { GOAL_METRIC_LABEL, GOAL_METRICS } from "@/lib/goal-labels";
import { ALL_PLATFORMS, PLATFORM_LABEL } from "@/lib/platform";
import type { MonthKey } from "@/lib/queries/goals";
import { FORM_ACTION_OK } from "@/lib/form-action-state";
import { FormErrorBanner } from "@/components/shared/FormErrorBanner";

export function GoalForm({ month }: { month: MonthKey }) {
  const [state, formAction] = useActionState(upsertGoalAction, FORM_ACTION_OK);
  const errorRef = useRef<HTMLDivElement>(null);

  // Moves focus to the error so a keyboard/screen-reader user lands on it
  // immediately instead of having to hunt for what failed (pro-rules.md:
  // "multi-error forms also focus a linked error summary after submit").
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]"
    >
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">ตั้ง/แก้ไขเป้าหมาย</h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        ตั้งได้ทั้งภาพรวมทุกแพลตฟอร์ม และแยกเป็นรายแพลตฟอร์ม — ตั้งซ้ำเดือน/metric/แพลตฟอร์มเดิมจะแก้ไขของเดิม
      </p>

      {state.error && (
        <div className="mt-[var(--space-lg)]">
          <FormErrorBanner ref={errorRef} message={state.error} />
        </div>
      )}

      <input type="hidden" name="month" value={month} />

      <div className="mt-[var(--space-xl)] grid grid-cols-1 gap-[var(--space-lg)] sm:grid-cols-3">
        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">Metric</span>
          <select
            name="metric"
            required
            defaultValue="weighted_engagement"
            className="mt-1 w-full cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          >
            {GOAL_METRICS.map((metric) => (
              <option key={metric} value={metric}>
                {GOAL_METRIC_LABEL[metric]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">แพลตฟอร์ม</span>
          <select
            name="platform"
            defaultValue=""
            className="mt-1 w-full cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          >
            <option value="">ทุกแพลตฟอร์มรวมกัน</option>
            {ALL_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABEL[platform]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">เป้าหมาย</span>
          <input
            type="number"
            name="targetValue"
            min={1}
            step="any"
            required
            aria-describedby={state.error ? "goal-form-error" : undefined}
            placeholder="เช่น 50000"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-[14px] tabular-nums text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-[var(--space-xl)] cursor-pointer rounded-lg bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
      >
        บันทึกเป้าหมาย
      </button>
    </form>
  );
}
