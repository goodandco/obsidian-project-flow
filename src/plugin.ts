import {Notice, Plugin} from 'obsidian';
import {InputPromptModal} from "./input-modal";
import {ChoicePromptModal} from "./choice-modal";
import {ProjectFlowSettings, ProjectInfo, ProjectVariables, ProjectRecord} from "./interfaces";
import {DEFAULT_SETTINGS, ProjectFlowSettingTab} from "./settings-tab";

export class AutomatorPlugin extends Plugin {
  settings: ProjectFlowSettings;

  async deleteProjectById(dimension: string, category: string, projectId: string): Promise<void> {
    const rec = (this.settings.projectRecords as any)?.[dimension]?.[category]?.[projectId] as ProjectRecord | undefined;
    if (!rec) return;
    const variables = rec.variables;
    const { sanitizePath } = await import('./core/path-sanitizer');
    const { SafeFileManager } = await import('./services/file-manager');
    const fm = new SafeFileManager(this.app);
    // Determine project dir and template dir
    const projectDir = sanitizePath(variables.PROJECT_PATH);
    const templateDir = sanitizePath(`Templates/${rec.info.name}_Templates`);
    try {
      // Delete project folder (recursively) and template folder if exist
      const vault: any = this.app.vault;
      const proj = vault.getAbstractFileByPath(projectDir);
      if (proj && vault.delete) await vault.delete(proj, true);
      const tdir = vault.getAbstractFileByPath(templateDir);
      if (tdir && vault.delete) await vault.delete(tdir, true);
    } catch (e) {
      console.warn('Failed to delete some files for project', projectId, e);
    }
    // Remove from records
    try {
      const map = this.settings.projectRecords as any;
      if (map?.[dimension]?.[category]?.[projectId]) {
        delete map[dimension][category][projectId];
        if (Object.keys(map[dimension][category]).length === 0) delete map[dimension][category];
        if (Object.keys(map[dimension]).length === 0) delete map[dimension];
      }
      await this.saveSettings();
    } catch (e) {
      console.warn('Failed to update projectRecords after delete', e);
    }
  }

  async onload() {
    console.log('ProjectFlow plugin loaded');
    await this.loadSettings();
    this.addSettingTab(new ProjectFlowSettingTab(this.app, this));

    this.addCommand({
      id: 'add-project-info',
      name: 'Add Project Info',
      callback: () => this.showProjectPrompt()
    });
  }

