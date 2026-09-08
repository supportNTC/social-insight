"use client";

import { useActionState, useEffect, useRef } from "react";
import { logCourseConversionAction } from "@/app/goals/actions";
import { ALL_PLATFORMS, PLATFORM_LABEL } from "@/lib/platform";
import type { SnapshotDate } from "@/lib/datetime";
import { FORM_ACTION_OK } from "@/lib/form-action-state";
import { FormErrorBanner } from "@/components/shared/FormErrorBanner";

export function CourseConversionForm({ defaultDate }: { defaultDate: SnapshotDate }) {
  const [state, formAction] = useActionState(logCourseConversionAction, FORM_ACTION_OK);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]"
    >
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">บันทึกยอดสมัคร Course</h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        ยังไม่มีระบบเชื่อมโยงอัตโนมัติ — กรอกจำนวนที่ทีมนับได้เองเป็นรอบ ๆ
      </p>

      {state.error && (
        <div className="mt-[var(--space-lg)]">
          <FormErrorBanner ref={errorRef} message={state.error} />
        </div>
      )}

      <div className="mt-[var(--space-xl)] grid grid-cols-1 gap-[var(--space-lg)] sm:grid-cols-4">
        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">วันที่</span>
          <input
            type="date"
            name="entryDate"
            required
            defaultValue={defaultDate}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">แพลตฟอร์มที่มา (ถ้าทราบ)</span>
          <select
            name="platform"
            defaultValue=""
            className="mt-1 w-full cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          >
            <option value="">ไม่ระบุ</option>
            {ALL_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABEL[platform]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">จำนวนคน</span>
          <input
            type="number"
            name="count"
            min={1}
            step={1}
            required
            aria-describedby={state.error ? "course-form-error" : undefined}
            placeholder="เช่น 3"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-[14px] tabular-nums text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">โน้ต (ถ้ามี)</span>
          <input
            type="text"
            name="note"
            placeholder="เช่น ชื่อแคมเปญ"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-[var(--space-xl)] cursor-pointer rounded-lg bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
      >
        บันทึก
      </button>
    </form>
  );
}
