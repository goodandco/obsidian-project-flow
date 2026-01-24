import { Plugin } from "obsidian";
import { ProjectFlowSettings } from "./interfaces";
import { DEFAULT_SETTINGS, ProjectFlowSettingTab } from "./settings-tab";
import { showAddProjectPrompt } from "./commands/add-project";
import { showRemoveProjectPrompt } from "./commands/remove-project";
import { showArchiveProjectPrompt } from "./commands/archive-project";

export class ProjectFlowPlugin extends Plugin {
  settings: ProjectFlowSettings;
  private coreApi: any;

  async onload() {
    console.log("ProjectFlow plugin loaded");
    await this.loadSettings();
    this.addSettingTab(new ProjectFlowSettingTab(this.app, this));

    this.addCommand({
      id: "add-project-info",
      name: "Add Project Info",
      callback: () => showAddProjectPrompt(this),
    });

    this.addCommand({
      id: "remove-project-by-id",
      name: "Remove Project",
      callback: () => showRemoveProjectPrompt(this),
    });

    this.addCommand({
      id: "archive-project-by-id",
      name: "Archive Project",
      callback: () => showArchiveProjectPrompt(this),
    });

    await this.exposeCoreApi();
  }

  async loadSettings() {
    const raw = await this.loadData();
    try {
      const { migrateSettings, CURRENT_SETTINGS_SCHEMA_VERSION } = await import("./core/settings-schema");
      const { DEFAULT_ENTITY_TYPES, DEFAULT_PROJECT_TYPES } = await import("./core/registry-defaults");
      const { ensureProjectIndex } = await import("./core/project-index");
      this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(raw));
      let changed = false;

      if (!this.settings.templatesRoot) {
        this.settings.templatesRoot = "Templates/ProjectFlow";
        changed = true;
      }
      if (!this.settings.entityTypes || Object.keys(this.settings.entityTypes).length === 0) {
        this.settings.entityTypes = DEFAULT_ENTITY_TYPES;
        changed = true;
      }
      if (!this.settings.projectTypes || Object.keys(this.settings.projectTypes).length === 0) {
        this.settings.projectTypes = DEFAULT_PROJECT_TYPES;
        changed = true;
      }
      if (!this.settings.schemaVersion || this.settings.schemaVersion < CURRENT_SETTINGS_SCHEMA_VERSION) {
        this.settings.schemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION;
        changed = true;
      }

      const { index, updated } = ensureProjectIndex(this.settings.projectIndex, this.settings.projectRecords);
      if (updated) {
        this.settings.projectIndex = index;
        changed = true;
      }

      if (changed) {
        await this.saveData(this.settings);
      }
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getApi() {
    return this.coreApi;
  }

  private async exposeCoreApi() {
    const { createCoreApi } = await import("./services/core-api");
    this.coreApi = createCoreApi(this);
    const globalAny = window as any;
    globalAny.PluginApi = globalAny.PluginApi || {};
    globalAny.PluginApi["@projectflow/core"] = this.coreApi;
  }
}
