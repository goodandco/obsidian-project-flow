import type { ProjectFlowSettings, ProjectInfo, ProjectType } from "../interfaces";
import { mergeProjectTypes } from "./registry-merge";

export function resolveProjectType(
  settings: ProjectFlowSettings,
  projectInfo?: ProjectInfo,
): { projectTypeId: string; projectType: ProjectType } {
  const projectTypes = mergeProjectTypes(settings.projectTypes);
  const requestedId = projectInfo?.projectTypeId;
  const projectTypeId = requestedId && projectTypes[requestedId]
    ? requestedId
    : "operational";
  const projectType = projectTypes[projectTypeId] || projectTypes.operational;
  return { projectTypeId, projectType };
}
