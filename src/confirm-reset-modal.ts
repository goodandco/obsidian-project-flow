import {Modal} from "obsidian";

export class ConfirmResetModal extends Modal {
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
