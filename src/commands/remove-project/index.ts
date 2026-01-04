import { Notice } from "obsidian";
import { IProjectFlowPlugin, ProjectInfoFromPrompt } from "../../interfaces";
import { getProjectDetailsWithPrompt } from "../../utils/project-prompts";
import { deleteProjectById } from "../../services/project-management-service";

export async function showRemoveProjectPrompt(plugin: IProjectFlowPlugin) {
  const [projectInfo, promptMessage] = await getProjectDetailsWithPrompt(plugin.app, plugin.settings);
  if (projectInfo === null) {
    new Notice(promptMessage);
    return;
  }
  const {dimension, category, projectId} = projectInfo as ProjectInfoFromPrompt;
  const [, deleteMessage] = await deleteProjectById(plugin, dimension, category, projectId);

  new Notice(deleteMessage);
  console.log(deleteMessage);
}
