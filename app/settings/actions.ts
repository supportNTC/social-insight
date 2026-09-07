"use server";

import { revalidatePath } from "next/cache";
import { updateMetricWeights } from "@/lib/queries/weights";

/**
 * `updatedBy` is hardcoded — CLAUDE.md: there is no auth/SSO decision yet, so
 * there is no real user identity to attribute this change to.
 */
export async function updateWeightsAction(formData: FormData): Promise<void> {
  const parsePositive = (key: string): number => {
    const value = Number(formData.get(key));
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`น้ำหนัก "${key}" ต้องเป็นตัวเลขที่ไม่ติดลบ`);
    }
    return value;
  };

  await updateMetricWeights(
    {
      likeWeight: parsePositive("likeWeight"),
      commentWeight: parsePositive("commentWeight"),
      shareWeight: parsePositive("shareWeight"),
      saveWeight: parsePositive("saveWeight"),
    },
    "settings-ui",
  );

  // Weights feed engagement rate and performance score everywhere they're
  // shown — refresh every page that renders them, not just this one.
  revalidatePath("/");
  revalidatePath("/content");
  revalidatePath("/settings");
}