  async loadSettings() {
    const raw = await this.loadData();
    try {
      const { migrateSettings } = await import('./core/settings-schema');
      this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(raw));
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async showProjectPrompt() {
    // Step 1: Project name
    const projectName = await this.promptForText('Enter project name:');
    if (!projectName) {
      new Notice('Project creation cancelled. No project name provided.');
      return;
    }

    // Step 2: Project tag
    const projectTag = await this.promptForText('Enter project tag:');
    if (!projectTag) {
      new Notice('Project creation cancelled. No project tag provided.');
      return;
    }

    // Step 3: Project ID
    const projectId = await this.promptForText('Enter Project ID (used for task prefixes):');
    if (!projectId) {
      new Notice('Project creation cancelled. No Project ID provided.');
      return;
    }

    // Step 4: Parent name (optional)
    const projectParent = await this.promptForText('Enter parent name (optional):');
    // Parent can be empty; treat empty or whitespace-only as undefined
    const normalizedParent = projectParent && projectParent.trim().length > 0 ? projectParent.trim() : null;

    // Step 4: Dimension selection
    const dimensionChoices = [...this.settings.dimensions].sort((a,b)=> (a.order ?? 0) - (b.order ?? 0)).map(d => d.name);
    const selectedDimension = await this.promptForChoice('Select dimension:', dimensionChoices);
    if (!selectedDimension) {
      new Notice('Project creation cancelled. No dimension selected.');
      return;
    }

    // Step 5: Category selection
    const selectedDim = this.settings.dimensions.find(d => d.name === selectedDimension);
    if (!selectedDim || selectedDim.categories.length === 0) {
      new Notice('Selected dimension has no categories. Please add categories in settings first.');
      return;
    }

    const categoryChoices = selectedDim.categories;
    const selectedCategory = await this.promptForChoice('Select category:', categoryChoices);
    if (!selectedCategory) {
      new Notice('Project creation cancelled. No category selected.');
      return;
    }

    const projectInfo: ProjectInfo = {
      name: projectName,
      tag: projectTag,
      id: projectId,
      parent: normalizedParent,
      dimension: selectedDimension,
      category: selectedCategory
    };

    // Check for duplicate ID inside selected dimension/category
    try {
      const recs = this.settings.projectRecords as any;
      if (recs && !Array.isArray(recs)) {
        const existing = recs[selectedDimension]?.[selectedCategory]?.[projectId];
        if (existing) {
          new Notice(`Project with ID "${projectId}" already exists in ${selectedDimension}:${selectedCategory}. Choose a different ID.`);
          return;
        }
      }
    } catch (_e) {
      // ignore lookup errors and proceed to general validation
    }

    // Validate inputs (lightweight)
    try {
      const { validateProjectName, validateTag, ensureValidOrThrow } = await import('./core/input-validator');
      ensureValidOrThrow(() => validateProjectName(projectInfo.name), 'Invalid project name');
      ensureValidOrThrow(() => validateTag(projectInfo.tag), 'Invalid tag');
      ensureValidOrThrow(() => validateTag(projectInfo.id), 'Invalid Project ID');
    } catch (e) {
      const message = (e as Error).message || 'Invalid input';
      console.error('Validation error:', e);
      new Notice(message);
      return;
    }

    // Create project
    await this.createProject(projectInfo);
  }

  async promptForText(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new InputPromptModal(this.app, prompt, resolve);
      modal.open();
    });
  }

  async promptForChoice(prompt: string, choices: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new ChoicePromptModal(this.app, prompt, choices, resolve);
      modal.open();
    });
  }

  // Deprecated inline; kept for backward-compat. Use core/generateProjectVariables for pure logic.
  generateProjectVariables(projectInfo: ProjectInfo): ProjectVariables {
    const now = new Date();
    const year = now.getFullYear().toString();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const projectsDir = this.settings.projectsRoot || '1. Projects';
    const parentSegment = projectInfo.parent && projectInfo.parent.trim().length > 0 ? `.${projectInfo.parent.trim()}` : '';
    const projectFullName = `${year}${parentSegment}.${projectInfo.name}`;
    const dimMeta = this.settings.dimensions.find(d => d.name === projectInfo.dimension);
    const dimensionFolder = dimMeta ? `${dimMeta.order}. ${dimMeta.name}` : projectInfo.dimension;
    const projectRelativePath = `${projectsDir}/${dimensionFolder}/${projectInfo.category}/${projectFullName}`;
    const projectPath = `${projectRelativePath}`;

    return {
      PROJECT_NAME: projectInfo.name,
      PROJECT_TAG: projectInfo.tag,
      PROJECT_PARENT: projectInfo.parent ? projectInfo.parent : '',
      PARENT_TAG: projectInfo.parent ? projectInfo.tag : '', // Only set parent-related tag if parent exists
      YEAR: year,
      DATE: date,
      PROJECT_FULL_NAME: projectFullName,
      PROJECT_RELATIVE_PATH: projectRelativePath,
      PROJECT_PATH: projectPath,
      DIMENSION: dimMeta ? dimMeta.name : projectInfo.dimension,
      CATEGORY: projectInfo.category,
      PROJECT_ID: projectInfo.id,
      PROJECT_DIMENSION: dimMeta ? dimMeta.name : projectInfo.dimension
    };
  }

  async processTemplate(templateContent: string, variables: ProjectVariables): Promise<string> {
    // Use pure helper with dual-syntax support
    try {
      // dynamic import to avoid bundling issues if needed; but it's a local pure module
      const { processTemplate } = await import('./core/template-processor');
      return processTemplate(templateContent, variables as any);
    } catch (_e) {
      // Fallback to legacy replacement to preserve runtime if import fails
      console.warn('Template processor import failed, using legacy replacement:', _e);
      let processedContent = templateContent;
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `$_${key}`;
        processedContent = processedContent.split(placeholder).join(value as any);
      });
      return processedContent;
    }
  }

  async createProject(projectInfo: ProjectInfo) {
    try {
      const variables = this.generateProjectVariables(projectInfo);
      const projectsDir = this.settings.projectsRoot || '1. Projects';

      const { sanitizePath, sanitizeFileName } = await import('./core/path-sanitizer');
      const { SafeFileManager } = await import('./services/file-manager');
      const fm = new SafeFileManager(this.app);

      // Build sanitized paths
      const safeProjectsDir = sanitizePath(projectsDir);
      const dimMeta2 = this.settings.dimensions.find(d => d.name === projectInfo.dimension);
            const dimensionFolder2 = dimMeta2 ? `${dimMeta2.order}. ${dimMeta2.name}` : projectInfo.dimension;
            const safeDimension = sanitizeFileName(dimensionFolder2);
      const safeCategory = sanitizeFileName(projectInfo.category);
      const safeProjectDir = sanitizePath(`${safeProjectsDir}/${safeDimension}/${safeCategory}/${variables.PROJECT_FULL_NAME}`);

      // Prepare subfolders
      const subdirs = ['Knowledge Base', 'Meetings', 'Work', 'Work/Tasks', 'People'];
      const folderOps = [
        { type: 'folder' as const, path: safeProjectDir },
        ...subdirs.map(s => ({ type: 'folder' as const, path: sanitizePath(`${safeProjectDir}/${s}`) })),
      ];

      // Prepare files by loading templates first
      const adapter = this.app.vault.adapter;
      const templateBase = `.obsidian/plugins/${this.manifest.id}/src/templates`;
      const filesSpec = [
        { fileName: `${variables.PROJECT_FULL_NAME}.md`, template: 'project.md' },
        { fileName: `${projectInfo.name} Meetings.md`, template: 'meetings.md' },
        { fileName: `${projectInfo.name} People.md`, template: 'people.md' },
        { fileName: `${projectInfo.name} Work.md`, template: 'work.md' },
      ];

      const fileOps = [] as Array<{ type: 'file'; path: string; data: string }>;
      for (const spec of filesSpec) {
        const templatePath = `${templateBase}/${spec.template}`;
        if (!(await adapter.exists(templatePath))) {
          throw new Error(`Template file not found: ${spec.template}`);
        }
        const templateContent = await adapter.read(templatePath);
        const processed = await this.processTemplate(templateContent, variables);
        const safeFilePath = sanitizePath(`${safeProjectDir}/${sanitizeFileName(spec.fileName)}`);
        fileOps.push({ type: 'file', path: safeFilePath, data: processed });
      }

      // Batch create folders and files with rollback on file errors
      const res = await fm.createBatch([...folderOps, ...fileOps]);
      if (!('ok' in res) || !res.ok) {
        throw new Error(`Batch creation failed: ${(res as any).error || 'unknown'}`);
      }

      // Create template folder and its files using existing helper (non-critical)
      await this.createProjectTemplates(projectInfo.name, variables);

      // Record project creation in plugin data
      await this.recordProjectCreation(projectInfo, variables);

      new Notice(`Project "${projectInfo.name}" created successfully!`);
    } catch (error) {
      new Notice(`Error creating project: ${error}`);
      console.error('Project creation error:', error);
    }
  }

  private async recordProjectCreation(info: ProjectInfo, variables: ProjectVariables) {
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
      if (!this.settings.projectRecords || Array.isArray(this.settings.projectRecords)) {
        // migrate any array to map
        const migrated: Record<string, Record<string, Record<string, ProjectRecord>>> = {};
        const arr = Array.isArray(this.settings.projectRecords) ? this.settings.projectRecords as any as ProjectRecord[] : [];
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
      const map = this.settings.projectRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
      map[dim] = map[dim] || {};
      map[dim][cat] = map[dim][cat] || {};
      if (map[dim][cat][id]) {
        throw new Error(`Project with id "${id}" already exists in ${dim}:${cat}`);
      }
      map[dim][cat][id] = record;
      await this.saveSettings();
    } catch (e) {
      console.warn('Failed to record project creation:', e);
      throw e;
    }
  }

  async ensureDirectoryExists(path: string) {
    const { SafeFileManager } = await import('./services/file-manager');
    const fm = new SafeFileManager(this.app);
    await fm.ensureFolder(path);
  }

  async createProjectFile(projectDir: string, fileName: string, templateName: string, variables: ProjectVariables) {
    try {
      const adapter = this.app.vault.adapter;
      const templatePath = `.obsidian/plugins/${this.manifest.id}/src/templates/${templateName}`;
      console.log('Template: ' + templatePath)

      // Check if template exists
      if (!(await adapter.exists(templatePath))) {
        throw new Error(`Template file not found: ${templateName}`);
      }
      const templateContent = await this.app.vault.adapter.read(templatePath);
      const processedContent = await this.processTemplate(templateContent, variables);

      const filePath = `${projectDir}/${fileName}`;
      const { SafeFileManager } = await import('./services/file-manager');
      const fm = new SafeFileManager(this.app);
      await fm.createIfAbsent(filePath, processedContent);
    } catch (error) {
      console.error(`Failed to create ${fileName}:`, error);
      throw new Error(`Failed to create ${fileName}: ${error}`);
    }
  }

  async createProjectTemplates(projectName: string, variables: ProjectVariables) {
    const { sanitizePath, sanitizeFileName } = await import('./core/path-sanitizer');
    const templateDir = sanitizePath(`Templates/${projectName}_Templates`);
    await this.ensureDirectoryExists(templateDir);

    const templateMappings = [
      {source: 'template-meeting-daily.md', target: `${projectName}_Meeting_Daily_Template.md`},
      {source: 'template-meeting-discussion.md', target: `${projectName}_Meeting_Discussion_Template.md`},
      {source: 'template-meeting-knowledge.md', target: `${projectName}_Meeting_Knowledge_Template.md`},
      {source: 'template-meeting-planning.md', target: `${projectName}_Meeting_Planning_Template.md`},
      {source: 'template-meeting-refinement.md', target: `${projectName}_Meeting_Refinement_Template.md`},
      {source: 'template-meeting-retro.md', target: `${projectName}_Meeting_Retro_Template.md`},
      {source: 'template-meeting-demo.md', target: `${projectName}_Meeting_Demo_Template.md`},
      {source: 'template-sprint.md', target: `${projectName}_Sprint_Template.md`},
      {source: 'template-task.md', target: `${projectName}_Task_Template.md`},
      {source: 'template-idea.md', target: `${projectName}_Idea_Template.md`},
    ];

    for (const mapping of templateMappings) {
      try {
        const safeTarget = sanitizeFileName(mapping.target);
        await this.createProjectFile(templateDir, safeTarget, mapping.source, variables);
      } catch (error) {
        console.warn(`Failed to create template ${mapping.target}: ${error}`);
      }
    }
  }
}
