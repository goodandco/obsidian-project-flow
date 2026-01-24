import { App } from "obsidian";
import { ProjectInfo, ProjectVariables, ProjectRecord, IProjectFlowPlugin } from "../interfaces";
import { generateProjectVariables, processTemplate } from "../core/project-utils";

export async function createProject(plugin: IProjectFlowPlugin, projectInfo: ProjectInfo): Promise<[boolean, string]> {
  try {
    const { resolveProjectType } = await import("../core/project-types");
    const { projectTypeId, projectType } = resolveProjectType(plugin.settings, projectInfo);
    projectInfo.projectTypeId = projectTypeId;

    const variables = generateProjectVariables(projectInfo, plugin.settings);
    const projectsDir = plugin.settings.projectsRoot || "1. Projects";

    const {sanitizePath, sanitizeFileName} = await import("../core/path-sanitizer");
    const {SafeFileManager} = await import("./file-manager");
    const fm = new SafeFileManager(plugin.app);

    // Build sanitized paths
    const safeProjectsDir = sanitizePath(projectsDir);
    const dimMeta = plugin.settings.dimensions.find(
      (d) => d.name === projectInfo.dimension,
    );
    const dimensionFolder = dimMeta
      ? `${dimMeta.order}. ${dimMeta.name}`
      : projectInfo.dimension;
    const safeDimension = sanitizeFileName(dimensionFolder);
    const safeCategory = sanitizeFileName(projectInfo.category);
    const safeProjectDir = sanitizePath(
      `${safeProjectsDir}/${safeDimension}/${safeCategory}/${variables.PROJECT_FULL_NAME}`,
    );

    const subdirs = projectType?.folderStructure ?? [
      "Knowledge Base",
      "Meetings",
      "Work",
      "Work/Tasks",
      "People",
    ];
    const folderOps = [
      {type: "folder" as const, path: safeProjectDir},
      ...subdirs.map((s) => ({
        type: "folder" as const,
        path: sanitizePath(`${safeProjectDir}/${s}`),
      })),
    ];

    // Prepare files by loading templates first
    const adapter = plugin.app.vault.adapter;
    const templateBase = `.obsidian/plugins/${plugin.manifest.id}/src/templates`;
    const filesSpec = projectType?.initialNotes ?? [
      {
        fileName: `${variables.PROJECT_FULL_NAME}.md`,
        template: "project.md",
      },
      {
        fileName: `${projectInfo.name} Meetings.md`,
        template: "meetings.md",
      },
      {fileName: `${projectInfo.name} People.md`, template: "people.md"},
      {fileName: `${projectInfo.name} Work.md`, template: "work.md"},
      {fileName: `${projectInfo.name} Knowledge Base.md`, template: "knowledge-base.md"},
    ];

    const fileOps = [] as Array<{ type: "file"; path: string; data: string }>;
    for (const spec of filesSpec) {
      const resolvedFileName = spec.fileName
        ? await processTemplate(spec.fileName, variables as any)
        : spec.fileName;
      const templatePath = `${templateBase}/${spec.template}`;
      if (!(await adapter.exists(templatePath))) {
        throw new Error(`Template file not found: ${spec.template}`);
      }
      const templateContent = await adapter.read(templatePath);
      const processed = await processTemplate(
        templateContent,
        variables,
      );
      const safeFilePath = sanitizePath(
        `${safeProjectDir}/${sanitizeFileName(resolvedFileName)}`,
      );
      fileOps.push({type: "file", path: safeFilePath, data: processed});
    }

    // Batch create folders and files with rollback on file errors
    const res = await fm.createBatch([...folderOps, ...fileOps]);
    if (!("ok" in res) || !res.ok) {
      throw new Error(
        `Batch creation failed: ${(res as any).error || "unknown"}`,
      );
    }

    // Create template folder and its files using helper (non-critical)
    await createProjectTemplates(plugin, projectInfo.name, variables);

    // Record project creation in plugin data
    await recordProjectCreation(plugin, projectInfo, variables);

    return [true, `Project "${projectInfo.name}" created successfully!`];
  } catch (error) {
    return [false, `Error creating project: ${error}`];
  }
}

