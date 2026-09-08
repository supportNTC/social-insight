import type { GoalMetric } from "@prisma/client";

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  weighted_engagement: "Engagement ถ่วงน้ำหนัก",
  followers: "ผู้ติดตามใหม่",
  course_conversions: "ยอดสมัคร Course",
};

export const GOAL_METRIC_UNIT: Record<GoalMetric, string> = {
  weighted_engagement: "engagement",
  followers: "ผู้ติดตาม",
  course_conversions: "คน",
};

export const GOAL_METRICS: readonly GoalMetric[] = ["weighted_engagement", "followers", "course_conversions"];
