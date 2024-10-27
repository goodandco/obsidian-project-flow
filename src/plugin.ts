import {Notice, Plugin} from 'obsidian';
import {InputPromptModal} from "./input-modal";
import {ChoicePromptModal} from "./choise-modal";

// Интерфейс для хранения информации о проекте
interface ProjectInfo {
  name: string;
  type: string;
}

export class AutomatorPlugin extends Plugin {
  async onload() {
    console.log('MyPlugin loaded');

    // Добавляем команду в панель команд Obsidian
    this.addCommand({
      id: 'add-project-info',
      name: 'Add Project Info',
      callback: () => this.showProjectPrompt()
    });
  }

  async showProjectPrompt() {
    // Запрашиваем у пользователя имя проекта
    const projectName = await this.promptForText('Введите имя проекта:');
    if (!projectName) {
      new Notice('Проект не был создан. Имя проекта не введено.');
      return;
    }

    // Запрашиваем тип проекта
    const projectType = await this.promptForChoice('Выберите тип проекта:', [
      'Work',
      'Education',
      'Family',
      'Health',
      'Personal'
    ]);

    if (!projectType) {
      new Notice('Проект не был создан. Тип проекта не выбран.');
      return;
    }

    // Выводим уведомление с результатом
    const projectInfo: ProjectInfo = {name: projectName, type: projectType};
    new Notice(`Создан проект: ${projectInfo.name}, Тип: ${projectInfo.type}`);

    // Можно добавить логику для создания файла или сохранения информации о проекте
    this.createProjectFile(projectInfo);
  }

  // Функция для запроса текстового ввода (имя проекта)
  async promptForText(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new InputPromptModal(this.app, prompt, resolve);
      modal.open();
    });
  }

  // Функция для выбора опции (тип проекта)
  async promptForChoice(prompt: string, choices: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new ChoicePromptModal(this.app, prompt, choices, resolve);
      modal.open();
    });
  }

  // Создание файла проекта (опционально, пример)
  async createProjectFile(projectInfo: ProjectInfo) {
    // Проверяем, установлен ли Templater
    const templaterPlugin = (this.app as any).plugins.plugins["templater-obsidian"];
    if (!templaterPlugin) {
      new Notice('Плагин Templater не активирован или не установлен.');
      return;
    }
    const {projectDir, templateFileName, fileName} = getProjectData(projectInfo);
    // Проверяем, существует ли директория проекта
    const dir = this.app.vault.getAbstractFileByPath(projectDir);
    if (!dir) {
      // Создаем директорию для проекта, если она не существует
      await this.app.vault.createFolder(projectDir);
    }

    const file = this.app.vault.getAbstractFileByPath(fileName);
    if (file) {
      new Notice(`Файл проекта "${projectInfo.name}" уже существует.`);
      return;
    }

    // Создаем новый файл
    // Применяем шаблон через метод плагина Templater
    try {
      const tp = templaterPlugin.templater.current_functions_object;
      const templateFile = tp.file.find_tfile(templateFileName);
      await tp.file.create_new(templateFile, fileName, false, projectDir);
      new Notice(`Файл проекта "${projectInfo.name}" создан с использованием Templater.`);
    } catch (error) {
      new Notice('Ошибка при использовании Templater: ' + error);
    }

  }
}

type ProjectData = {
  fileName: string;
  templateFileName: string;
  projectDir: string;
}

function getProjectData({type, name}: ProjectInfo): ProjectData {
  const suffix = ['Work', 'Education'].includes(type) ? '1. Business' : '2. Family';
  const projectDir = `1. Projects/${suffix}/${type}/${name}`;
  const fileName = name;
  const templateFileName = `Templates/Projects/${type}ProjectTemplate.md`;

  return {projectDir, fileName, templateFileName}
}


/**
 *
 *
 * app.fileManager.vault.fileMap['1. Projects/1. Business/Education'].children.map(c => c.name)
 */
