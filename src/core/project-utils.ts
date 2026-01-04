import { ProjectInfo, ProjectVariables, ProjectFlowSettings } from "../interfaces";

export function generateProjectVariables(projectInfo: ProjectInfo, settings: ProjectFlowSettings): ProjectVariables {
  const now = new Date();
  const year = now.getFullYear().toString();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const projectsDir = settings.projectsRoot || "1. Projects";
  const parentSegment =
    projectInfo.parent && projectInfo.parent.trim().length > 0
      ? `.${projectInfo.parent.trim()}`
      : "";
  const projectFullName = `${year}${parentSegment}.${projectInfo.name}`;
  const dimMeta = settings.dimensions.find(
    (d) => d.name === projectInfo.dimension,
  );
  const dimensionFolder = dimMeta
    ? `${dimMeta.order}. ${dimMeta.name}`
    : projectInfo.dimension;
  const projectRelativePath = `${projectsDir}/${dimensionFolder}/${projectInfo.category}/${projectFullName}`;
  const projectPath = `${projectRelativePath}`;

  return {
    PROJECT_NAME: projectInfo.name,
    PROJECT_TAG: projectInfo.tag,
    PROJECT_PARENT: projectInfo.parent ? projectInfo.parent : "",
    PARENT_TAG: projectInfo.parent ? projectInfo.tag : "",
    YEAR: year,
    DATE: date,
    PROJECT_FULL_NAME: projectFullName,
    PROJECT_RELATIVE_PATH: projectRelativePath,
    PROJECT_PATH: projectPath,
    DIMENSION: dimMeta ? dimMeta.name : projectInfo.dimension,
    CATEGORY: projectInfo.category,
    PROJECT_ID: projectInfo.id,
    PROJECT_DIMENSION: dimMeta ? dimMeta.name : projectInfo.dimension,
  };
}

export async function processTemplate(
  templateContent: string,
  variables: ProjectVariables,
): Promise<string> {
  try {
    const {processTemplate: coreProcessTemplate} = await import("./template-processor");
    return coreProcessTemplate(templateContent, variables as any);
  } catch (_e) {
    console.warn(
      "Template processor import failed, using legacy replacement:",
      _e,
    );
    let processedContent = templateContent;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `$_${key}`;
      processedContent = processedContent
        .split(placeholder)
        .join(value as any);
    });
    return processedContent;
  }
}