async function recordProjectCreation(
  plugin: IProjectFlowPlugin,
  info: ProjectInfo,
  variables: ProjectVariables,
) {
  try {
    const { ensureProjectIndex, addToProjectIndex } = await import("../core/project-index");
    const { ensureProjectGraph, addProjectToGraph } = await import("../core/project-graph");
    const record: ProjectRecord = {
      info,
      variables,
      createdAt: new Date().toISOString(),
    };
    // Ensure nested map exists
    const dim = info.dimension;
    const cat = info.category;
    const id = info.id;
    if (
      !plugin.settings.projectRecords ||
      Array.isArray(plugin.settings.projectRecords)
    ) {
      // migrate any array to map
      const migrated: Record<
        string,
        Record<string, Record<string, ProjectRecord>>
      > = {};
      const arr = Array.isArray(plugin.settings.projectRecords)
        ? (plugin.settings.projectRecords as any as ProjectRecord[])
        : [];
      for (const rec of arr) {
        const d = rec.info.dimension;
        const c = rec.info.category;
        const pid = rec.info.id;
        migrated[d] = migrated[d] || {};
        migrated[d][c] = migrated[d][c] || {};
        migrated[d][c][pid] = rec;
      }
      (plugin.settings as any).projectRecords = migrated;
    }
    const map = plugin.settings.projectRecords as Record<
      string,
      Record<string, Record<string, ProjectRecord>>
    >;
    map[dim] = map[dim] || {};
    map[dim][cat] = map[dim][cat] || {};
    if (map[dim][cat][id]) {
      throw new Error(
        `Project with id "${id}" already exists in ${dim}:${cat}`,
      );
    }
    map[dim][cat][id] = record;
    const { index } = ensureProjectIndex(plugin.settings.projectIndex, map);
    plugin.settings.projectIndex = addToProjectIndex(index, record, id, dim, cat);
    const { graph } = ensureProjectGraph(
      plugin.settings.projectGraph,
      map,
      plugin.settings.archivedRecords,
    );
    plugin.settings.projectGraph = addProjectToGraph(graph, record, false);
    await plugin.saveData(plugin.settings);
  } catch (e) {
    console.warn("Failed to record project creation:", e);
    throw e;
  }
}

async function createProjectFile(
  plugin: IProjectFlowPlugin,
  projectDir: string,
  fileName: string,
  templateName: string,
  variables: ProjectVariables,
) {
  try {
    const adapter = plugin.app.vault.adapter;
    const templatePath = `.obsidian/plugins/${plugin.manifest.id}/src/templates/${templateName}`;

    // Check if template exists
    if (!(await adapter.exists(templatePath))) {
      throw new Error(`Template file not found: ${templateName}`);
    }
    const templateContent = await adapter.read(templatePath);
    const processedContent = await processTemplate(
      templateContent,
      variables,
    );

    const filePath = `${projectDir}/${fileName}`;
    const {SafeFileManager} = await import("./file-manager");
    const fm = new SafeFileManager(plugin.app);
    await fm.createIfAbsent(filePath, processedContent);
  } catch (error) {
    console.error(`Failed to create ${fileName}:`, error);
    throw new Error(`Failed to create ${fileName}: ${error}`);
  }
}

async function createProjectTemplates(
  plugin: IProjectFlowPlugin,
  projectName: string,
  variables: ProjectVariables,
) {
  const {sanitizePath, sanitizeFileName} = await import("../core/path-sanitizer");
  const {SafeFileManager} = await import("./file-manager");
  const fm = new SafeFileManager(plugin.app);
  
  const templateDir = sanitizePath(`Templates/${projectName}_Templates`);
  await fm.ensureFolder(templateDir);

  const templateMappings = [
    { source: "template-meeting-daily.md", target: `${projectName}_Meeting_Daily_Template.md` },
    { source: "template-meeting-discussion.md", target: `${projectName}_Meeting_Discussion_Template.md` },
    { source: "template-meeting-knowledge.md", target: `${projectName}_Meeting_Knowledge_Template.md` },
    { source: "template-meeting-planning.md", target: `${projectName}_Meeting_Planning_Template.md` },
    { source: "template-meeting-refinement.md", target: `${projectName}_Meeting_Refinement_Template.md` },
    { source: "template-meeting-retro.md", target: `${projectName}_Meeting_Retro_Template.md` },
    { source: "template-meeting-demo.md", target: `${projectName}_Meeting_Demo_Template.md` },
    { source: "template-sprint.md", target: `${projectName}_Sprint_Template.md` },
    { source: "template-task.md", target: `${projectName}_Task_Template.md` },
    { source: "template-idea.md", target: `${projectName}_Idea_Template.md` },
    { source: "template-knowledge-base-item.md", target: `${projectName}_Knowledge_Item_Template.md` },
    { source: "template-meeting-daily.md", target: "template-meeting-daily.md" },
    { source: "template-meeting-discussion.md", target: "template-meeting-discussion.md" },
    { source: "template-meeting-knowledge.md", target: "template-meeting-knowledge.md" },
    { source: "template-meeting-planning.md", target: "template-meeting-planning.md" },
    { source: "template-meeting-refinement.md", target: "template-meeting-refinement.md" },
    { source: "template-meeting-retro.md", target: "template-meeting-retro.md" },
    { source: "template-meeting-demo.md", target: "template-meeting-demo.md" },
    { source: "template-sprint.md", target: "template-sprint.md" },
    { source: "template-task.md", target: "template-task.md" },
    { source: "template-idea.md", target: "template-idea.md" },
    { source: "template-knowledge-base-item.md", target: "template-knowledge-base-item.md" },
  ];

  for (const mapping of templateMappings) {
    try {
      const safeTarget = sanitizeFileName(mapping.target);
      await createProjectFile(
        plugin,
        templateDir,
        safeTarget,
        mapping.source,
        variables,
      );
    } catch (error) {
      console.warn(`Failed to create template ${mapping.target}: ${error}`);
    }
  }
}
