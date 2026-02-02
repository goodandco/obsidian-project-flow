// Pure variable generator for ProjectFlow
// No Obsidian imports; deterministic and testable

export interface ProjectInfoLite {
  name: string;
  tag: string;
  id: string;
  parent: string | null;
  dimension: string;
  category: string;
  year?: string;
}

export type ProjectVariablesMap = Record<string, string>;

export function generateProjectVariables(info: ProjectInfoLite, now: Date = new Date()): ProjectVariablesMap {
  const year = normalizeYear(info.year) || now.getFullYear().toString();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const projectsDir = '1. Projects'; // runtime behavior preserved; projectsRoot setting is a later task

  const parentSegment = info.parent && info.parent.trim().length > 0 ? `.${info.parent.trim()}` : '';
  const projectFullName = `${year}${parentSegment}.${info.name}`;
  const projectRelativePath = `${projectsDir}/${info.dimension}/${info.category}/${projectFullName}`;
  const projectPath = `${projectRelativePath}`;

  return {
    PROJECT_NAME: info.name,
    PROJECT_TAG: info.tag,
    PROJECT_PARENT: info.parent ? info.parent : '',
    PARENT_TAG: info.parent ? info.tag : '', // Only set parent-related tag if parent exists
    YEAR: year,
    DATE: date,
    year,
    date,
    PROJECT_FULL_NAME: projectFullName,
    PROJECT_RELATIVE_PATH: projectRelativePath,
    PROJECT_PATH: projectPath,
    DIMENSION: info.dimension,
    CATEGORY: info.category,
    PROJECT_ID: info.id,
    PROJECT_DIMENSION: info.dimension,
  };
}

function normalizeYear(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}
