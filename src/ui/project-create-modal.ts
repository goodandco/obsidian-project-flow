import { Modal, TFile } from "obsidian";
import type { App } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { ProjectType } from "../interfaces";
import { mergeProjectTypes } from "../core/registry-merge";

const BUILTIN_TYPE_ORDER = ["operational", "learning"];

function deriveTag(name: string): string {
  const slug = name
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `project/${slug}`;
}

function deriveId(name: string): string {
  return name.replace(/[^A-Z]/g, "");
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

function hueClass(id: string): string {
  return `gc-id-hue-${Math.abs(hashStr(id)) % 12}`;
}

export class ProjectCreateModal extends Modal {
  private plugin: ProjectFlowPlugin;
  private onCreated: () => void;

  private selectedTypeId = "";
  private idAutoDerive = true;
  private tagAutoDerive = true;

  private nameInput: HTMLInputElement | null = null;
  private idInput: HTMLInputElement | null = null;
  private tagInput: HTMLInputElement | null = null;
  private dimSelect: HTMLSelectElement | null = null;
  private catSelect: HTMLSelectElement | null = null;
  private parentSelect: HTMLSelectElement | null = null;
  private previewEl: HTMLElement | null = null;
  private apiErrorEl: HTMLElement | null = null;

  constructor(app: App, plugin: ProjectFlowPlugin, onCreated: () => void) {
    super(app);
    this.plugin = plugin;
    this.onCreated = onCreated;

    // Default to first project type
    const types = mergeProjectTypes(plugin.settings.projectTypes);
    const ids = [
      ...BUILTIN_TYPE_ORDER.filter((id) => types[id]),
      ...Object.keys(types).filter((id) => !BUILTIN_TYPE_ORDER.includes(id)),
    ];
    this.selectedTypeId = ids[0] ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pf-pcm");

    contentEl.createEl("h2", { cls: "pf-pcm-title", text: "Create new project" });

    this.apiErrorEl = contentEl.createDiv({ cls: "pf-pcm-api-error" });
    this.apiErrorEl.style.display = "none";

    this.renderTypeSelector(contentEl);
    this.renderFormFields(contentEl);
    this.previewEl = contentEl.createDiv({ cls: "pf-pcm-preview" });
    this.renderPreview();
    this.renderFooter(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
    this.nameInput = null;
    this.idInput = null;
    this.tagInput = null;
    this.dimSelect = null;
    this.catSelect = null;
    this.parentSelect = null;
    this.previewEl = null;
    this.apiErrorEl = null;
  }

  private renderTypeSelector(container: HTMLElement): void {
    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const typeIds = [
      ...BUILTIN_TYPE_ORDER.filter((id) => allTypes[id]),
      ...Object.keys(allTypes).filter((id) => !BUILTIN_TYPE_ORDER.includes(id)),
    ];

    const scroll = container.createDiv({ cls: "pf-pcm-type-scroller" });
    for (const id of typeIds) {
      const type = allTypes[id];
      const card = scroll.createDiv({
        cls: "pf-pcm-type-card " + hueClass(id) + (id === this.selectedTypeId ? " active" : ""),
      });
      card.createDiv({ cls: "pf-pcm-type-card-name", text: type.name });
      if (type.description) {
        card.createDiv({ cls: "pf-pcm-type-card-desc", text: type.description });
      }
      card.addEventListener("click", () => {
        this.selectedTypeId = id;
        scroll.querySelectorAll(".pf-pcm-type-card").forEach((c) => c.removeClass("active"));
        card.addClass("active");
        this.renderPreview();
      });
    }
  }

  private renderFormFields(container: HTMLElement): void {
    const form = container.createDiv({ cls: "pf-pcm-form" });

    // Project name
    const nameRow = form.createDiv({ cls: "pf-pcm-field" });
    nameRow.createEl("label", { cls: "pf-pcm-label", text: "Project name *" });
    this.nameInput = nameRow.createEl("input", {
      cls: "pf-pcm-input",
      attr: { type: "text", placeholder: "e.g. API Gateway Refactor" },
    });
    this.nameInput.addEventListener("input", () => {
      const val = this.nameInput!.value;
      if (this.idAutoDerive && this.idInput) {
        this.idInput.value = deriveId(val);
      }
      if (this.tagAutoDerive && this.tagInput) {
        this.tagInput.value = deriveTag(val);
      }
      this.renderPreview();
      this.clearFieldError(nameRow);
    });

    // Project ID
    const idRow = form.createDiv({ cls: "pf-pcm-field" });
    idRow.createEl("label", { cls: "pf-pcm-label", text: "Project ID *" });
    const idWrap = idRow.createDiv({ cls: "pf-pcm-input-prefix-wrap" });
    idWrap.createSpan({ cls: "pf-pcm-input-prefix", text: "#" });
    this.idInput = idWrap.createEl("input", {
      cls: "pf-pcm-input pf-pcm-input-prefixed",
      attr: { type: "text", placeholder: "my-project" },
    });
    this.idInput.addEventListener("input", () => {
      this.idAutoDerive = false;
      this.renderPreview();
      this.clearFieldError(idRow);
    });

    // Project tag
    const tagRow = form.createDiv({ cls: "pf-pcm-field" });
    tagRow.createEl("label", { cls: "pf-pcm-label", text: "Project tag *" });
    const tagWrap = tagRow.createDiv({ cls: "pf-pcm-input-prefix-wrap" });
    tagWrap.createSpan({ cls: "pf-pcm-input-prefix", text: "#" });
    this.tagInput = tagWrap.createEl("input", {
      cls: "pf-pcm-input pf-pcm-input-prefixed",
      attr: { type: "text", placeholder: "my-project" },
    });
    this.tagInput.addEventListener("input", () => {
      this.tagAutoDerive = false;
      this.clearFieldError(tagRow);
    });

    // Parent project (optional)
    const parentField = form.createDiv({ cls: "pf-pcm-field" });
    parentField.createEl("label", { cls: "pf-pcm-label", text: "Parent project" });
    this.parentSelect = parentField.createEl("select", { cls: "pf-pcm-select" });
    this.parentSelect.createEl("option", { value: "", text: "None" });
    const allProjects = this.plugin.getApi()?.listProjects() ?? [];
    const sortedProjects = [...allProjects].sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
    for (const p of sortedProjects) {
      this.parentSelect.createEl("option", { value: p.projectId, text: p.projectName });
    }
    this.parentSelect.addEventListener("change", () => this.renderPreview());

    // Dimension + Category (side by side)
    const dimCatRow = form.createDiv({ cls: "pf-pcm-dim-cat-row" });

    const dimField = dimCatRow.createDiv({ cls: "pf-pcm-field" });
    dimField.createEl("label", { cls: "pf-pcm-label", text: "Dimension *" });
    this.dimSelect = dimField.createEl("select", { cls: "pf-pcm-select" });
    const dims = [...(this.plugin.settings.dimensions ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const dim of dims) {
      this.dimSelect.createEl("option", { value: dim.name, text: dim.name });
    }
    this.dimSelect.addEventListener("change", () => {
      this.populateCatSelect();
      this.renderPreview();
      this.clearFieldError(dimField);
    });

    const catField = dimCatRow.createDiv({ cls: "pf-pcm-field" });
    catField.createEl("label", { cls: "pf-pcm-label", text: "Category *" });
    this.catSelect = catField.createEl("select", { cls: "pf-pcm-select" });
    this.catSelect.addEventListener("change", () => this.renderPreview());
    this.populateCatSelect();
  }

  private populateCatSelect(): void {
    if (!this.catSelect || !this.dimSelect) return;
    this.catSelect.empty();
    const selectedDim = this.dimSelect.value;
    const dim = (this.plugin.settings.dimensions ?? []).find((d) => d.name === selectedDim);
    for (const cat of dim?.categories ?? []) {
      this.catSelect.createEl("option", { value: cat, text: cat });
    }
  }

  private renderPreview(): void {
    const el = this.previewEl;
    if (!el) return;
    el.empty();

    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const type: ProjectType | undefined = allTypes[this.selectedTypeId];
    if (!type) return;

    const projectName = this.nameInput?.value.trim() || "project-name";
    const parent = this.parentSelect?.value || "";
    const projectsRoot = this.plugin.settings.projectsRoot ?? "1. Projects";
    const dimension = this.dimSelect?.value || "";
    const category = this.catSelect?.value || "";
    const year = new Date().getFullYear().toString();
    const parentSegment = parent ? `.${parent}` : "";
    const projectFullName = `${year}${parentSegment}.${projectName}`;
    const rootPath = [projectsRoot, dimension, category, projectFullName].filter(Boolean).join("/");

    el.createDiv({ cls: "pf-pcm-preview-title", text: "Project will create" });

    // Folder structure tree
    const treeWrap = el.createDiv({ cls: "pf-pcm-preview-section" });
    treeWrap.createDiv({ cls: "pf-pcm-preview-section-label", text: "Folder structure" });
    const tree = treeWrap.createEl("pre", { cls: "pf-pcm-tree" });
    const rootLine = `${rootPath}/\n`;
    const subfolders = type.folderStructure ?? [];
    const treeLines = subfolders
      .map((f, i) => (i === subfolders.length - 1 ? `  └─ ${f}/` : `  ├─ ${f}/`))
      .join("\n");
    tree.setText(rootLine + treeLines);

    // Structural files
    if (type.initialNotes?.length) {
      const filesWrap = el.createDiv({ cls: "pf-pcm-preview-section" });
      filesWrap.createDiv({ cls: "pf-pcm-preview-section-label", text: "Structural files" });
      const chips = filesWrap.createDiv({ cls: "pf-pcm-chips" });
      for (const note of type.initialNotes) {
        chips.createSpan({ cls: "pf-pcm-chip", text: note.fileName });
      }
    }

    // Ephemeral templates (entity types)
    const entities = Object.values(type.projectEntities ?? {});
    if (entities.length) {
      const etWrap = el.createDiv({ cls: "pf-pcm-preview-section" });
      etWrap.createDiv({ cls: "pf-pcm-preview-section-label", text: "Entity types" });
      for (const et of entities) {
        const row = etWrap.createDiv({ cls: "pf-pcm-et-row" });
        const ico = row.createSpan({ cls: "pf-pcm-et-ico " + hueClass(et.id) });
        ico.setText((et.name ?? et.id).charAt(0).toUpperCase());
        row.createSpan({ cls: "pf-pcm-et-name", text: et.name ?? et.id });
        row.createEl("code", { cls: "pf-pcm-et-key", text: et.id });
      }
      etWrap.createDiv({
        cls: "pf-pcm-et-note",
        text: "Personalised with your project tag and paths, then stored in Templates/ inside the project folder.",
      });
    }
  }

  private renderFooter(container: HTMLElement): void {
    const footer = container.createDiv({ cls: "pf-pcm-footer" });
    const cancelBtn = footer.createEl("button", { cls: "pf-pcm-btn-cancel", text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    const createBtn = footer.createEl("button", { cls: "pf-pcm-btn-create", text: "Create →" });
    createBtn.addEventListener("click", () => this.handleSubmit());
  }

  private openProjectMainFile(dimension: string, category: string, projectId: string): void {
    const record = this.plugin.settings.projectRecords?.[dimension]?.[category]?.[projectId];
    const vars = (record as any)?.variables;
    if (!vars?.PROJECT_PATH || !vars?.PROJECT_FULL_NAME) return;
    const mainPath = `${vars.PROJECT_PATH}/${vars.PROJECT_FULL_NAME}.md`;
    const file = this.plugin.app.vault.getAbstractFileByPath(mainPath);
    if (!(file instanceof TFile)) return;
    this.plugin.app.workspace.getLeaf().openFile(file);
  }

  private clearFieldError(wrapper: HTMLElement): void {
    wrapper.removeClass("pf-pcm-field-error");
    wrapper.querySelector(".pf-pcm-error-msg")?.remove();
  }

  private showFieldError(wrapper: HTMLElement, msg: string): void {
    wrapper.addClass("pf-pcm-field-error");
    if (!wrapper.querySelector(".pf-pcm-error-msg")) {
      wrapper.createSpan({ cls: "pf-pcm-error-msg", text: msg });
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.nameInput || !this.idInput || !this.tagInput || !this.dimSelect || !this.catSelect)
      return;

    const name = this.nameInput.value.trim();
    const id = this.idInput.value.trim();
    const tag = this.tagInput.value.trim();
    const dimension = this.dimSelect.value;
    const category = this.catSelect.value;
    const parent = this.parentSelect?.value || null;

    let hasError = false;

    const nameRow = this.nameInput.closest(".pf-pcm-field") as HTMLElement;
    const idRow = this.idInput.closest(".pf-pcm-field") as HTMLElement;
    const tagRow = this.tagInput.closest(".pf-pcm-field") as HTMLElement;

    if (!name) {
      this.showFieldError(nameRow, "Required");
      hasError = true;
    }
    if (!id) {
      this.showFieldError(idRow, "Required");
      hasError = true;
    } else if (this.plugin.settings.projectIndex?.byId?.[id]) {
      this.showFieldError(idRow, "ID already exists");
      hasError = true;
    }
    if (!tag) {
      this.showFieldError(tagRow, "Required");
      hasError = true;
    } else if (this.plugin.settings.projectIndex?.byTag?.[tag]) {
      this.showFieldError(tagRow, "Tag already exists");
      hasError = true;
    }

    if (hasError) return;

    this.apiErrorEl!.style.display = "none";

    try {
      const api = this.plugin.getApi();
      await api.createProject({
        name,
        id,
        tag,
        dimension,
        category,
        projectTypeId: this.selectedTypeId,
        ...(parent ? { parent } : {}),
      });
      this.close();
      this.onCreated();
      this.openProjectMainFile(dimension, category, id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.apiErrorEl!.setText(msg);
      this.apiErrorEl!.style.display = "";
    }
  }
}
