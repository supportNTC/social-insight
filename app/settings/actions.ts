"use server";

import { revalidatePath } from "next/cache";
import { updateMetricWeights } from "@/lib/queries/weights";
import { FORM_ACTION_OK, type FormActionState } from "@/lib/form-action-state";

/**
 * `updatedBy` is hardcoded — CLAUDE.md: there is no auth/SSO decision yet, so
 * there is no real user identity to attribute this change to.
 *
 * Returns an error result instead of throwing — bound via `useActionState`
 * (see components/settings/WeightsForm.tsx) so an invalid weight shows
 * inline next to the form, not a full-page crash.
 */
export async function updateWeightsAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const errors: string[] = [];
  const parsePositive = (key: string): number => {
    const value = Number(formData.get(key));
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`น้ำหนัก "${key}" ต้องเป็นตัวเลขที่ไม่ติดลบ`);
      return 0;
    }
    return value;
  };

  const weights = {
    likeWeight: parsePositive("likeWeight"),
    commentWeight: parsePositive("commentWeight"),
    shareWeight: parsePositive("shareWeight"),
    saveWeight: parsePositive("saveWeight"),
  };

  if (errors.length > 0) return { error: errors.join(" / ") };

  await updateMetricWeights(weights, "settings-ui");

  // Weights feed engagement rate and performance score everywhere they're
  // shown — refresh every page that renders them, not just this one.
  revalidatePath("/");
  revalidatePath("/content");
  revalidatePath("/settings");
  return FORM_ACTION_OK;
}
