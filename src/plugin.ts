import {Notice, Plugin, PluginSettingTab, setIcon, Modal} from 'obsidian';
import {InputPromptModal} from "./input-modal";
import {ChoicePromptModal} from "./choise-modal";


const DEFAULT_DIMENSIONS = [
  {name: '1. Business', categories: ['R&D', 'Jobs', 'OpenSource', 'Education']},
  {name: '2. Family', categories: ['Vacations', 'Parenting', 'Common']},
  {name: '3. Friends', categories: []},
  {name: '4. Health', categories: ['Clinics', 'Issues', 'R&D']},
  {name: '5. Personal', categories: ['R&D', 'Languages', 'SelfManagement', 'Writing', 'Reading', 'Music', 'Sports']},
  {name: '6. Residence', categories: []},
];

interface AutomatorSettings {
  dimensions: { name: string; categories: string[] }[];
}

const DEFAULT_SETTINGS: AutomatorSettings = {
  dimensions: JSON.parse(JSON.stringify(DEFAULT_DIMENSIONS)),
};

interface ProjectInfo {
  name: string;
  tag: string;
  parent: string;
  dimension: string;
  category: string;
}

interface ProjectVariables {
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

class ConfirmResetModal extends Modal {
  private onResult: (confirm: boolean) => void;
  constructor(app: any, onResult: (confirm: boolean) => void) {
    super(app);
    this.onResult = onResult;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('automator-settings');
    contentEl.createEl('p', { text: 'Do you want skip settings to defaults? This will override all custom settings.' });
    const row = contentEl.createDiv({ cls: 'gc-row' });
    row.createDiv({ cls: 'gc-spacer' });
    const yesBtn = row.createEl('button', { text: 'Yes, use defaults' });
    const backBtn = row.createEl('button', { text: 'Go back' });
    yesBtn.onclick = () => { this.close(); this.onResult(true); };
    backBtn.onclick = () => { this.close(); this.onResult(false); };
  }
  onClose() {
    this.contentEl.empty();
  }
}

class AutomatorSettingTab extends PluginSettingTab {
  plugin: AutomatorPlugin;

