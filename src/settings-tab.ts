import { Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import * as Obsidian from "obsidian";
import { ProjectFlowPlugin } from "./plugin";
import { ProjectFlowSettings, type AIProvider } from "./interfaces";
import { DEFAULT_PROJECT_TYPES } from "./core/registry-defaults";
import { ConfirmResetModal } from "./confirm-reset-modal";
import {
  deleteProjectById,
  archiveProjectByPromptInfo,
} from "./services/project-management-service";

const DEFAULT_DIMENSIONS = [
  {
    name: "Business",
    order: 1,
    categories: ["R&D", "Jobs", "OpenSource", "Education"],
  },
  {
    name: "Family",
    order: 2,
    categories: ["Vacations", "Parenting", "Common"],
  },
  { name: "Friends", order: 3, categories: [] },
  { name: "Health", order: 4, categories: ["Clinics", "Issues", "R&D"] },
  {
    name: "Personal",
    order: 5,
    categories: ["R&D", "Languages", "SelfManagement", "Writing", "Reading", "Music", "Sports"],
  },
  { name: "Residence", order: 6, categories: [] },
];

export const DEFAULT_SETTINGS: ProjectFlowSettings = {
  dimensions: JSON.parse(JSON.stringify(DEFAULT_DIMENSIONS)),
  projectsRoot: "1. Projects",
  archiveRoot: "4. Archive",
  templatesRoot: "Templates/ProjectFlow",
  ai: {
    enabled: false,
    provider: "openai",
    apiKeySecretName: "",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com",
    strictExecution: false,
    memoryLimit: 10,
    mcpServers: [],
  },
  projectRecords: {},
  archivedRecords: {},
  projectGraph: {
    version: 1,
    byFullName: {},
    archivedByFullName: {},
  },
  projectTypes: DEFAULT_PROJECT_TYPES,
};

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function idHueClass(id: string): string {
  return `gc-id-hue-${Math.abs(hashString(id)) % 12}`;
}

function normalizeSecretName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export class ProjectFlowSettingTab extends PluginSettingTab {
  plugin: ProjectFlowPlugin;

  constructor(app: any, plugin: ProjectFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("project-flow-settings");

    // Top actions row
    const actionsRow = containerEl.createDiv({ cls: "gc-row" });
    actionsRow.createDiv({ cls: "gc-spacer" });
    const resetBtn = actionsRow.createEl("button", {
      cls: ["gc-icon-button", "clickable-icon"],
      attr: { "aria-label": "Reset to defaults", title: "Reset to defaults" },
    });
    try {
      setIcon(resetBtn, "rotate-ccw");
    } catch (e) {
      resetBtn.setText("Reset to defaults");
    }
    resetBtn.onclick = () => {
      const modal = new ConfirmResetModal(this.app, async (confirm) => {
        if (confirm) {
          // Deep clone default settings to avoid reference sharing
          this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
          await this.plugin.saveSettings();
          new Notice("Settings were reset to defaults.");
          this.display();
        }
      });
      modal.open();
    };

    // General settings should be first and not use a heading.
    new Setting(containerEl).setName("Projects root").addText((text) => {
      text.setPlaceholder("e.g. 1. Projects");
      text.setValue(this.plugin.settings.projectsRoot || "1. Projects");
      text.onChange(async (value) => {
        this.plugin.settings.projectsRoot = value.trim() || "1. Projects";
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Archive root").addText((text) => {
      text.setPlaceholder("e.g. 4. Archive");
      text.setValue(this.plugin.settings.archiveRoot || "4. Archive");
      text.onChange(async (value) => {
        this.plugin.settings.archiveRoot = value.trim() || "4. Archive";
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Templates root").addText((text) => {
      text.setPlaceholder("e.g. Templates/ProjectFlow");
      text.setValue(this.plugin.settings.templatesRoot || "Templates/ProjectFlow");
      text.onChange(async (value) => {
        this.plugin.settings.templatesRoot = value.trim() || "Templates/ProjectFlow";
        await this.plugin.saveSettings();
      });
    });

    // Dimensions section
    new Setting(containerEl).setName("Dimensions").setHeading();

    // Sort dimensions by order ascending for display
    const dims = [...this.plugin.settings.dimensions].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    dims.forEach((dim, dimIdx) => {
      const dimDiv = containerEl.createDiv({ cls: "dimension-setting" });
      const headerDiv = dimDiv.createDiv({ cls: "dimension-header" });

      headerDiv.addClass("gc-row");
      // Order label
      headerDiv.createSpan({ text: `${dim.order}. ` });
      const nameEl = headerDiv.createEl("b", { text: dim.name });
      headerDiv.createDiv({ cls: "gc-spacer" });

      // Reorder buttons
      const moveUpBtn = headerDiv.createEl("button", {
        cls: ["gc-icon-button", "clickable-icon"],
      });
      moveUpBtn.setAttr("aria-label", `Move up`);
      moveUpBtn.setAttr("title", `Move up`);
      try {
        setIcon(moveUpBtn, "arrow-up");
      } catch (e) {
        moveUpBtn.setText("Up");
      }
      moveUpBtn.onclick = async () => {
        const items = this.plugin.settings.dimensions;
        // find neighbor with immediately smaller order
        const prev = [...items]
          .filter((d) => (d.order ?? 0) < (dim.order ?? 0))
          .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0];
        if (!prev) return;
        const tmp = prev.order;
        prev.order = dim.order;
        dim.order = tmp;
        await this.plugin.saveSettings();
        this.display();
      };

      const moveDownBtn = headerDiv.createEl("button", {
        cls: ["gc-icon-button", "clickable-icon"],
      });
      moveDownBtn.setAttr("aria-label", `Move down`);
      moveDownBtn.setAttr("title", `Move down`);
      try {
        setIcon(moveDownBtn, "arrow-down");
      } catch (e) {
        moveDownBtn.setText("Down");
      }
      moveDownBtn.onclick = async () => {
        const items = this.plugin.settings.dimensions;
        const next = [...items]
          .filter((d) => (d.order ?? 0) > (dim.order ?? 0))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
        if (!next) return;
        const tmp = next.order;
        next.order = dim.order;
        dim.order = tmp;
        await this.plugin.saveSettings();
        this.display();
      };

      // Remove dimension button (aligned right) - declared before edit handler uses it
      const removeBtn = headerDiv.createEl("button", {
        cls: ["gc-icon-button", "clickable-icon"],
      });
      removeBtn.setAttr("aria-label", `Delete ${dim.name}`);
      removeBtn.setAttr("title", `Delete ${dim.name}`);
      try {
        setIcon(removeBtn, "trash");
      } catch (e) {
        removeBtn.setText("Remove");
      }
      removeBtn.onclick = async () => {
        const idx = this.plugin.settings.dimensions.findIndex((d) => d === dim);
        if (idx >= 0) this.plugin.settings.dimensions.splice(idx, 1);
        await this.plugin.saveSettings();
        this.display();
      };

      // Edit dimension button
      const editBtn = headerDiv.createEl("button", {
        cls: ["gc-icon-button", "clickable-icon"],
      });
      editBtn.setAttr("aria-label", `Rename ${dim.name}`);
      editBtn.setAttr("title", `Rename ${dim.name}`);
      try {
        setIcon(editBtn, "pencil");
      } catch (e) {
        editBtn.setText("Edit");
      }
      editBtn.onclick = async () => {
        // swap to input for inline rename
        const current = dim.name;
        const row = nameEl.parentElement!;
        nameEl.detach?.();
        // hide edit/delete while editing
        editBtn.addClass("gc-hidden");
        removeBtn.addClass("gc-hidden");
        // create input
        const input = row.createEl("input", { type: "text" });
        input.value = current;
        input.addClass("gc-rename");
        // create action buttons: apply and discard
        const actions = row.createDiv({ cls: "gc-row" });
        actions.createDiv({ cls: "gc-spacer" });
        const applyBtn = actions.createEl("button", {
          cls: ["gc-icon-button", "clickable-icon"],
        });
        applyBtn.setAttr("aria-label", "Apply");
        applyBtn.setAttr("title", "Apply");
        try {
          setIcon(applyBtn, "check");
        } catch (e) {
          applyBtn.setText("Apply");
        }
        const discardBtn = actions.createEl("button", {
          cls: ["gc-icon-button", "clickable-icon"],
        });
        discardBtn.setAttr("aria-label", "Discard");
        discardBtn.setAttr("title", "Discard");
        try {
          setIcon(discardBtn, "x");
        } catch (e) {
          discardBtn.setText("Discard");
        }
        const cleanup = () => {
          this.display();
        };
        const commit = async (val: string) => {
          const next = val.trim();
          if (!next || next === current) {
            cleanup();
            return;
          }
          if (this.plugin.settings.dimensions.some((d) => d !== dim && d.name === next)) {
            new Notice("A dimension with this name already exists.");
            return; // keep input to let user fix
          }
          dim.name = next;
          await this.plugin.saveSettings();
          cleanup();
        };
        applyBtn.onclick = async () => {
          await commit(input.value);
        };
        discardBtn.onclick = () => cleanup();
        input.focus();
        input.select();
        input.onkeydown = async (ev: KeyboardEvent) => {
          if (ev.key === "Enter") await commit(input.value);
          if (ev.key === "Escape") cleanup();
        };
        input.onblur = async () => {
          await commit(input.value);
        };
      };

      // Categories
      if (dim.categories.length > 0) {
        const catList = dimDiv.createDiv({ cls: "categories-list gc-list" });
        dim.categories.forEach((cat, catIdx) => {
          const item = catList.createDiv({ cls: "gc-list-item gc-row" });
          // Compute project IDs for this category from stored projectRecords
          const recs = (this.plugin.settings.projectRecords || {}) as Record<
            string,
            Record<string, Record<string, any>>
          >;
          const dimName = dim.name;
          // Render category name first (bold), then space-separated IDs with random colors
          const catLabel = item.createEl("b", { text: cat });
          // container for IDs
          const idsWrap = item.createDiv({ cls: "gc-id-wrap" });
          const projectsInCategory = recs?.[dimName]?.[cat] || {};

          // Group projects by projectTypeId
          const groupedByTypeId: Record<string, string[]> = {};
          Object.entries(projectsInCategory).forEach(([pid, record]: [string, any]) => {
            const typeId = record.info?.projectTypeId || "operational";
            if (!groupedByTypeId[typeId]) groupedByTypeId[typeId] = [];
            groupedByTypeId[typeId].push(pid);
          });

          const typeIds = Object.keys(groupedByTypeId).sort();
          typeIds.forEach((typeId, typeIdx) => {
            const pids = groupedByTypeId[typeId].sort();

            // Render type label if there are multiple types or if it's not the default
            if (typeIds.length > 1 || typeId !== "operational") {
              const typeName = this.plugin.settings.projectTypes?.[typeId]?.name || typeId;
              idsWrap.createSpan({ cls: "gc-type-label", text: `${typeName}: ` });
            }

            pids.forEach((pid, idx) => {
              // Wrap each tag with actions that appear on hover
              const wrap = idsWrap.createSpan({ cls: "gc-id-chip" });
              wrap.createSpan({ cls: ["gc-id-tag", idHueClass(pid)], text: pid });

              // Actions (hidden until hover)
              const actions = wrap.createSpan({ cls: "gc-id-actions" });

              const delBtn = actions.createEl("button", {
                cls: ["gc-icon-button", "clickable-icon"],
              });
              delBtn.setAttr("aria-label", `Delete ${pid}`);
              delBtn.setAttr("title", `Delete ${pid}`);
              try {
                setIcon(delBtn, "trash");
              } catch {
                delBtn.setText("Del");
              }
              delBtn.onclick = async (ev: MouseEvent) => {
                ev.stopPropagation();
                const [, msg] = await deleteProjectById(this.plugin, dimName, cat, pid);
                new Notice(msg);
                this.display();
              };

              const archBtn = actions.createEl("button", {
                cls: ["gc-icon-button", "clickable-icon"],
              });
              archBtn.setAttr("aria-label", `Archive ${pid}`);
              archBtn.setAttr("title", `Archive ${pid}`);
              try {
                setIcon(archBtn, "archive");
              } catch {
                archBtn.setText("Arc");
              }
              archBtn.onclick = async (ev: MouseEvent) => {
                ev.stopPropagation();
                const [, msg] = await archiveProjectByPromptInfo(this.plugin, dimName, cat, pid);
                new Notice(msg);
                this.display();
              };

              // add space between chips
              if (idx < pids.length - 1) idsWrap.createSpan({ text: " " });
            });

            // add space/separator between type groups
            if (typeIdx < typeIds.length - 1) {
              idsWrap.createSpan({ cls: "gc-type-separator", text: " | " });
            }
          });
          item.createDiv({ cls: "gc-spacer" });
          // Prepare remove before edit to toggle visibility during edit
          const removeCatBtn = item.createEl("button", {
            cls: ["remove-category", "gc-icon-button", "clickable-icon"],
          });
          removeCatBtn.setAttr("aria-label", `Delete ${cat}`);
          removeCatBtn.setAttr("title", `Delete ${cat}`);
          try {
            setIcon(removeCatBtn, "trash");
          } catch (e) {
            removeCatBtn.setText("Remove");
          }
          removeCatBtn.onclick = async () => {
            dim.categories.splice(catIdx, 1);
            await this.plugin.saveSettings();
            this.display();
          };
          // Edit category button
          const editCatBtn = item.createEl("button", {
            cls: ["gc-icon-button", "clickable-icon"],
          });
          editCatBtn.setAttr("aria-label", `Rename ${cat}`);
          editCatBtn.setAttr("title", `Rename ${cat}`);
          try {
            setIcon(editCatBtn, "pencil");
          } catch (e) {
            editCatBtn.setText("Edit");
          }
          editCatBtn.onclick = async () => {
            const current = dim.categories[catIdx];
            const row = catLabel.parentElement!;
            catLabel.detach?.();
            // hide normal actions while editing
            editCatBtn.addClass("gc-hidden");
            removeCatBtn.addClass("gc-hidden");
            const input = row.createEl("input", { type: "text" });
            input.value = current;
            input.addClass("gc-rename");
            // apply/discard actions
            const actions = row.createDiv({ cls: "gc-row" });
            actions.createDiv({ cls: "gc-spacer" });
            const applyBtn = actions.createEl("button", {
              cls: ["gc-icon-button", "clickable-icon"],
            });
            applyBtn.setAttr("aria-label", "Apply");
            applyBtn.setAttr("title", "Apply");
            try {
              setIcon(applyBtn, "check");
            } catch (e) {
              applyBtn.setText("Apply");
            }
            const discardBtn = actions.createEl("button", {
              cls: ["gc-icon-button", "clickable-icon"],
            });
            discardBtn.setAttr("aria-label", "Discard");
            discardBtn.setAttr("title", "Discard");
            try {
              setIcon(discardBtn, "x");
            } catch (e) {
              discardBtn.setText("Discard");
            }
            const cleanup = () => {
              this.display();
            };
            const commit = async (val: string) => {
              const next = val.trim();
              if (!next || next === current) {
                cleanup();
                return;
              }
              if (dim.categories.some((c, i) => i !== catIdx && c === next)) {
                new Notice("This category already exists in the dimension.");
                return;
              }
              dim.categories[catIdx] = next;
              await this.plugin.saveSettings();
              cleanup();
            };
            applyBtn.onclick = async () => {
              await commit(input.value);
            };
            discardBtn.onclick = () => cleanup();
            input.focus();
            input.select();
            input.onkeydown = async (ev: KeyboardEvent) => {
              if (ev.key === "Enter") await commit(input.value);
              if (ev.key === "Escape") cleanup();
            };
            input.onblur = async () => {
              await commit(input.value);
            };
          };
        });
      }

      // Add category input
      const addCatDiv = dimDiv.createDiv({ cls: "add-category gc-row" });
      const catInput = addCatDiv.createEl("input", {
        type: "text",
        placeholder: "New category",
      });
      addCatDiv.createDiv({ cls: "gc-spacer" });
      const addCatBtn = addCatDiv.createEl("button", { text: "Add Category" });
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

    const addDiv = containerEl.createDiv({ cls: "add-dimension" });
    addDiv.createDiv({ cls: "gc-subheading", text: "Add new dimension" });
    const row = addDiv.createDiv({ cls: "gc-row" });
    const newDimInput = row.createEl("input", {
      type: "text",
      placeholder: "Dimension name",
    });
    row.createDiv({ cls: "gc-spacer" });
    const saveBtn = row.createEl("button", { text: "Add Dimension" });
    saveBtn.onclick = async () => {
      const val = newDimInput.value.trim();
      if (val && !this.plugin.settings.dimensions.some((d) => d.name === val)) {
        {
          const maxOrder = this.plugin.settings.dimensions.reduce(
            (m, d) => Math.max(m, d.order ?? 0),
            0,
          );
          this.plugin.settings.dimensions.push({
            name: val,
            order: maxOrder + 1,
            categories: [],
          });
        }
        await this.plugin.saveSettings();
        this.display();
      }
    };

    // Archive section
    new Setting(containerEl).setName("Archive").setHeading();
    const archivedRaw = (this.plugin.settings.archivedRecords || {}) as Record<
      string,
      Record<string, Record<string, any>>
    >;
    const archived = archivedRaw && !Array.isArray(archivedRaw) ? archivedRaw : {};

    // Build dimension list from archived records, but order using dimensions metadata when available
    const orderByDim: Record<string, number> = {};
    for (const d of this.plugin.settings.dimensions) {
      orderByDim[d.name] = d.order ?? Number.MAX_SAFE_INTEGER;
    }
    const dimEntries = Object.keys(archived)
      .map((name) => ({
        name,
        order: orderByDim[name] ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    let archiveHasAny = false;
    dimEntries.forEach(({ name: dimName, order }) => {
      const catMap = archived[dimName] || {};
      const catNames = Object.keys(catMap)
        .filter((c) => Object.keys(catMap[c] || {}).length > 0)
        .sort();
      if (catNames.length === 0) return;
      archiveHasAny = true;

      const dimDiv = containerEl.createDiv({ cls: "dimension-setting" });
      const headerDiv = dimDiv.createDiv({ cls: "dimension-header gc-row" });
      const dimMeta = this.plugin.settings.dimensions.find((d) => d.name === dimName);
      if (dimMeta) headerDiv.createSpan({ text: `${dimMeta.order}. ` });
      headerDiv.createEl("b", { text: dimName });
      headerDiv.createDiv({ cls: "gc-spacer" });

      const catList = dimDiv.createDiv({ cls: "categories-list gc-list" });
      catNames.forEach((cat) => {
        const item = catList.createDiv({ cls: "gc-list-item gc-row" });
        const ids = Object.keys(catMap?.[cat] || {}).sort();
        item.createEl("b", { text: cat });
        const idsWrap = item.createDiv({ cls: "gc-id-wrap" });
        if (ids.length > 0) {
          idsWrap.createSpan({ text: " " });
          ids.forEach((pid, idx) => {
            const wrap = idsWrap.createSpan({ cls: "gc-id-chip" });
            wrap.createSpan({ cls: ["gc-id-tag", idHueClass(pid)], text: pid });

            const actions = wrap.createSpan({ cls: "gc-id-actions" });
            const delBtn = actions.createEl("button", {
              cls: ["gc-icon-button", "clickable-icon"],
            });
            delBtn.setAttr("aria-label", `Delete ${pid}`);
            delBtn.setAttr("title", `Delete ${pid}`);
            try {
              setIcon(delBtn, "trash");
            } catch {
              delBtn.setText("Del");
            }
            delBtn.onclick = async (ev: MouseEvent) => {
              ev.stopPropagation();
              const [, msg] = await (this.plugin as any).deleteArchivedProject(dimName, cat, pid);
              new Notice(msg);
              this.display();
            };

            if (idx < ids.length - 1) idsWrap.createSpan({ text: " " });
          });
        }
        item.createDiv({ cls: "gc-spacer" });
      });
    });

    if (!archiveHasAny) {
      const hint = containerEl.createDiv({ cls: "setting-item" });
      hint.createSpan({ text: "No archived projects yet." });
    }

    // AI section
    new Setting(containerEl).setName("AI Module").setHeading();

    const defaultMixedOfferText = "I can also set this up for you. Shall I proceed?";
    const aiDefaults: Record<AIProvider, { baseUrl: string; model: string }> = {
      openai: { baseUrl: "https://api.openai.com", model: "gpt-4o-mini" },
      anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-3-5-sonnet-latest" },
      ollama: { baseUrl: "http://localhost:11434", model: "llama3.1" },
    };

    const ensureAiSettings = () => {
      if (!this.plugin.settings.ai) {
        this.plugin.settings.ai = {
          enabled: false,
          provider: "openai",
          apiKeySecretName: "",
          model: aiDefaults.openai.model,
          baseUrl: aiDefaults.openai.baseUrl,
          strictExecution: false,
          memoryLimit: 10,
          mixedOfferText: defaultMixedOfferText,
          mcpServers: [],
        };
      }
      if (this.plugin.settings.ai.apiKeySecretName == null)
        this.plugin.settings.ai.apiKeySecretName = "";
      if (this.plugin.settings.ai.model == null) {
        this.plugin.settings.ai.model = aiDefaults[this.plugin.settings.ai.provider].model;
      }
      if (this.plugin.settings.ai.baseUrl == null) {
        this.plugin.settings.ai.baseUrl = aiDefaults[this.plugin.settings.ai.provider].baseUrl;
      }
      if (this.plugin.settings.ai.strictExecution == null)
        this.plugin.settings.ai.strictExecution = false;
      if (this.plugin.settings.ai.memoryLimit == null) this.plugin.settings.ai.memoryLimit = 10;
      if (this.plugin.settings.ai.mixedOfferText == null)
        this.plugin.settings.ai.mixedOfferText = defaultMixedOfferText;
      if (!Array.isArray(this.plugin.settings.ai.mcpServers))
        this.plugin.settings.ai.mcpServers = [];
      return this.plugin.settings.ai;
    };

    const ai = ensureAiSettings();

    new Setting(containerEl).setName("Enable AI module").addToggle((toggle) => {
      toggle.setValue(Boolean(ai.enabled));
      toggle.onChange(async (value) => {
        const next = ensureAiSettings();
        next.enabled = value;
        await this.plugin.saveSettings();
        await (this.plugin as any).toggleAiView?.(value);
      });
    });

    new Setting(containerEl).setName("Provider").addDropdown((dropdown) => {
      dropdown.addOption("openai", "openai");
      dropdown.addOption("anthropic", "anthropic");
      dropdown.addOption("ollama", "ollama");
      dropdown.setValue(ai.provider || "openai");
      dropdown.onChange(async (value) => {
        const next = ensureAiSettings();
        const provider = value as AIProvider;
        next.provider = provider;
        const currentBaseUrl = next.baseUrl || "";
        const currentModel = next.model || "";
        const knownBaseUrls = Object.values(aiDefaults).map((d) => d.baseUrl);
        const knownModels = Object.values(aiDefaults).map((d) => d.model);
        if (!currentBaseUrl || knownBaseUrls.includes(currentBaseUrl)) {
          next.baseUrl = aiDefaults[provider].baseUrl;
        }
        if (!currentModel || knownModels.includes(currentModel)) {
          next.model = aiDefaults[provider].model;
        }
        await this.plugin.saveSettings();
        this.display();
      });
    });

    const apiKeySetting = new Setting(containerEl)
      .setName("API key")
      .setDesc("Select a secret from SecretStorage.");
    const SecretComponent = (Obsidian as any).SecretComponent;
    const addComponent = (apiKeySetting as any).addComponent?.bind(apiKeySetting);
    if (SecretComponent && addComponent) {
      addComponent((el: HTMLElement) =>
        new SecretComponent(this.app, el)
          .setValue(ai.apiKeySecretName || "")
          .onChange(async (value: string | null) => {
            const next = ensureAiSettings();
            next.apiKeySecretName = normalizeSecretName(value);
            await this.plugin.saveSettings();
          }),
      );
    } else {
      apiKeySetting.addText((text) => {
        text.setPlaceholder("Secret name");
        text.setValue(ai.apiKeySecretName || "");
        text.onChange(async (value) => {
          const next = ensureAiSettings();
          next.apiKeySecretName = normalizeSecretName(value);
          await this.plugin.saveSettings();
        });
      });
    }

    new Setting(containerEl).setName("Model").addText((text) => {
      const provider = ai.provider || "openai";
      text.setPlaceholder(aiDefaults[provider].model);
      text.setValue(ai.model || aiDefaults[provider].model);
      text.onChange(async (value) => {
        const next = ensureAiSettings();
        const fallback = aiDefaults[next.provider || "openai"].model;
        next.model = value.trim() || fallback;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Base URL").addText((text) => {
      const provider = ai.provider || "openai";
      text.setPlaceholder(aiDefaults[provider].baseUrl);
      text.setValue(ai.baseUrl || aiDefaults[provider].baseUrl);
      text.onChange(async (value) => {
        const next = ensureAiSettings();
        const fallback = aiDefaults[next.provider || "openai"].baseUrl;
        next.baseUrl = value.trim() || fallback;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Strict execution mode").addToggle((toggle) => {
      toggle.setValue(Boolean(ai.strictExecution));
      toggle.onChange(async (value) => {
        const next = ensureAiSettings();
        next.strictExecution = value;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Conversation memory (messages)").addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "50";
      text.setValue(String(ai.memoryLimit ?? 10));
      text.onChange(async (value) => {
        const next = ensureAiSettings();
        const memory = Number(value);
        next.memoryLimit = Number.isFinite(memory) ? Math.max(0, Math.min(50, memory)) : 10;
        await this.plugin.saveSettings();
        text.setValue(String(next.memoryLimit));
      });
    });

    new Setting(containerEl).setName("Mixed intent offer text").addTextArea((text) => {
      text.setPlaceholder(defaultMixedOfferText);
      text.setValue(ai.mixedOfferText || "");
      text.onChange(async (value) => {
        const next = ensureAiSettings();
        next.mixedOfferText = value.trim();
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl)
      .setName("MCP servers (JSON array)")
      .setDesc(
        "Use apiKeySecretName per server. Legacy apiKey values are migrated to SecretStorage.",
      )
      .addTextArea((text) => {
        text.setPlaceholder(
          '[{"name":"calendar","url":"http://localhost:3000","apiKeySecretName":"projectflow-mcp-calendar"}]',
        );
        text.setValue(JSON.stringify(ai.mcpServers || []));
        text.onChange(async (value) => {
          const next = ensureAiSettings();
          try {
            const parsed = JSON.parse(value || "[]");
            const servers = Array.isArray(parsed) ? parsed : [];
            next.mcpServers = await this.plugin.normalizeMcpServersWithSecrets(servers);
            await this.plugin.saveSettings();
          } catch {
            new Notice("Invalid MCP servers JSON");
          }
        });
      });
  }
}
