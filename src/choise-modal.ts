// Модал для выбора типа проекта
import {Modal, App} from "obsidian";

export class ChoicePromptModal extends Modal {
  prompt: string;
  choices: string[];
  callback: (choice: string | null) => void;

  constructor(app: App, prompt: string, choices: string[], callback: (choice: string | null) => void) {
    super(app);
    this.prompt = prompt;
    this.choices = choices;
    this.callback = callback;
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.createEl('h2', {text: this.prompt});

    this.choices.forEach(choice => {
      const button = contentEl.createEl('button', {text: choice});
      button.onclick = () => {
        this.close();
        this.callback(choice);
      };
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
