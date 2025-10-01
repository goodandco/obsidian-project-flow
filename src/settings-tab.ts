import {Notice, PluginSettingTab, setIcon} from "obsidian";
import {AutomatorPlugin} from "./plugin";
import {ProjectFlowSettings} from "./interfaces";
import {ConfirmResetModal} from "./confirm-reset-modal";

const DEFAULT_DIMENSIONS = [
  {name: 'Business', order: 1, categories: ['R&D', 'Jobs', 'OpenSource', 'Education']},
  {name: 'Family', order: 2, categories: ['Vacations', 'Parenting', 'Common']},
  {name: 'Friends', order: 3, categories: []},
  {name: 'Health', order: 4, categories: ['Clinics', 'Issues', 'R&D']},
  {name: 'Personal', order: 5, categories: ['R&D', 'Languages', 'SelfManagement', 'Writing', 'Reading', 'Music', 'Sports']},
  {name: 'Residence', order: 6, categories: []},
];

export const DEFAULT_SETTINGS: ProjectFlowSettings = {
  dimensions: JSON.parse(JSON.stringify(DEFAULT_DIMENSIONS)),
  projectsRoot: '1. Projects',
  projectRecords: {},
};

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export class ProjectFlowSettingTab extends PluginSettingTab {
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

    // Sort dimensions by order ascending for display
        const dims = [...this.plugin.settings.dimensions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        dims.forEach((dim, dimIdx) => {
      const dimDiv = containerEl.createDiv({cls: 'dimension-setting'});
      const headerDiv = dimDiv.createDiv({cls: 'dimension-header'});

      headerDiv.addClass('gc-row');
      // Order label
      headerDiv.createSpan({ text: `${dim.order}. ` });
      const nameEl = headerDiv.createEl('b', {text: dim.name});
      headerDiv.createDiv({cls: 'gc-spacer'});

      // Reorder buttons
      const moveUpBtn = headerDiv.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
      moveUpBtn.setAttr('aria-label', `Move up`);
      moveUpBtn.setAttr('title', `Move up`);
      try { setIcon(moveUpBtn, 'arrow-up'); } catch (e) { moveUpBtn.setText('Up'); }
      moveUpBtn.onclick = async () => {
        const items = this.plugin.settings.dimensions;
        // find neighbor with immediately smaller order
        const prev = [...items].filter(d => (d.order ?? 0) < (dim.order ?? 0)).sort((a,b)=> (b.order??0)-(a.order??0))[0];
        if (!prev) return;
        const tmp = prev.order;
        prev.order = dim.order;
        dim.order = tmp;
        await this.plugin.saveSettings();
        this.display();
      };

      const moveDownBtn = headerDiv.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
      moveDownBtn.setAttr('aria-label', `Move down`);
      moveDownBtn.setAttr('title', `Move down`);
      try { setIcon(moveDownBtn, 'arrow-down'); } catch (e) { moveDownBtn.setText('Down'); }
      moveDownBtn.onclick = async () => {
        const items = this.plugin.settings.dimensions;
        const next = [...items].filter(d => (d.order ?? 0) > (dim.order ?? 0)).sort((a,b)=> (a.order??0)-(b.order??0))[0];
        if (!next) return;
        const tmp = next.order;
        next.order = dim.order;
        dim.order = tmp;
        await this.plugin.saveSettings();
        this.display();
      };

      // Remove dimension button (aligned right) - declared before edit handler uses it
      const removeBtn = headerDiv.createEl('button', {cls: ['gc-icon-button', 'clickable-icon']});
      removeBtn.setAttr('aria-label', `Delete ${dim.name}`);
      removeBtn.setAttr('title', `Delete ${dim.name}`);
      try { setIcon(removeBtn, 'trash'); } catch (e) { removeBtn.setText('Remove'); }
      removeBtn.onclick = async () => {
        const idx = this.plugin.settings.dimensions.findIndex(d => d === dim);
        if (idx >= 0) this.plugin.settings.dimensions.splice(idx, 1);
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
          if (this.plugin.settings.dimensions.some((d) => d !== dim && d.name === next)) {
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
          // Compute project IDs for this category from stored projectRecords
          const recs = (this.plugin.settings.projectRecords || {}) as Record<string, Record<string, Record<string, any>>>;
          const dimName = dim.name;
          const ids = Object.keys(recs?.[dimName]?.[cat] || {});
          // Render category name first (bold), then space-separated IDs with random colors
          const catLabel = item.createEl('b', { text: cat });
          // container for IDs
          const idsWrap = item.createDiv({ cls: 'gc-id-wrap' });
          if (ids.length > 0) {
            // prepend a space between category and ids list for readability
            idsWrap.createSpan({ text: ' ' });
            ids.forEach((pid, idx) => {
              const tag = idsWrap.createSpan({ cls: 'gc-id-tag', text: pid });
              // Apply a deterministic pseudo-random color based on ID to keep stable across renders
              const hue = Math.abs(hashString(pid)) % 360;
              tag.style.backgroundColor = `hsl(${hue}, 70%, 90%)`;
              tag.style.color = `hsl(${hue}, 70%, 25%)`;
              // add space between tags (space-separated)
              if (idx < ids.length - 1) idsWrap.createSpan({ text: ' ' });
            });
          }
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
        {
                const maxOrder = this.plugin.settings.dimensions.reduce((m, d) => Math.max(m, d.order ?? 0), 0);
                this.plugin.settings.dimensions.push({name: val, order: maxOrder + 1, categories: []});
                }
        await this.plugin.saveSettings();
        this.display();
      }
    };
  }
}
