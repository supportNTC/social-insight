import type { Platform } from "@prisma/client";

/** Single source of truth for platform display — was previously duplicated across components. */
export const ALL_PLATFORMS: readonly Platform[] = ["facebook", "instagram", "tiktok"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

// Validated in design-system/social-insight-dashboard/MASTER.md for CVD
// contrast as a set — do not substitute individual hues.
export const PLATFORM_MARK_COLOR: Record<Platform, string> = {
  facebook: "#2a78d6",
  instagram: "#eb6834",
  tiktok: "#1baf7a",
};

export function isPlatform(value: string): value is Platform {
  return (ALL_PLATFORMS as string[]).includes(value);
}

export function parsePlatformList(value: string | undefined): Platform[] {
  if (!value) return [...ALL_PLATFORMS];
  const parsed = value.split(",").filter(isPlatform);
  return parsed.length > 0 ? parsed : [...ALL_PLATFORMS];
}
