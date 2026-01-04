import { Notice } from "obsidian";
import { IProjectFlowPlugin, ProjectInfo } from "../../interfaces";
import { getNewProjectDetailsWithPrompt } from "../../utils/project-prompts";
import { createProject } from "../../services/project-service";

export async function showAddProjectPrompt(plugin: IProjectFlowPlugin) {
  const [projectInfo, promptMessage] = await getNewProjectDetailsWithPrompt(plugin.app, plugin.settings);
  if (projectInfo === null) {
    new Notice(promptMessage);
    return;
  }
  const [, projectMessage] = await createProject(plugin, projectInfo as ProjectInfo);

  new Notice(projectMessage);
  console.log(projectMessage);
}
