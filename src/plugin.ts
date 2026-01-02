import {Notice, Plugin} from "obsidian";
import {InputPromptModal} from "./input-modal";
import {ChoicePromptModal} from "./choice-modal";
import {
  ProjectFlowSettings,
  ProjectInfo,
  ProjectVariables,
  ProjectRecord, ProjectInfoFromPrompt,
} from "./interfaces";
import {DEFAULT_SETTINGS, ProjectFlowSettingTab} from "./settings-tab";

export class ProjectFlowPlugin extends Plugin {
  settings: ProjectFlowSettings;

  async onload() {
    console.log("ProjectFlow plugin loaded");
    await this.loadSettings();
    this.addSettingTab(new ProjectFlowSettingTab(this.app, this));

    this.addCommand({
      id: "add-project-info",
      name: "Add Project Info",
      callback: () => this.showProjectPrompt(),
    });

    this.addCommand({
      id: "remove-project-by-id",
      name: "Remove Project",
      callback: () => this.showProjectRemovePrompt(),
    });

    this.addCommand({
      id: "archive-project-by-id",
      name: "Archive Project",
      callback: () => this.showProjectArchivePrompt(),
    });
  }

  async loadSettings() {
    const raw = await this.loadData();
    try {
      const {migrateSettings} = await import("./core/settings-schema");
      this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(raw));
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async showProjectRemovePrompt() {
    const [projectInfo, promptMessage] = await this.getProjectDetailsWithPrompt();
    if (projectInfo === null) {
      new Notice(promptMessage);
      return;
    }
    const {dimension, category, projectId} = projectInfo as ProjectInfoFromPrompt;
    const [, deleteMessage] = await this.deleteProjectById(dimension, category, projectId);

    new Notice(deleteMessage);
    console.log(deleteMessage);
  }

  async showProjectArchivePrompt() {
    const [projectInfo, promptMessage] = await this.getProjectDetailsWithPrompt();
    if (projectInfo === null) {
      new Notice(promptMessage);
      return;
    }
    const {dimension, category, projectId} = projectInfo as ProjectInfoFromPrompt;
    const [, archiveMessage] = await this.archiveProjectByPromptInfo(dimension, category, projectId);

    new Notice(archiveMessage);
    console.log(archiveMessage);
  }

  async archiveProjectByPromptInfo(dimension: string, category: string, projectId: string): Promise<[boolean, string]> {
    try {
      const projectRecords = this.settings.projectRecords as Record<
        string,
        Record<string, Record<string, ProjectRecord>>
      >;
      const projectRecord = projectRecords?.[dimension]?.[category]?.[projectId];
      if (!projectRecord) {
        return [false, "Project not found."];
      }

      const { sanitizePath } = await import("./core/path-sanitizer");
      const { SafeFileManager } = await import("./services/file-manager");
      const fm = new SafeFileManager(this.app);
      const adapter: any = (this.app.vault as any).adapter;

      const srcProjectDir = sanitizePath(projectRecord.variables.PROJECT_PATH);
      const srcTemplatesDir = sanitizePath(`Templates/${projectRecord.info.name}_Templates`);

      // Build archive destination path at root with renamed project: <ArchiveRoot>/<YEAR>.<DIMENSION>.<CATEGORY>.<PARENT?>.<NAME>
      const archiveRoot = this.settings.archiveRoot || "4. Archive";
      const year = projectRecord.variables.YEAR;
      const dim = projectRecord.variables.DIMENSION || projectRecord.info.dimension;
      const cat = projectRecord.info.category;
      const parent = (projectRecord.info.parent && projectRecord.info.parent.trim().length > 0) ? projectRecord.info.parent.trim() : null;
      const baseName = projectRecord.info.name;
      const newArchivedName = parent ? `${year}.${dim}.${cat}.${parent}.${baseName}` : `${year}.${dim}.${cat}.${baseName}`;
      const destProjectDir = sanitizePath(`${archiveRoot}/${newArchivedName}`);

      // Ensure destination parent exists
      const parentOf = (p: string) => {
        const parts = p.split('/').filter(Boolean);
        parts.pop();
        return parts.join('/');
      };
      await fm.ensureFolder(parentOf(destProjectDir));

      // Validate source exists and destination not taken
      if (!(await adapter.exists(srcProjectDir))) {
        return [false, `Project directory not found: ${srcProjectDir}`];
      }
      if (await adapter.exists(destProjectDir)) {
        return [false, `Archive destination already exists: ${destProjectDir}`];
      }

      // Move project directory
      await adapter.rename(srcProjectDir, destProjectDir);

      // Move Templates into archived project directory under a Templates subfolder (best-effort)
      try {
        if (await adapter.exists(srcTemplatesDir)) {
          const destTemplatesParent = sanitizePath(`${destProjectDir}/Templates`);
          await fm.ensureFolder(destTemplatesParent);
          const destTemplatesDir = sanitizePath(`${destTemplatesParent}/${projectRecord.info.name}_Templates`);
          // If destination exists (unlikely), append suffix
          if (await adapter.exists(destTemplatesDir)) {
            const altDir = sanitizePath(`${destTemplatesParent}/${projectRecord.info.name}_Templates_archived`);
            await adapter.rename(srcTemplatesDir, altDir);
          } else {
            await adapter.rename(srcTemplatesDir, destTemplatesDir);
          }
        }
      } catch (e) {
        console.warn("Archiving templates failed:", e);
        // Continue; project itself is archived
      }

      // Move the record from active projectRecords to archivedRecords
      try {
        const active = this.settings.projectRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
        // Ensure archived map initialized
        if (!this.settings.archivedRecords || Array.isArray(this.settings.archivedRecords)) {
          (this.settings as any).archivedRecords = (this.settings.archivedRecords && Array.isArray(this.settings.archivedRecords)) ? {} : (this.settings.archivedRecords || {});
        }
        const archived = this.settings.archivedRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
        // Create nested structure in archived
        archived[dimension] = archived[dimension] || {};
        archived[dimension][category] = archived[dimension][category] || {};
        archived[dimension][category][projectId] = projectRecord;
        // Remove from active
        if (active?.[dimension]?.[category]?.[projectId]) {
          delete active[dimension][category][projectId];
          if (Object.keys(active[dimension][category]).length === 0) {
            delete active[dimension][category];
          }
          if (Object.keys(active[dimension] || {}).length === 0) {
            delete active[dimension];
          }
        }
        await this.saveSettings();
      } catch (e) {
        console.warn("Failed to move project record to archive in settings:", e);
      }

      return [true, "Project archived successfully." ];
    } catch (e: any) {
      console.error("Archive failed:", e);
      return [false, e?.message ?? "Failed to archive project." ];
    }
  }

  async showProjectPrompt() {
    const [projectInfo, promptMessage] = await this.getNewProjectDetailsWithPrompt();
    if (projectInfo === null) {
      new Notice(promptMessage);
      return;
    }
    const {dimension, category, id: projectId, name, tag, parent} = projectInfo as ProjectInfo;
    const [, projectMessage] = await this.createProject(projectInfo);

    new Notice(projectMessage);
    console.log(projectMessage);
  }

  async getNewProjectDetailsWithPrompt(): Promise<[ProjectInfo | null, string]> {
    // Step 1: Project name
    const projectName = await this.promptForText("Enter project name:");
    if (!projectName) {
      return [null, "Project creation cancelled. No project name provided."];
    }

    // Step 2: Project tag
    const projectTag = await this.promptForText("Enter project tag:");
    if (!projectTag) {
      return [null, "Project creation cancelled. No project tag provided."];
    }

    // Step 3: Project ID
    const projectId = await this.promptForText(
      "Enter Project ID (used for task prefixes):",
    );
    if (!projectId) {
      return [null, "Project creation cancelled. No Project ID provided."];
    }

    // Step 4: Parent name (optional)
    const projectParent = await this.promptForText(
      "Enter parent name (optional):",
    );
    // Parent can be empty; treat empty or whitespace-only as undefined
    const normalizedParent =
      projectParent && projectParent.trim().length > 0
        ? projectParent.trim()
        : null;

    // Step 5: Dimension selection
    const dimensionChoices = [...this.settings.dimensions]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((d) => d.name);
    const selectedDimension = await this.promptForChoice(
      "Select dimension:",
      dimensionChoices,
    );
    if (!selectedDimension) {
      return [null, "Project creation cancelled. No dimension selected."];
    }

    // Step 6: Category selection
    const selectedDim = this.settings.dimensions.find(
      (d) => d.name === selectedDimension,
    );
    if (!selectedDim || selectedDim.categories.length === 0) {
      return [null, "Selected dimension has no categories. Please add categories in settings first."];
    }

    const categoryChoices = selectedDim.categories;
    const selectedCategory = await this.promptForChoice(
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
      const recs = this.settings.projectRecords as any;
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
        await import("./core/input-validator");
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

  async promptForText(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new InputPromptModal(this.app, prompt, resolve);
      modal.open();
    });
  }

  async promptForChoice(
    prompt: string,
    choices: string[],
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new ChoicePromptModal(this.app, prompt, choices, resolve);
      modal.open();
    });
  }

  async getProjectDetailsWithPrompt(): Promise<[ProjectInfoFromPrompt | null, string]> {
    if (!this.settings.projectRecords) {
      return [null, "You don't have any projects yet."];
    }
    const projectRecords = this.settings.projectRecords as Record<
      string,
      Record<string, Record<string, ProjectRecord>>
    >;

    const dimensionChoices = [...this.settings.dimensions]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((d) => d.name);
    const dimension = await this.promptForChoice(
      "Select dimension of your project:",
      dimensionChoices,
    );
    if (!dimension) {
      return [null, "Project removal cancelled. No dimension selected."];
    }

    const selectedDim = this.settings.dimensions.find(
      (d) => d.name === dimension,
    );
    if (!selectedDim || selectedDim.categories.length === 0) {
      return [null, "Selected dimension has no categories. No project to remove."];
    }

    const categoryChoices = selectedDim.categories;
    const category = await this.promptForChoice(
      "Select category:",
      categoryChoices,
    );
    if (!category) {
      return [null, "Project removal cancelled. No category selected."];
    }

    const projectId = await this.promptForChoice(
      "Select Project to remove:",
      Object.keys(projectRecords[dimension][category]),
    );

    if (!projectId) {
      return [null, "Project removal cancelled. No project selected."];
    }

    return [{dimension, category, projectId}, "Project removal confirmed."];
  }

  // Deprecated inline; kept for backward-compat. Use core/generateProjectVariables for pure logic.
  generateProjectVariables(projectInfo: ProjectInfo): ProjectVariables {
    const now = new Date();
    const year = now.getFullYear().toString();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const projectsDir = this.settings.projectsRoot || "1. Projects";
    const parentSegment =
      projectInfo.parent && projectInfo.parent.trim().length > 0
        ? `.${projectInfo.parent.trim()}`
        : "";
    const projectFullName = `${year}${parentSegment}.${projectInfo.name}`;
    const dimMeta = this.settings.dimensions.find(
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
      PARENT_TAG: projectInfo.parent ? projectInfo.tag : "", // Only set parent-related tag if parent exists
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

  async processTemplate(
    templateContent: string,
    variables: ProjectVariables,
  ): Promise<string> {
    // Use pure helper with dual-syntax support
    try {
      // dynamic import to avoid bundling issues if needed; but it's a local pure module
      const {processTemplate} = await import("./core/template-processor");
      return processTemplate(templateContent, variables as any);
    } catch (_e) {
      // Fallback to legacy replacement to preserve runtime if import fails
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

  async createProject(projectInfo: ProjectInfo): Promise<[boolean, string]> {
    try {
      const variables = this.generateProjectVariables(projectInfo);
      const projectsDir = this.settings.projectsRoot || "1. Projects";

      const {sanitizePath, sanitizeFileName} = await import(
        "./core/path-sanitizer"
        );
      const {SafeFileManager} = await import("./services/file-manager");
      const fm = new SafeFileManager(this.app);

      // Build sanitized paths
      const safeProjectsDir = sanitizePath(projectsDir);
      const dimMeta2 = this.settings.dimensions.find(
        (d) => d.name === projectInfo.dimension,
      );
      const dimensionFolder2 = dimMeta2
        ? `${dimMeta2.order}. ${dimMeta2.name}`
        : projectInfo.dimension;
      const safeDimension = sanitizeFileName(dimensionFolder2);
      const safeCategory = sanitizeFileName(projectInfo.category);
      const safeProjectDir = sanitizePath(
        `${safeProjectsDir}/${safeDimension}/${safeCategory}/${variables.PROJECT_FULL_NAME}`,
      );

      // Prepare subfolders
      const subdirs = [
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
      const adapter = this.app.vault.adapter;
      const templateBase = `.obsidian/plugins/${this.manifest.id}/src/templates`;
      const filesSpec = [
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
        const templatePath = `${templateBase}/${spec.template}`;
        if (!(await adapter.exists(templatePath))) {
          throw new Error(`Template file not found: ${spec.template}`);
        }
        const templateContent = await adapter.read(templatePath);
        const processed = await this.processTemplate(
          templateContent,
          variables,
        );
        const safeFilePath = sanitizePath(
          `${safeProjectDir}/${sanitizeFileName(spec.fileName)}`,
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

      // Create template folder and its files using existing helper (non-critical)
      await this.createProjectTemplates(projectInfo.name, variables);

      // Record project creation in plugin data
      await this.recordProjectCreation(projectInfo, variables);

      return [true, `Project "${projectInfo.name}" created successfully!`];
    } catch (error) {
      return [false, `Error creating project: ${error}`];
    }
  }

  private async recordProjectCreation(
    info: ProjectInfo,
    variables: ProjectVariables,
  ) {
    try {
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
        !this.settings.projectRecords ||
        Array.isArray(this.settings.projectRecords)
      ) {
        // migrate any array to map
        const migrated: Record<
          string,
          Record<string, Record<string, ProjectRecord>>
        > = {};
        const arr = Array.isArray(this.settings.projectRecords)
          ? (this.settings.projectRecords as any as ProjectRecord[])
          : [];
        for (const rec of arr) {
          const d = rec.info.dimension;
          const c = rec.info.category;
          const pid = rec.info.id;
          migrated[d] = migrated[d] || {};
          migrated[d][c] = migrated[d][c] || {};
          migrated[d][c][pid] = rec;
        }
        (this.settings as any).projectRecords = migrated;
      }
      const map = this.settings.projectRecords as Record<
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
      await this.saveSettings();
    } catch (e) {
      console.warn("Failed to record project creation:", e);
      throw e;
    }
  }

  async ensureDirectoryExists(path: string) {
    const {SafeFileManager} = await import("./services/file-manager");
    const fm = new SafeFileManager(this.app);
    await fm.ensureFolder(path);
  }

  async createProjectFile(
    projectDir: string,
    fileName: string,
    templateName: string,
    variables: ProjectVariables,
  ) {
    try {
      const adapter = this.app.vault.adapter;
      const templatePath = `.obsidian/plugins/${this.manifest.id}/src/templates/${templateName}`;
      console.log("Template: " + templatePath);

      // Check if template exists
      if (!(await adapter.exists(templatePath))) {
        throw new Error(`Template file not found: ${templateName}`);
      }
      const templateContent = await this.app.vault.adapter.read(templatePath);
      const processedContent = await this.processTemplate(
        templateContent,
        variables,
      );

      const filePath = `${projectDir}/${fileName}`;
      const {SafeFileManager} = await import("./services/file-manager");
      const fm = new SafeFileManager(this.app);
      await fm.createIfAbsent(filePath, processedContent);
    } catch (error) {
      console.error(`Failed to create ${fileName}:`, error);
      throw new Error(`Failed to create ${fileName}: ${error}`);
    }
  }

  async createProjectTemplates(
    projectName: string,
    variables: ProjectVariables,
  ) {
    const {sanitizePath, sanitizeFileName} = await import(
      "./core/path-sanitizer"
      );
    const templateDir = sanitizePath(`Templates/${projectName}_Templates`);
    await this.ensureDirectoryExists(templateDir);

    const templateMappings = [
      {
        source: "template-meeting-daily.md",
        target: `${projectName}_Meeting_Daily_Template.md`,
      },
      {
        source: "template-meeting-discussion.md",
        target: `${projectName}_Meeting_Discussion_Template.md`,
      },
      {
        source: "template-meeting-knowledge.md",
        target: `${projectName}_Meeting_Knowledge_Template.md`,
      },
      {
        source: "template-meeting-planning.md",
        target: `${projectName}_Meeting_Planning_Template.md`,
      },
      {
        source: "template-meeting-refinement.md",
        target: `${projectName}_Meeting_Refinement_Template.md`,
      },
      {
        source: "template-meeting-retro.md",
        target: `${projectName}_Meeting_Retro_Template.md`,
      },
      {
        source: "template-meeting-demo.md",
        target: `${projectName}_Meeting_Demo_Template.md`,
      },
      {
        source: "template-sprint.md",
        target: `${projectName}_Sprint_Template.md`,
      },
      {source: "template-task.md", target: `${projectName}_Task_Template.md`},
      {source: "template-idea.md", target: `${projectName}_Idea_Template.md`},
      {source: "template-knowledge-base-item.md", target: `${projectName}_Knowledge_Item_Template.md`},
    ];

    for (const mapping of templateMappings) {
      try {
        const safeTarget = sanitizeFileName(mapping.target);
        await this.createProjectFile(
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

    async deleteProjectById(
    dimension: string,
    category: string,
    projectId: string,
  ): Promise<[boolean, string]> {
    let msg = "";
    const projectRecords = this.settings.projectRecords as Record<
      string,
      Record<string, Record<string, ProjectRecord>>
    >;
    const projectData = projectRecords[dimension][category][projectId];
    console.log(projectData);

    const {SafeFileManager} = await import("./services/file-manager");
    const fm = new SafeFileManager(this.app);
    const {sanitizePath} = await import("./core/path-sanitizer");
    const projectDir = sanitizePath(projectData.variables.PROJECT_PATH);
    const templatesDir = sanitizePath(`Templates/${projectData.info.name}_Templates`);

    try {
      console.debug("Removing project dir: " + projectDir);
      await fm.removeDir(projectDir);
      console.debug("Removing templates dir: " + templatesDir);
      await fm.removeDir(templatesDir);

      try {
        console.debug("Removing project record from settings");
        if (projectRecords[dimension][category][projectId]) {
          delete projectRecords[dimension][category][projectId];
          if (Object.keys(projectRecords[dimension][category]).length === 0)
            delete projectRecords[dimension][category];
          if (Object.keys(projectRecords[dimension]).length === 0) delete projectRecords[dimension];
        }
        await this.saveSettings();
        msg = "Project deleted successfully.";
      } catch (e) {
        msg = "Failed to update projectRecords after delete";
        console.warn(msg, e);
      }
      return [true, msg];
    } catch (e) {
      msg = "Error removing project: " + e.message;
      console.error("Error removing project:", e);
    }

    return [false, msg];
  }

  async deleteArchivedProject(
    dimension: string,
    category: string,
    projectId: string,
  ): Promise<[boolean, string]> {
    try {
      const archived = this.settings.archivedRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
      const rec = archived?.[dimension]?.[category]?.[projectId];
      if (!rec) {
        return [false, "Archived project not found."];
      }
      const { sanitizePath } = await import("./core/path-sanitizer");
      const { SafeFileManager } = await import("./services/file-manager");
      const fm = new SafeFileManager(this.app);
      const adapter: any = (this.app.vault as any).adapter;

      const archiveRoot = this.settings.archiveRoot || "4. Archive";
      const year = rec.variables.YEAR;
      const dim = rec.variables.DIMENSION || rec.info.dimension;
      const cat = rec.info.category;
      const parent = (rec.info.parent && rec.info.parent.trim().length > 0) ? rec.info.parent.trim() : null;
      const baseName = rec.info.name;
      const archivedName = parent ? `${year}.${dim}.${cat}.${parent}.${baseName}` : `${year}.${dim}.${cat}.${baseName}`;
      const archivedDir = sanitizePath(`${archiveRoot}/${archivedName}`);

      // Remove archived folder (best-effort)
      if (await adapter.exists(archivedDir)) {
        await fm.removeDir(archivedDir);
      }

      // Update settings
      try {
        if (archived?.[dimension]?.[category]?.[projectId]) {
          delete archived[dimension][category][projectId];
          if (Object.keys(archived[dimension][category]).length === 0) {
            delete archived[dimension][category];
          }
          if (Object.keys(archived[dimension] || {}).length === 0) {
            delete archived[dimension];
          }
        }
        await this.saveSettings();
      } catch (e) {
        console.warn("Failed to update archivedRecords after delete:", e);
      }

      return [true, "Archived project deleted."];
    } catch (e: any) {
      console.error("deleteArchivedProject error:", e);
      return [false, e?.message ?? "Failed to delete archived project."];
    }
  }
}
