"use server";

import { revalidatePath } from "next/cache";
import type { Platform } from "@prisma/client";
import {
  deleteCourseConversionEntry,
  deleteGoal,
  logCourseConversion,
  upsertGoal,
} from "@/lib/queries/goals";
import { FORM_ACTION_OK, type FormActionState } from "@/lib/form-action-state";

/**
 * `updatedBy`/`createdBy` are hardcoded — CLAUDE.md: there is no auth/SSO
 * decision yet, so there is no real user identity to attribute this to.
 */
const ACTOR = "goals-ui";

function parsePlatform(value: FormDataEntryValue | null): Platform | null {
  return value === "facebook" || value === "instagram" || value === "tiktok" ? value : null;
}

/**
 * Returns an error result instead of throwing — bound to a form via
 * `useActionState` (see components/goals/GoalForm.tsx) so an invalid target
 * shows inline next to the form, not a full-page crash.
 */
export async function upsertGoalAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const metric = formData.get("metric");
  const month = formData.get("month");
  const targetValue = Number(formData.get("targetValue"));
  const platform = parsePlatform(formData.get("platform"));

  if (metric !== "weighted_engagement" && metric !== "followers" && metric !== "course_conversions") {
    return { error: `ค่า metric ไม่ถูกต้อง: ${String(metric)}` };
  }
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "เดือนไม่ถูกต้อง" };
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return { error: "เป้าหมายต้องเป็นตัวเลขที่มากกว่า 0" };
  }

  await upsertGoal({ metric, platform, month, targetValue }, ACTOR);

  revalidatePath("/goals");
  revalidatePath("/");
  return FORM_ACTION_OK;
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("ไม่พบเป้าหมายที่จะลบ");

  await deleteGoal(id);

  revalidatePath("/goals");
  revalidatePath("/");
}

export async function logCourseConversionAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const entryDate = formData.get("entryDate");
  const platform = parsePlatform(formData.get("platform"));
  const count = Number(formData.get("count"));
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  if (typeof entryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { error: "วันที่ไม่ถูกต้อง" };
  }
  if (!Number.isInteger(count) || count <= 0) {
    return { error: "จำนวนต้องเป็นจำนวนเต็มที่มากกว่า 0" };
  }

  await logCourseConversion({ entryDate, platform, count, note }, ACTOR);

  revalidatePath("/goals");
  revalidatePath("/");
  return FORM_ACTION_OK;
}

export async function deleteCourseConversionAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("ไม่พบรายการที่จะลบ");

  await deleteCourseConversionEntry(id);

  revalidatePath("/goals");
  revalidatePath("/");
}
