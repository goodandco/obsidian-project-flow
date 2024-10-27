// Модал для текстового ввода
import {Modal, App} from "obsidian";

export class InputPromptModal extends Modal {
  prompt: string;
  callback: (input: string | null) => void;

  constructor(app: App, prompt: string, callback: (input: string | null) => void) {
    super(app);
    this.prompt = prompt;
    this.callback = callback;
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.createEl('h2', {text: this.prompt});

    const input = contentEl.createEl('input', {type: 'text'});
    input.focus();

    const submitButton = contentEl.createEl('button', {text: 'Submit'});
    submitButton.onclick = () => {
      const value = input.value.trim();
      this.close();
      this.callback(value ? value : null);
    };
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
