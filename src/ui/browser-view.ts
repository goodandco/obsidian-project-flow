import { ItemView, Menu, WorkspaceLeaf, setIcon } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { ProjectIndexEntry } from "../interfaces";
import { mergeProjectTypes } from "../core/registry-merge";
import { EntityCreateModal } from "./entity-create-modal";
import { ProjectCreateModal } from "./project-create-modal";

export const BROWSER_VIEW_TYPE = "projectflow-browser";

const MAX_PINS = 5;
const PAGE_SIZE = 10;
const BUILTIN_TYPE_ORDER = ["operational", "learning"];

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

function hueClass(id: string): string {
  return `gc-id-hue-${Math.abs(hashStr(id)) % 12}`;
}

function metaHueClass(str: string): string {
  return `pf-meta-hue-${Math.abs(hashStr(str)) % 12}`;
}

export class ProjectFlowBrowserView extends ItemView {
  plugin: ProjectFlowPlugin;
  private rootEl: HTMLElement | null = null;

  // Filter state
  private activeDimension: string | null = null;
  private activeCategory: string | null = null;
  private activeProjectType: string | null = null;
  private searchQuery = "";
  private currentPage = 1;
  private expandedProjectId: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return BROWSER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "ProjectFlow";
  }

  getIcon(): string {
    return "layout-list";
  }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("pf-browser-view");
    this.rootEl = root;
    this.render();
  }

  async onClose(): Promise<void> {
    this.rootEl = null;
  }

  refresh(): void {
    this.render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    const root = this.rootEl;
    if (!root) return;
    root.empty();
    this.renderHeader(root);
    this.renderDimTabs(root);
    this.renderCatChips(root);
    this.renderTypeFilter(root);
    this.renderSearch(root);
    this.renderProjectList(root);
    this.renderFooter(root);
  }

  private renderHeader(root: HTMLElement): void {
    const hdr = root.createDiv({ cls: "pf-browser-header" });
    hdr.createSpan({ cls: "pf-browser-header-title", text: "ProjectFlow" });
  }

  private renderDimTabs(root: HTMLElement): void {
    const dims = [...(this.plugin.settings.dimensions ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    const row = root.createDiv({ cls: "pf-browser-dim-tabs" });

    const allTab = row.createEl("button", {
      cls: "pf-browser-dim-tab" + (this.activeDimension === null ? " active" : ""),
      text: "All",
    });
    allTab.addEventListener("click", () => {
      this.activeDimension = null;
      this.activeCategory = null;
      this.currentPage = 1;
      this.render();
    });

    for (const dim of dims) {
      const tab = row.createEl("button", {
        cls: "pf-browser-dim-tab" + (this.activeDimension === dim.name ? " active" : ""),
        text: dim.name,
      });
      tab.addEventListener("click", () => {
        this.activeDimension = dim.name;
        this.activeCategory = null;
        this.currentPage = 1;
        this.render();
      });
    }
  }

  private renderCatChips(root: HTMLElement): void {
    if (this.activeDimension === null) return;
    const dim = (this.plugin.settings.dimensions ?? []).find(
      (d) => d.name === this.activeDimension,
    );
    if (!dim || !dim.categories?.length) return;

    const row = root.createDiv({ cls: "pf-browser-cat-row" });

    const allChip = row.createSpan({
      cls: "pf-browser-cat-chip" + (this.activeCategory === null ? " active" : ""),
      text: "All",
    });
    allChip.addEventListener("click", () => {
      this.activeCategory = null;
      this.currentPage = 1;
      this.render();
    });

    for (const cat of dim.categories) {
      const chip = row.createSpan({
        cls: "pf-browser-cat-chip" + (this.activeCategory === cat ? " active" : ""),
        text: cat,
      });
      chip.addEventListener("click", () => {
        this.activeCategory = cat;
        this.currentPage = 1;
        this.render();
      });
    }
  }

  private renderTypeFilter(root: HTMLElement): void {
    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const typeIds = [
      ...BUILTIN_TYPE_ORDER.filter((id) => allTypes[id]),
      ...Object.keys(allTypes).filter((id) => !BUILTIN_TYPE_ORDER.includes(id)),
    ];
    if (typeIds.length === 0) return;

    const row = root.createDiv({ cls: "pf-browser-type-filter" });

    const allSeg = row.createEl("button", {
      cls: "pf-browser-type-seg" + (this.activeProjectType === null ? " active" : ""),
      text: "All",
    });
    allSeg.addEventListener("click", () => {
      this.activeProjectType = null;
      this.currentPage = 1;
      this.render();
    });

    for (const id of typeIds) {
      const seg = row.createEl("button", {
        cls: "pf-browser-type-seg" + (this.activeProjectType === id ? " active" : ""),
        text: allTypes[id].name,
      });
      seg.addEventListener("click", () => {
        this.activeProjectType = id;
        this.currentPage = 1;
        this.render();
      });
    }
  }

  private renderSearch(root: HTMLElement): void {
    const row = root.createDiv({ cls: "pf-browser-search-row" });
    const input = row.createEl("input", {
      cls: "pf-browser-search-input",
      attr: { placeholder: "Filter by name, tag: or id:", type: "text", value: this.searchQuery },
    });
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      this.currentPage = 1;
      this.renderProjectList(root);
    });

    if (this.searchQuery.startsWith("tag:") || this.searchQuery.startsWith("id:")) {
      const mode = this.searchQuery.startsWith("tag:") ? "Filtering by tag" : "Filtering by ID";
      row.createDiv({ cls: "pf-browser-mode-indicator", text: mode });
    }
  }

  private getFilteredProjects(): {
    pinned: ProjectIndexEntry[];
    unpinned: ProjectIndexEntry[];
  } {
    const api = this.plugin.getApi();
    const allProjects: ProjectIndexEntry[] = api ? api.listProjects() : [];

    const q = this.searchQuery.trim();
    let filterMode: "name" | "tag" | "id" = "name";
    let filterValue = q;
    if (q.startsWith("tag:")) {
      filterMode = "tag";
      filterValue = q.slice(4).trim();
    } else if (q.startsWith("id:")) {
      filterMode = "id";
      filterValue = q.slice(3).trim();
    }

    const records = this.plugin.settings.projectRecords ?? {};
    const pinnedIds = new Set(this.plugin.settings.pinnedProjects ?? []);

    // Pinned projects always shown regardless of active filters
    const pinned = allProjects.filter((e) => pinnedIds.has(e.projectId));

    const unpinned = allProjects.filter((entry) => {
      if (pinnedIds.has(entry.projectId)) return false;

      if (this.activeDimension !== null && entry.dimension !== this.activeDimension) return false;
      if (this.activeCategory !== null && entry.category !== this.activeCategory) return false;

      if (this.activeProjectType !== null) {
        const rec = records[entry.dimension]?.[entry.category]?.[entry.projectId];
        if (rec?.info?.projectTypeId !== this.activeProjectType) return false;
      }

      if (filterValue) {
        if (filterMode === "name") {
          if (!entry.projectName.toLowerCase().includes(filterValue.toLowerCase())) return false;
        } else if (filterMode === "tag") {
          if (!entry.projectTag.includes(filterValue)) return false;
        } else if (filterMode === "id") {
          if (!entry.projectId.includes(filterValue)) return false;
        }
      }
      return true;
    });

    return { pinned, unpinned };
  }

  private renderProjectList(root: HTMLElement): void {
    const existing = root.querySelector(".pf-browser-list-wrap");
    if (existing) existing.remove();

    const wrap = root.createDiv({ cls: "pf-browser-list-wrap" });
    const list = wrap.createDiv({ cls: "pf-browser-list" });

    const { pinned, unpinned } = this.getFilteredProjects();

    // Clean stale pins
    const pinnedIds = this.plugin.settings.pinnedProjects ?? [];
    const validProjectIds = new Set(
      (this.plugin.getApi()?.listProjects() ?? []).map((e: ProjectIndexEntry) => e.projectId),
    );
    const cleanedPins = pinnedIds.filter((id: string) => validProjectIds.has(id));
    if (cleanedPins.length !== pinnedIds.length) {
      this.plugin.settings.pinnedProjects = cleanedPins;
      this.plugin.saveSettings();
    }

    if (pinned.length > 0) {
      list.createDiv({ cls: "pf-browser-section-label", text: "Pinned" });
      for (const entry of pinned) {
        this.renderProjectRow(list, entry, true);
      }
    }

    const totalPages = Math.ceil(unpinned.length / PAGE_SIZE);
    const page = Math.min(this.currentPage, totalPages || 1);
    const pageSlice = unpinned.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const sectionText =
      unpinned.length > 0
        ? `Active · ${unpinned.length}`
        : pinned.length === 0
          ? "No projects"
          : "";
    if (sectionText) {
      list.createDiv({ cls: "pf-browser-section-label", text: sectionText });
    }

    for (const entry of pageSlice) {
      this.renderProjectRow(list, entry, false);
    }

    if (unpinned.length > PAGE_SIZE) {
      this.renderPagination(wrap, page, totalPages);
    }

    // Append after footer placeholder so list fills available space
    const footer = root.querySelector(".pf-browser-footer");
    if (footer) {
      root.insertBefore(wrap, footer);
    } else {
      root.appendChild(wrap);
    }
  }

  private renderProjectRow(
    container: HTMLElement,
    entry: ProjectIndexEntry,
    isPinned: boolean,
  ): void {
    const records = this.plugin.settings.projectRecords ?? {};
    const record = records[entry.dimension]?.[entry.category]?.[entry.projectId];
    const projectTypeId = record?.info?.projectTypeId ?? "";
    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const projectType = projectTypeId ? allTypes[projectTypeId] : null;

    const isExpanded = this.expandedProjectId === entry.projectId;
    const isPinnedNow = (this.plugin.settings.pinnedProjects ?? []).includes(entry.projectId);

    const row = container.createDiv({
      cls: "pf-browser-proj-row" + (isExpanded ? " active" : "") + (isPinned ? " pinned" : ""),
    });

    if (isPinnedNow) {
      const pinMarker = row.createSpan({ cls: "pf-browser-pin-marker" });
      setIcon(pinMarker, "pin");
    }

    const info = row.createDiv({ cls: "pf-browser-proj-info" });
    info.createDiv({ cls: "pf-browser-proj-name", text: entry.projectName });

    const meta = info.createDiv({ cls: "pf-browser-proj-meta" });
    meta.createSpan({ cls: metaHueClass(entry.dimension), text: entry.dimension });
    meta.createSpan({ cls: "pf-browser-meta-arrow", text: " → " });
    meta.createSpan({ cls: metaHueClass(entry.category), text: entry.category });

    if (projectType) {
      const badge = row.createSpan({ cls: "pf-browser-proj-badge " + hueClass(projectTypeId) });
      badge.setText(projectType.name);
    }

    // Pin icon (shown on hover via CSS)
    const pinBtn = row.createSpan({ cls: "pf-browser-pin-icon" });
    setIcon(pinBtn, isPinnedNow ? "pin-off" : "pin");
    pinBtn.title = isPinnedNow ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePin(entry.projectId);
    });

    // Row click: expand/collapse
    row.addEventListener("click", () => {
      this.expandedProjectId = isExpanded ? null : entry.projectId;
      this.render();
    });

    // Right-click context menu
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      if (isPinnedNow) {
        menu.addItem((item) => {
          item.setTitle("Unpin project");
          item.setIcon("pin-off");
          item.onClick(() => this.togglePin(entry.projectId));
        });
      } else {
        menu.addItem((item) => {
          item.setTitle("Pin project");
          item.setIcon("pin");
          item.onClick(() => this.togglePin(entry.projectId));
        });
      }
      menu.showAtMouseEvent(e);
    });

    // Expand area
    if (isExpanded) {
      this.renderEntityExpand(container, entry, projectTypeId, record);
    }
  }

  private renderEntityExpand(
    container: HTMLElement,
    entry: ProjectIndexEntry,
    projectTypeId: string,
    record: any,
  ): void {
    const expand = container.createDiv({ cls: "pf-browser-entity-expand" });

    // Structural files
    const projectPath = record?.variables?.PROJECT_PATH as string | undefined;
    if (projectPath) {
      const vaultFiles = this.plugin.app.vault.getFiles();
      const structuralFiles = vaultFiles.filter((f) => {
        const rel = f.path.startsWith(projectPath + "/")
          ? f.path.slice(projectPath.length + 1)
          : null;
        return rel !== null && !rel.includes("/");
      });
      if (structuralFiles.length > 0) {
        expand.createDiv({ cls: "pf-browser-expand-label", text: "Files" });
        const fileList = expand.createDiv({ cls: "pf-browser-file-list" });
        for (const file of structuralFiles) {
          const row = fileList.createDiv({ cls: "pf-browser-file-row" });
          const ico = row.createSpan({ cls: "pf-browser-file-icon" });
          setIcon(ico, "file-text");
          row.createSpan({ cls: "pf-browser-file-name", text: file.basename });
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            this.plugin.app.workspace.getLeaf().openFile(file);
          });
        }
      }
    }

    expand.createDiv({ cls: "pf-browser-expand-label", text: "Create entity" });

    const allTypes = mergeProjectTypes(this.plugin.settings.projectTypes);
    const entities = allTypes[projectTypeId]?.projectEntities ?? {};
    const entityList = Object.values(entities);

    if (entityList.length === 0) {
      expand.createDiv({ cls: "pf-browser-expand-empty", text: "No entity types defined" });
      return;
    }

    const btns = expand.createDiv({ cls: "pf-browser-create-btns" });
    for (const et of entityList) {
      const btn = btns.createEl("button", { cls: "pf-browser-create-btn" });
      const ico = btn.createSpan({ cls: "pf-browser-btn-ico " + hueClass(et.id) });
      ico.setText((et.name ?? et.id).charAt(0).toUpperCase());
      btn.createSpan({ text: "+ " + (et.name ?? et.id).toLowerCase() });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        new EntityCreateModal(this.plugin.app, this.plugin, entry, et.id, () =>
          this.render(),
        ).open();
      });
    }
  }

  private renderPagination(container: HTMLElement, page: number, totalPages: number): void {
    const bar = container.createDiv({ cls: "pf-browser-pagination" });

    const prev = bar.createEl("button", { cls: "pf-browser-page-btn", text: "←" });
    prev.disabled = page <= 1;
    prev.addEventListener("click", () => {
      this.currentPage = page - 1;
      this.render();
    });

    bar.createSpan({ cls: "pf-browser-page-label", text: `Page ${page} of ${totalPages}` });

    const next = bar.createEl("button", { cls: "pf-browser-page-btn", text: "→" });
    next.disabled = page >= totalPages;
    next.addEventListener("click", () => {
      this.currentPage = page + 1;
      this.render();
    });
  }

  private renderFooter(root: HTMLElement): void {
    const footer = root.createDiv({ cls: "pf-browser-footer" });
    const btn = footer.createEl("button", {
      cls: "pf-browser-new-proj-btn",
      text: "+ New project",
    });
    btn.addEventListener("click", () => {
      new ProjectCreateModal(this.plugin.app, this.plugin, () => this.render()).open();
    });
  }

  // ── Pin helpers ────────────────────────────────────────────────────────────

  private togglePin(projectId: string): void {
    const pins = [...(this.plugin.settings.pinnedProjects ?? [])];
    const idx = pins.indexOf(projectId);
    if (idx >= 0) {
      pins.splice(idx, 1);
    } else {
      if (pins.length >= MAX_PINS) return;
      pins.push(projectId);
    }
    this.plugin.settings.pinnedProjects = pins;
    this.plugin.saveSettings();
    this.render();
  }
}