  constructor(app: any, plugin: AutomatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;
    containerEl.empty();
    containerEl.addClass('automator-settings');

    // Top actions row
    const actionsRow = containerEl.createDiv({ cls: 'gc-row' });
    actionsRow.createDiv({ cls: 'gc-spacer' });
    const resetBtn = actionsRow.createEl('button', { cls: ['gc-icon-button','clickable-icon'], attr: { 'aria-label': 'Reset to defaults', title: 'Reset to defaults' } });
    try { setIcon(resetBtn, 'rotate-ccw'); } catch (e) { resetBtn.setText('Reset to defaults'); }
    resetBtn.onclick = () => {
      const modal = new ConfirmResetModal(this.app, async (confirm) => {
        if (confirm) {
          // Deep clone default settings to avoid reference sharing
          this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
          await this.plugin.saveSettings();
          new Notice('Settings were reset to defaults.');
          this.display();
        }
      });
      modal.open();
    };

    // Dimensions section
    containerEl.createEl('h2', {text: 'Dimensions'});

    this.plugin.settings.dimensions.forEach((dim, dimIdx) => {
      const dimDiv = containerEl.createDiv({cls: 'dimension-setting'});
      const headerDiv = dimDiv.createDiv({cls: 'dimension-header'});

      headerDiv.addClass('gc-row');
      const nameEl = headerDiv.createEl('b', {text: dim.name});
      headerDiv.createDiv({cls: 'gc-spacer'});

      // Remove dimension button (aligned right) - declared before edit handler uses it
      const removeBtn = headerDiv.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
      removeBtn.setAttr('aria-label', `Delete ${dim.name}`);
      removeBtn.setAttr('title', `Delete ${dim.name}`);
      try { setIcon(removeBtn, 'trash'); } catch (e) { removeBtn.setText('Remove'); }
      removeBtn.onclick = async () => {
        this.plugin.settings.dimensions.splice(dimIdx, 1);
        await this.plugin.saveSettings();
        this.display();
      };

      // Edit dimension button
      const editBtn = headerDiv.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
      editBtn.setAttr('aria-label', `Rename ${dim.name}`);
      editBtn.setAttr('title', `Rename ${dim.name}`);
      try { setIcon(editBtn, 'pencil'); } catch (e) { editBtn.setText('Edit'); }
      editBtn.onclick = async () => {
        // swap to input for inline rename
        const current = dim.name;
        const row = nameEl.parentElement!;
        nameEl.detach?.();
        // hide edit/delete while editing
        editBtn.style.display = 'none';
        removeBtn.style.display = 'none';
        // create input
        const input = row.createEl('input', {type: 'text'});
        input.value = current;
        input.addClass('gc-rename');
        // create action buttons: apply and discard
        const actions = row.createDiv({cls: 'gc-row'});
        actions.createDiv({cls: 'gc-spacer'});
        const applyBtn = actions.createEl('button', {cls: ['gc-icon-button','clickable-icon']});
        applyBtn.setAttr('aria-label', 'Apply');
        applyBtn.setAttr('title', 'Apply');
        try { setIcon(applyBtn, 'check'); } catch (e) { applyBtn.setText('Apply'); }
        const discardBtn = actions.createEl('button', {cls: ['gc-icon-button','clickable-icon']});
        discardBtn.setAttr('aria-label', 'Discard');
        discardBtn.setAttr('title', 'Discard');
        try { setIcon(discardBtn, 'x'); } catch (e) { discardBtn.setText('Discard'); }
        const cleanup = () => { this.display(); };
        const commit = async (val: string) => {
          const next = val.trim();
          if (!next || next === current) { cleanup(); return; }
          if (this.plugin.settings.dimensions.some((d, i) => i !== dimIdx && d.name === next)) {
            new Notice('A dimension with this name already exists.');
            return; // keep input to let user fix
          }
          dim.name = next;
          await this.plugin.saveSettings();
          cleanup();
        };
        applyBtn.onclick = async () => { await commit(input.value); };
        discardBtn.onclick = () => cleanup();
        input.focus();
        input.select();
        input.onkeydown = async (ev: KeyboardEvent) => {
          if (ev.key === 'Enter') await commit(input.value);
          if (ev.key === 'Escape') cleanup();
        };
        input.onblur = async () => { await commit(input.value); };
      };

      // Categories
      if (dim.categories.length > 0) {
        const catList = dimDiv.createDiv({cls: 'categories-list gc-list'});
        dim.categories.forEach((cat, catIdx) => {
          const item = catList.createDiv({cls: 'gc-list-item gc-row'});
          const catLabel = item.createSpan({text: cat});
          item.createDiv({cls: 'gc-spacer'});
          // Prepare remove before edit to toggle visibility during edit
          const removeCatBtn = item.createEl('button', {cls: ['remove-category','gc-icon-button', 'clickable-icon']});
          removeCatBtn.setAttr('aria-label', `Delete ${cat}`);
          removeCatBtn.setAttr('title', `Delete ${cat}`);
          try { setIcon(removeCatBtn, 'trash'); } catch (e) { removeCatBtn.setText('Remove'); }
          removeCatBtn.onclick = async () => {
            dim.categories.splice(catIdx, 1);
            await this.plugin.saveSettings();
            this.display();
          };
          // Edit category button
          const editCatBtn = item.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
          editCatBtn.setAttr('aria-label', `Rename ${cat}`);
          editCatBtn.setAttr('title', `Rename ${cat}`);
          try { setIcon(editCatBtn, 'pencil'); } catch (e) { editCatBtn.setText('Edit'); }
          editCatBtn.onclick = async () => {
            const current = dim.categories[catIdx];
            const row = catLabel.parentElement!;
            catLabel.detach?.();
            // hide normal actions while editing
            editCatBtn.style.display = 'none';
            removeCatBtn.style.display = 'none';
            const input = row.createEl('input', {type: 'text'});
            input.value = current;
            input.addClass('gc-rename');
            // apply/discard actions
            const actions = row.createDiv({cls: 'gc-row'});
            actions.createDiv({cls: 'gc-spacer'});
            const applyBtn = actions.createEl('button', {cls: ['gc-icon-button','clickable-icon']});
            applyBtn.setAttr('aria-label', 'Apply');
            applyBtn.setAttr('title', 'Apply');
            try { setIcon(applyBtn, 'check'); } catch (e) { applyBtn.setText('Apply'); }
            const discardBtn = actions.createEl('button', {cls: ['gc-icon-button','clickable-icon']});
            discardBtn.setAttr('aria-label', 'Discard');
            discardBtn.setAttr('title', 'Discard');
            try { setIcon(discardBtn, 'x'); } catch (e) { discardBtn.setText('Discard'); }
            const cleanup = () => { this.display(); };
            const commit = async (val: string) => {
              const next = val.trim();
              if (!next || next === current) { cleanup(); return; }
              if (dim.categories.some((c, i) => i !== catIdx && c === next)) {
                new Notice('This category already exists in the dimension.');
                return;
              }
              dim.categories[catIdx] = next;
              await this.plugin.saveSettings();
              cleanup();
            };
            applyBtn.onclick = async () => { await commit(input.value); };
            discardBtn.onclick = () => cleanup();
            input.focus();
            input.select();
            input.onkeydown = async (ev: KeyboardEvent) => {
              if (ev.key === 'Enter') await commit(input.value);
              if (ev.key === 'Escape') cleanup();
            };
            input.onblur = async () => { await commit(input.value); };
          };
        });
      }

      // Add category input
      const addCatDiv = dimDiv.createDiv({cls: 'add-category gc-row'});
      const catInput = addCatDiv.createEl('input', {type: 'text', placeholder: 'New category'});
      addCatDiv.createDiv({cls: 'gc-spacer'});
      const addCatBtn = addCatDiv.createEl('button', {text: 'Add Category'});
      addCatBtn.onclick = async () => {
        const val = catInput.value.trim();
        if (val && !dim.categories.includes(val)) {
          dim.categories.push(val);
          await this.plugin.saveSettings();
          this.display();
        }
      };
    });

    // Add new dimension UI
    const addDiv = containerEl.createDiv({cls: 'add-dimension'});
    addDiv.createEl('h3', {text: 'Add new dimension'});
    const row = addDiv.createDiv({cls: 'gc-row'});
    const newDimInput = row.createEl('input', {type: 'text', placeholder: 'Dimension name'});
    row.createDiv({cls: 'gc-spacer'});
    const saveBtn = row.createEl('button', {text: 'Add Dimension'});
    saveBtn.onclick = async () => {
      const val = newDimInput.value.trim();
      if (val && !this.plugin.settings.dimensions.some(d => d.name === val)) {
        this.plugin.settings.dimensions.push({name: val, categories: []});
        await this.plugin.saveSettings();
        this.display();
      }
    };
  }
}

export class AutomatorPlugin extends Plugin {
  settings: AutomatorSettings;

  async onload() {
    console.log('ProjectFlow plugin loaded');
    await this.loadSettings();
    this.addSettingTab(new AutomatorSettingTab(this.app, this));

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

    // Step 3: Parent name
    const projectParent = await this.promptForText('Enter parent name:');
    if (!projectParent) {
      new Notice('Project creation cancelled. No parent name provided.');
      return;
    }

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
      parent: projectParent,
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
    const projectFullName = `${year}.${projectInfo.parent}.${projectInfo.name}`;
    const projectRelativePath = `${projectsDir}/${projectInfo.dimension}/${projectInfo.category}/${projectFullName}`;
    const projectPath = `${projectRelativePath}`;

    return {
      PROJECT_NAME: projectInfo.name,
      PROJECT_TAG: projectInfo.tag,
      PROJECT_PARENT: projectInfo.parent,
      PARENT_TAG: projectInfo.tag, // Using project tag as parent tag
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
