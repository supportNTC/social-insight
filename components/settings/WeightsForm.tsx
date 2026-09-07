import { updateWeightsAction } from "@/app/settings/actions";
import type { MetricWeights } from "@/lib/metrics";

const FIELDS: { name: keyof MetricWeights; label: string }[] = [
  { name: "likeWeight", label: "Like" },
  { name: "commentWeight", label: "Comment" },
  { name: "shareWeight", label: "Share" },
  { name: "saveWeight", label: "Save" },
];

export function WeightsForm({ weights }: { weights: MetricWeights }) {
  return (
    <form
      action={updateWeightsAction}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-[var(--space-2xl)] shadow-[var(--shadow-md)]"
    >
      <h2 className="text-[16px] font-semibold text-[var(--ink)]">น้ำหนัก Metric</h2>
      <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
        ใช้คำนวณ weighted engagement และ engagement rate ทั่วทั้งระบบ
      </p>

      <div className="mt-[var(--space-xl)] grid grid-cols-2 gap-[var(--space-lg)] sm:grid-cols-4">
        {FIELDS.map((field) => (
          <label key={field.name} className="block">
            <span className="text-[13px] font-medium text-[var(--ink-2)]">{field.label}</span>
            <input
              type="number"
              name={field.name}
              defaultValue={weights[field.name]}
              min={0}
              step={0.5}
              required
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-[14px] tabular-nums text-[var(--ink)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
            />
          </label>
        ))}
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
