export interface ProjectFlowSettings {
  dimensions: { name: string; categories: string[] }[];
}

export interface ProjectInfo {
  name: string;
  tag: string;
  parent: string;
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
}
