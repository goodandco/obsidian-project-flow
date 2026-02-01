export interface PlanningResult {
  needsFollowup: boolean;
  question?: string;
  plan?: string;
  context?: string;
  fields?: Record<string, string>;
}
