import { App } from "obsidian";
import { InputPromptModal } from "../input-modal";
import { ChoicePromptModal } from "../choice-modal";

export async function promptForText(app: App, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new InputPromptModal(app, prompt, resolve);
    modal.open();
  });
}

export async function promptForChoice(
  app: App,
  prompt: string,
  choices: string[],
): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new ChoicePromptModal(app, prompt, choices, resolve);
    modal.open();
  });
}
