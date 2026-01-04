import { Plugin } from "obsidian";
import { ProjectFlowSettings } from "./interfaces";
import { DEFAULT_SETTINGS, ProjectFlowSettingTab } from "./settings-tab";
import { showAddProjectPrompt } from "./commands/add-project";
import { showRemoveProjectPrompt } from "./commands/remove-project";
import { showArchiveProjectPrompt } from "./commands/archive-project";

export class ProjectFlowPlugin extends Plugin {
  settings: ProjectFlowSettings;

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
  }

  async loadSettings() {
    const raw = await this.loadData();
    try {
      const { migrateSettings } = await import("./core/settings-schema");
      this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(raw));
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
