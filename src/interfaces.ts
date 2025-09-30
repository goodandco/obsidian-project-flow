export interface Dimension {
  id?: string; // optional stable id for future migrations
  name: string;
  order: number; // explicit ordering for UI and path
  categories: string[];
}

export interface ProjectFlowSettings {
  dimensions: Dimension[];
  projectsRoot?: string; // root folder where projects are created (default: "1. Projects")
  schemaVersion?: number; // lightweight settings schema version
}

export interface ProjectInfo {
  name: string;
  tag: string;
  parent?: string | null;
  dimension: string;
  category: string;
}

export interface ProjectVariables {
  PROJECT_NAME: string;
  PROJECT_TAG: string;
  PROJECT_PARENT: string;
  PARENT_TAG: string;
  YEAR: string;
  DATE: string;
  PROJECT_FULL_NAME: string;
  PROJECT_RELATIVE_PATH: string;
  PROJECT_PATH: string;
  DIMENSION: string;
  CATEGORY: string;
  PROJECT_DIMENSION?: string; // legacy alias used by some templates
}
