import {Notice, Plugin} from 'obsidian';
import {InputPromptModal} from "./input-modal";
import {ChoicePromptModal} from "./choise-modal";
import {ProjectFlowSettings, ProjectInfo, ProjectVariables} from "./interfaces";
import {DEFAULT_SETTINGS, ProjectFlowSettingTab} from "./settings-tab";

export class AutomatorPlugin extends Plugin {
  settings: ProjectFlowSettings;

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

    // Step 3: Parent name (optional)
    const projectParent = await this.promptForText('Enter parent name (optional):');
    // Parent can be empty; treat empty or whitespace-only as undefined
    const normalizedParent = projectParent && projectParent.trim().length > 0 ? projectParent.trim() : null;

    // Step 4: Dimension selection
    const dimensionChoices = this.settings.dimensions.map(d => d.name);
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
      parent: normalizedParent,
      dimension: selectedDimension,
      category: selectedCategory
    };

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

  generateProjectVariables(projectInfo: ProjectInfo): ProjectVariables {
    const now = new Date();
    const year = now.getFullYear().toString();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const projectsDir = '1. Projects';
    const parentSegment = projectInfo.parent && projectInfo.parent.trim().length > 0 ? `.${projectInfo.parent.trim()}` : '';
    const projectFullName = `${year}${parentSegment}.${projectInfo.name}`;
    const projectRelativePath = `${projectsDir}/${projectInfo.dimension}/${projectInfo.category}/${projectFullName}`;
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
      DIMENSION: projectInfo.dimension,
      CATEGORY: projectInfo.category
    };
  }

  async processTemplate(templateContent: string, variables: ProjectVariables): Promise<string> {
    let processedContent = templateContent;

    // Replace all variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `$_${key}`;
      processedContent = processedContent.split(placeholder).join(value);
    });

    return processedContent;
  }

  async createProject(projectInfo: ProjectInfo) {
    try {
      const variables = this.generateProjectVariables(projectInfo);
      const projectsDir = '1. Projects';

      // Create main project directory
      const projectDir = `${projectsDir}/${projectInfo.dimension}/${projectInfo.category}/${variables.PROJECT_FULL_NAME}`;
      await this.ensureDirectoryExists(projectDir);

      // Create subdirectories
      const subdirs = ['Knowledge Base', 'Meetings', 'Work', 'People'];
      for (const subdir of subdirs) {
        await this.ensureDirectoryExists(`${projectDir}/${subdir}`);
      }

      // Create main project files
      await this.createProjectFile(projectDir, `${variables.PROJECT_FULL_NAME}.md`, 'project.md', variables);
      await this.createProjectFile(projectDir, `${projectInfo.name} Meetings.md`, 'meetings.md', variables);
      await this.createProjectFile(projectDir, `${projectInfo.name} People.md`, 'people.md', variables);
      await this.createProjectFile(projectDir, `${projectInfo.name} Work.md`, 'work.md', variables);

      // Create template folder
      await this.createProjectTemplates(projectInfo.name, variables);


      new Notice(`Project "${projectInfo.name}" created successfully!`);
    } catch (error) {
      new Notice(`Error creating project: ${error}`);
      console.error('Project creation error:', error);
    }
  }

  async ensureDirectoryExists(path: string) {
    const dir = this.app.vault.getAbstractFileByPath(path);
    if (!dir) {
      await this.app.vault.createFolder(path);
    }
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
      await this.app.vault.create(filePath, processedContent);
    } catch (error) {
      throw new Error(`Failed to create ${fileName}: ${error}`);
    }
  }

  async createProjectTemplates(projectName: string, variables: ProjectVariables) {
    const templateDir = `Templates/${projectName}_Templates`;
    await this.ensureDirectoryExists(templateDir);

    const templateMappings = [
      {source: 'template-meeting-daily.md', target: `${projectName}_Meeting_Daily_Template.md`},
      {source: 'template-meeting-discussion.md', target: `${projectName}_Meeting_Discusion_Template.md`},
      {source: 'template-meeting-knowledge.md', target: `${projectName}_Meeting_Knowledge_Template.md`},
      {source: 'template-meeting-planning.md', target: `${projectName}_Meeting_Planning_Template.md`},
      {source: 'template-meeting-refinement.md', target: `${projectName}_Meeting_Refinement_Template.md`},
      {source: 'template-meeting-retro.md', target: `${projectName}_Meeting_Retro_Template.md`},
      {source: 'template-meeting-demo.md', target: `${projectName}_Meeting_Demo_Template.md`},
      {source: 'template-sprint.md', target: `${projectName}_Sprint_Template.md`},
      {source: 'template-task.md', target: `${projectName}_Task_Template.md`},
      {source: 'template-idea.md', target: `${projectName}_idea_Template.md`},
    ];

    for (const mapping of templateMappings) {
      try {
        await this.createProjectFile(templateDir, mapping.target, mapping.source, variables);
      } catch (error) {
        console.warn(`Failed to create template ${mapping.target}: ${error}`);
      }
    }
  }
}
