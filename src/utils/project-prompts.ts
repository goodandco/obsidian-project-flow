import { App } from "obsidian";
import { ProjectFlowSettings, ProjectInfo, ProjectInfoFromPrompt, ProjectRecord } from "../interfaces";
import { promptForChoice, promptForText } from "./prompts";

export async function getNewProjectDetailsWithPrompt(app: App, settings: ProjectFlowSettings): Promise<[ProjectInfo | null, string]> {
  // Step 1: Project name
  const projectName = await promptForText(app, "Enter project name:");
  if (!projectName) {
    return [null, "Project creation cancelled. No project name provided."];
  }

  // Step 2: Project tag
  const projectTag = await promptForText(app, "Enter project tag:");
  if (!projectTag) {
    return [null, "Project creation cancelled. No project tag provided."];
  }

  // Step 3: Project ID
  const projectId = await promptForText(
    app,
    "Enter Project ID (used for task prefixes):",
  );
  if (!projectId) {
    return [null, "Project creation cancelled. No Project ID provided."];
  }

  // Step 4: Parent name (optional)
  const projectParent = await promptForText(
    app,
    "Enter parent name (optional):",
  );
  // Parent can be empty; treat empty or whitespace-only as undefined
  const normalizedParent =
    projectParent && projectParent.trim().length > 0
      ? projectParent.trim()
      : null;

  // Step 5: Dimension selection
  const dimensionChoices = [...settings.dimensions]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((d) => d.name);
  const selectedDimension = await promptForChoice(
    app,
    "Select dimension:",
    dimensionChoices,
  );
  if (!selectedDimension) {
    return [null, "Project creation cancelled. No dimension selected."];
  }

  // Step 6: Category selection
  const selectedDim = settings.dimensions.find(
    (d) => d.name === selectedDimension,
  );
  if (!selectedDim || selectedDim.categories.length === 0) {
    return [null, "Selected dimension has no categories. Please add categories in settings first."];
  }

  const categoryChoices = selectedDim.categories;
  const selectedCategory = await promptForChoice(
    app,
    "Select category:",
    categoryChoices,
  );
  if (!selectedCategory) {
    return [null, "Project creation cancelled. No category selected."];
  }

  const projectInfo: ProjectInfo = {
    name: projectName,
    tag: projectTag,
    id: projectId,
    parent: normalizedParent,
    dimension: selectedDimension,
    category: selectedCategory,
  };

  // Check for duplicate ID inside selected dimension/category
  try {
    const recs = settings.projectRecords as any;
    if (recs && !Array.isArray(recs)) {
      const existing =
        recs[selectedDimension]?.[selectedCategory]?.[projectId];
      if (existing) {
        return [null, `Project with ID "${projectId}" already exists in ${selectedDimension}:${selectedCategory}. Choose a different ID.`];
      }
    }
  } catch (_e) {
    // ignore lookup errors and proceed to general validation
  }

  // Validate inputs (lightweight)
  try {
    const {validateProjectName, validateTag, ensureValidOrThrow} =
      await import("../core/input-validator");
    ensureValidOrThrow(
      () => validateProjectName(projectInfo.name),
      "Invalid project name",
    );
    ensureValidOrThrow(() => validateTag(projectInfo.tag), "Invalid tag");
    ensureValidOrThrow(
      () => validateTag(projectInfo.id),
      "Invalid Project ID",
    );
  } catch (e) {
    const message = (e as Error).message || "Invalid input";
    console.error("Validation error:", e);
    return [null, message];
  }

  return [projectInfo, "Project details collected."];
}

export async function getProjectDetailsWithPrompt(app: App, settings: ProjectFlowSettings): Promise<[ProjectInfoFromPrompt | null, string]> {
  if (!settings.projectRecords) {
    return [null, "You don't have any projects yet."];
  }
  const projectRecords = settings.projectRecords as Record<
    string,
    Record<string, Record<string, ProjectRecord>>
  >;

  const dimensionChoices = [...settings.dimensions]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((d) => d.name);
  const dimension = await promptForChoice(
    app,
    "Select dimension of your project:",
    dimensionChoices,
  );
  if (!dimension) {
    return [null, "Project action cancelled. No dimension selected."];
  }

  const selectedDim = settings.dimensions.find(
    (d) => d.name === dimension,
  );
  if (!selectedDim || selectedDim.categories.length === 0) {
    return [null, "Selected dimension has no categories. No project found."];
  }

  const categoryChoices = selectedDim.categories;
  const category = await promptForChoice(
    app,
    "Select category:",
    categoryChoices,
  );
  if (!category) {
    return [null, "Project action cancelled. No category selected."];
  }

  const projectsInCategory = projectRecords[dimension]?.[category];
  if (!projectsInCategory || Object.keys(projectsInCategory).length === 0) {
    return [null, "No projects found in this category."];
  }

  const projectId = await promptForChoice(
    app,
    "Select Project:",
    Object.keys(projectsInCategory),
  );

  if (!projectId) {
    return [null, "Project action cancelled. No project selected."];
  }

  return [{dimension, category, projectId}, "Project details collected."];
}
