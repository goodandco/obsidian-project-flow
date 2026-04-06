import { Modal, TFile } from "obsidian";
import type { App } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { ProjectIndexEntry } from "../interfaces";
import { mergeProjectTypes, mergeEntityTypes } from "../core/registry-merge";

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

    // Build field list: title first, then other required fields, then described fields
    const requiredFields = et.requiredFields ?? [];
    const describedFields = Object.keys(et.fieldDescriptions ?? {});
    const allFieldKeys = [
      "title",
      ...requiredFields.filter((k) => k !== "title"),
      ...describedFields.filter(
        (k) => k !== "title" && !requiredFields.includes(k),
      ),
    ];
    // Dedupe
    const seen = new Set<string>();
    const fieldKeys: string[] = [];
    for (const k of allFieldKeys) {
      if (!seen.has(k)) {
        seen.add(k);
        fieldKeys.push(k);
      }
    }

    const body = contentEl.createDiv({ cls: "pf-ecm-body" });

    for (const key of fieldKeys) {
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

  private async handleSubmit(
    et: ReturnType<typeof mergeEntityTypes>[string],
    apiErrorEl: HTMLElement,
  ): Promise<void> {
    const requiredFields = et.requiredFields ?? [];
    const allRequired = ["title", ...requiredFields.filter((k: string) => k !== "title")];

    // Validate
    let firstError: HTMLElement | null = null;
    for (const key of allRequired) {
      const input = this.fieldInputs.get(key);
      if (!input || input.value.trim() === "") {
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

    // Build fields object
    const fields: Record<string, string> = {};
    for (const [key, input] of this.fieldInputs.entries()) {
      const v = input.value.trim();
      if (v) fields[key] = v;
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
