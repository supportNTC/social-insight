import { GoalForm } from "@/components/goals/GoalForm";
import { GoalList } from "@/components/goals/GoalList";
import { MonthPicker } from "@/components/goals/MonthPicker";
import { CourseConversionForm } from "@/components/goals/CourseConversionForm";
import { CourseConversionList } from "@/components/goals/CourseConversionList";
import { getLatestDataDate } from "@/lib/queries/latest-data-date";
import {
  currentMonthKey,
  getCourseConversionEntries,
  getGoalsForMonth,
  isMonthKey,
  monthStart,
  type MonthKey,
} from "@/lib/queries/goals";
import { snapshotDateFor } from "@/lib/datetime";

// No searchParams that Next treats as force-dynamic on their own by default
// here (month has a fallback), but goals/entries change after every form
// submit — this must never be frozen as a build-time static snapshot, same
// reasoning as /settings.
export const dynamic = "force-dynamic";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const anchor = await getLatestDataDate();
  const today = snapshotDateFor(new Date());
  const anchorMonth = currentMonthKey(anchor ?? today);
  const month: MonthKey = isMonthKey(params.month) ? params.month : anchorMonth;

  const [goals, entries] = await Promise.all([getGoalsForMonth(month), getCourseConversionEntries(month)]);

  // Default the date field to today when logging for the current month, or
  // to the 1st when logging for a past/future month — either way it lands
  // inside the month actually being viewed, not silently outside it.
  const defaultEntryDate = currentMonthKey(today) === month ? today : monthStart(month);

  return (
    <main className="mx-auto max-w-[1280px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <header className="mb-[var(--space-2xl)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--ink)]">เป้าหมาย</h1>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">
            ตั้งเป้า engagement และยอดสมัคร course รายเดือน — ดูความคืบหน้าเทียบเป้าที่ตั้งไว้
          </p>
        </div>
        <MonthPicker month={month} anchorMonth={anchorMonth} />
      </header>

      <div className="flex flex-col gap-[var(--space-2xl)]">
        <GoalList goals={goals} />
        <GoalForm month={month} />
        <CourseConversionForm defaultDate={defaultEntryDate} />
        <CourseConversionList entries={entries} />
      </div>
    </main>
  );
}
