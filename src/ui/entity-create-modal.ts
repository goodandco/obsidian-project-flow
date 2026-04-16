import { Modal, TFile } from "obsidian";
import type { App } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { EntityFieldSchema, ProjectIndexEntry } from "../interfaces";
import { mergeProjectTypes, mergeEntityTypes } from "../core/registry-merge";
import { templateToFolderRegex } from "../core/template-folder-regex";

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

function hueClass(id: string): string {
  return `gc-id-hue-${Math.abs(hashStr(id)) % 12}`;
}

function titleCase(s: string): string {
  return s
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferFieldType(key: string): "text" | "textarea" | "date" {
  const k = key.toLowerCase();
  if (/description|notes|blockers|scope|agenda|summary/.test(k)) return "textarea";
  if (/date$|startedat|finishedat|duedate|^due$/.test(k)) return "date";
  return "text";
}

function isFullWidth(key: string, type: "text" | "textarea" | "date"): boolean {
  return key === "title" || type === "textarea";
}

function resolveDefault(value: string): string {
  const today = new Date();
  if (value === "today") {
    return today.toLocaleDateString("en-GB");
  }
  const m = value.match(/^today\+(\d+)d$/);
  if (m) {
    const days = parseInt(m[1], 10);
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    return future.toLocaleDateString("en-GB");
  }
  return value;
}

export class EntityCreateModal extends Modal {
  private plugin: ProjectFlowPlugin;
  private projectEntry: ProjectIndexEntry;
  private entityTypeId: string;
  private onSuccess: () => void;
  private fieldInputs: Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> =
    new Map();

  constructor(
    app: App,
    plugin: ProjectFlowPlugin,
    projectEntry: ProjectIndexEntry,
    entityTypeId: string,
    onSuccess: () => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.projectEntry = projectEntry;
    this.entityTypeId = entityTypeId;
    this.onSuccess = onSuccess;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pf-ecm");

    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const entityTypes = mergeEntityTypes(allTypes);
    const et = entityTypes[this.entityTypeId];
    if (!et) {
      contentEl.createEl("p", { text: `Unknown entity type: ${this.entityTypeId}` });
      return;
    }

    // Header
    const hdr = contentEl.createDiv({ cls: "pf-ecm-header" });
    const ico = hdr.createSpan({ cls: "pf-ecm-header-ico " + hueClass(et.id) });
    ico.setText((et.name ?? et.id).charAt(0).toUpperCase());
    hdr.createSpan({
      cls: "pf-ecm-header-title",
      text: "New " + (et.name ?? et.id).toLowerCase(),
    });

    // Error banner (hidden until needed)
    const apiError = contentEl.createDiv({ cls: "pf-ecm-api-error" });
    apiError.style.display = "none";

    // Determine which fields have role: "parentFolder" — handled by the two-stage picker
    const parentFolderKeys = new Set(
      Object.entries(et.fields ?? {})
        .filter(([, s]) => s.role === "parentFolder")
        .map(([k]) => k)
    );

    // Build field list: title first, then other required fields, then described fields
    // Exclude parentFolder keys (handled separately below)
    const requiredFields = et.requiredFields ?? [];
    const describedFields = Object.keys(et.fieldDescriptions ?? {});
    const allFieldKeys = [
      "title",
      ...requiredFields.filter((k) => k !== "title"),
      ...describedFields.filter(
        (k) => k !== "title" && !requiredFields.includes(k),
      ),
    ];
    // Dedupe and exclude parentFolder keys
    const seen = new Set<string>();
    const fieldKeys: string[] = [];
    for (const k of allFieldKeys) {
      if (!seen.has(k) && !parentFolderKeys.has(k)) {
        seen.add(k);
        fieldKeys.push(k);
      }
    }

    const body = contentEl.createDiv({ cls: "pf-ecm-body" });

    for (const key of fieldKeys) {
      // Reference fields get a dropdown populated with existing entities
      const fieldSchema = et.fields?.[key];
      if (fieldSchema?.type === "reference" && fieldSchema.refersTo?.kind === "entity" && fieldSchema.refersTo.entityType) {
        this.renderReferencePicker(body, key, fieldSchema);
        continue;
      }

      const ftype = inferFieldType(key);
      const isRequired = key === "title" || requiredFields.includes(key);
      const fullWidth = isFullWidth(key, ftype);
      const description = (et.fieldDescriptions ?? {})[key] ?? "";
      const defaultVal = (et.fieldDefaults ?? {})[key]
        ? resolveDefault((et.fieldDefaults ?? {})[key])
        : "";

      const wrapper = body.createDiv({
        cls: "pf-ecm-field" + (fullWidth ? " pf-ecm-field-full" : ""),
      });
      const label = wrapper.createEl("label", {
        cls: "pf-ecm-label",
        text: titleCase(key) + (isRequired ? " *" : ""),
      });

      let input: HTMLInputElement | HTMLTextAreaElement;
      if (ftype === "textarea") {
        input = wrapper.createEl("textarea", {
          cls: "pf-ecm-input pf-ecm-textarea",
          attr: { rows: "3", placeholder: description },
        });
      } else {
        input = wrapper.createEl("input", {
          cls: "pf-ecm-input",
          attr: {
            type: ftype === "date" ? "date" : "text",
            placeholder: description,
            value: defaultVal,
          },
        });
      }

      input.id = `pf-ecm-field-${key}`;
      label.setAttribute("for", input.id);

      input.addEventListener("input", () => {
        wrapper.removeClass("pf-ecm-field-error");
        const errSpan = wrapper.querySelector(".pf-ecm-error-msg");
        if (errSpan) errSpan.remove();
      });

      this.fieldInputs.set(key, input);
    }

    // Render two-stage picker for each parentFolder field
    for (const [key, schema] of Object.entries(et.fields ?? {})) {
      if (schema.role === "parentFolder" && schema.allowedParents?.length) {
        this.renderParentFolderPicker(body, key, schema);
      }
    }

    // Footer buttons
    const footer = contentEl.createDiv({ cls: "pf-ecm-footer" });
    const cancelBtn = footer.createEl("button", { cls: "pf-ecm-btn-cancel", text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    const createBtn = footer.createEl("button", { cls: "pf-ecm-btn-create", text: "Create →" });
    createBtn.addEventListener("click", () => this.handleSubmit(et, apiError));
  }

  onClose(): void {
    this.contentEl.empty();
    this.fieldInputs.clear();
  }

  private renderReferencePicker(
    container: HTMLElement,
    fieldKey: string,
    schema: EntityFieldSchema,
  ): void {
    const refEntityTypeId = schema.refersTo!.entityType!;
    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const entityTypes = mergeEntityTypes(allTypes);
    const refEntityType = entityTypes[refEntityTypeId];
    const targetFolder = refEntityType?.targetFolder ?? "";

    const projectPath = this.projectEntry.path;
    const files: string[] = [];
    if (projectPath && targetFolder) {
      const prefix = `${projectPath}/${targetFolder}/`;
      for (const f of this.plugin.app.vault.getAllLoadedFiles()) {
        if ((f as any).children) continue; // skip TFolder
        if (f.path.startsWith(prefix) && f.path.endsWith(".md")) {
          files.push(f.name.replace(/\.md$/, ""));
        }
      }
      files.sort();
    }

    const isRequired = schema.required ?? false;
    const label = `${titleCase(fieldKey)}${isRequired ? " *" : ""}`;
    const hint = schema.description ?? schema.resolveHint ?? "";

    const wrapper = container.createDiv({ cls: "pf-ecm-field" });
    const lbl = wrapper.createEl("label", { cls: "pf-ecm-label", text: label });
    const select = wrapper.createEl("select", { cls: "pf-ecm-input" });
    lbl.setAttribute("for", `pf-ecm-field-${fieldKey}`);
    select.id = `pf-ecm-field-${fieldKey}`;

    if (files.length === 0) {
      const name = refEntityType?.name ?? refEntityTypeId;
      select.createEl("option", { value: "", text: `(no ${name.toLowerCase()}s found)` });
    } else {
      select.createEl("option", { value: "", text: "— select —" });
      for (const f of files) {
        select.createEl("option", { value: f, text: f });
      }
    }

    if (hint) {
      wrapper.createEl("small", { cls: "pf-ecm-hint", text: hint });
    }

    select.addEventListener("change", () => {
      wrapper.removeClass("pf-ecm-field-error");
      const errSpan = wrapper.querySelector(".pf-ecm-error-msg");
      if (errSpan) errSpan.remove();
    });

    this.fieldInputs.set(fieldKey, select);
  }

  private renderParentFolderPicker(
    container: HTMLElement,
    fieldKey: string,
    schema: EntityFieldSchema,
  ): void {
    const allowedParents = schema.allowedParents!;
    const LABELS: Record<string, string> = {
      project: "Project (root level)",
      module: "Module",
      lesson: "Lesson",
      assignment: "Assignment",
      review: "Review",
    };

    // Type selector
    const typeWrapper = container.createDiv({ cls: "pf-ecm-field" });
    const typeLabel = typeWrapper.createEl("label", {
      cls: "pf-ecm-label",
      text: "Parent type *",
    });
    const typeSelect = typeWrapper.createEl("select", { cls: "pf-ecm-input" });
    typeLabel.setAttribute("for", `pf-ecm-field-parentType`);
    typeSelect.id = `pf-ecm-field-parentType`;

    for (const pt of allowedParents) {
      const opt = typeSelect.createEl("option", { value: pt, text: LABELS[pt] ?? pt });
      if (pt === "project") opt.selected = true;
    }

    // Folder picker (hidden when "project" selected)
    const folderWrapper = container.createDiv({ cls: "pf-ecm-field" });
    const folderLabel = folderWrapper.createEl("label", {
      cls: "pf-ecm-label",
      text: "Parent folder *",
    });
    const folderSelect = folderWrapper.createEl("select", { cls: "pf-ecm-input" });
    folderLabel.setAttribute("for", `pf-ecm-field-${fieldKey}`);
    folderSelect.id = `pf-ecm-field-${fieldKey}`;
    folderWrapper.style.display = "none"; // hidden initially (project is default)

    // Hidden input used by handleSubmit via this.fieldInputs
    const hidden = container.createEl("input", { attr: { type: "hidden", value: "" } });
    hidden.id = `pf-ecm-field-${fieldKey}-hidden`;
    this.fieldInputs.set(fieldKey, hidden);

    const refresh = async (parentType: string) => {
      if (parentType === "project") {
        folderWrapper.style.display = "none";
        hidden.value = ""; // empty string = project root
        return;
      }
      folderWrapper.style.display = "";
      folderSelect.empty();
      const folders = await this.discoverFolders(parentType);
      if (folders.length === 0) {
        folderSelect.createEl("option", { value: "", text: "(no folders found)" });
        hidden.value = "";
      } else {
        for (const f of folders) {
          folderSelect.createEl("option", { value: f, text: f });
        }
        hidden.value = folders[0];
      }
      folderSelect.addEventListener("change", () => { hidden.value = folderSelect.value; });
    };

    typeSelect.addEventListener("change", () => refresh(typeSelect.value));
    // Initialize with default (project)
    void refresh(allowedParents.includes("project") ? "project" : allowedParents[0]);
  }

  private async discoverFolders(parentType: string): Promise<string[]> {
    const projectPath = this.projectEntry.path;
    if (!projectPath) return [];

    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const entityTypes = mergeEntityTypes(allTypes);
    const et = entityTypes[parentType];
    if (!et?.targetFolder) return [];

    const regex = templateToFolderRegex(et.targetFolder);

    const results: string[] = [];
    for (const f of this.plugin.app.vault.getAllLoadedFiles()) {
      if (!(f as any).children) continue; // only TFolder
      if (!f.path.startsWith(projectPath + "/")) continue;
      const rel = f.path.slice(projectPath.length + 1);
      if (regex.test(rel)) results.push(rel);
    }
    return results.sort();
  }

  private async handleSubmit(
    et: ReturnType<typeof mergeEntityTypes>[string],
    apiErrorEl: HTMLElement,
  ): Promise<void> {
    const requiredFields = et.requiredFields ?? [];
    const allRequired = ["title", ...requiredFields.filter((k: string) => k !== "title")];

    // Validate — parentFolder is allowed to be empty (project root)
    let firstError: HTMLElement | null = null;
    for (const key of allRequired) {
      const input = this.fieldInputs.get(key);
      if (!input || (input.value.trim() === "" && key !== "parentFolder")) {
        const wrapper = input?.closest(".pf-ecm-field") as HTMLElement;
        if (wrapper) {
          wrapper.addClass("pf-ecm-field-error");
          if (!wrapper.querySelector(".pf-ecm-error-msg")) {
            wrapper.createSpan({ cls: "pf-ecm-error-msg", text: "Required" });
          }
          if (!firstError) firstError = input as HTMLElement;
        }
      }
    }
    if (firstError) {
      firstError.focus();
      return;
    }

    // Build fields object — include parentFolder even when empty (project root = "")
    const fields: Record<string, string> = {};
    for (const [key, input] of this.fieldInputs.entries()) {
      const v = input.value.trim();
      if (v !== "" || key === "parentFolder") fields[key] = v;
    }

    apiErrorEl.style.display = "none";

    try {
      const api = this.plugin.getApi();
      const result = await api.createEntity({
        projectRef: { id: this.projectEntry.projectId },
        entityTypeId: this.entityTypeId,
        fields,
      });
      this.close();
      this.onSuccess();
      const file = this.plugin.app.vault.getAbstractFileByPath(result.path);
      if (file instanceof TFile) {
        this.plugin.app.workspace.getLeaf().openFile(file);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      apiErrorEl.setText(msg);
      apiErrorEl.style.display = "";
    }
  }
}
