export type GoalProgress = {
  actual: number;
  target: number;
  /** Null when target is 0 or negative — "progress toward nothing" is undefined, not 0% or Infinity. */
  ratio: number | null;
};

export function computeGoalProgress(actual: number, target: number): GoalProgress {
  return { actual, target, ratio: target > 0 ? actual / target : null };
}
