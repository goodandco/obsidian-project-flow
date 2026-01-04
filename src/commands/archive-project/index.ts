import { Notice } from "obsidian";
import { IProjectFlowPlugin, ProjectInfoFromPrompt } from "../../interfaces";
import { getProjectDetailsWithPrompt } from "../../utils/project-prompts";
import { archiveProjectByPromptInfo } from "../../services/project-management-service";

export async function showArchiveProjectPrompt(plugin: IProjectFlowPlugin) {
  const [projectInfo, promptMessage] = await getProjectDetailsWithPrompt(plugin.app, plugin.settings);
  if (projectInfo === null) {
    new Notice(promptMessage);
    return;
  }
  const {dimension, category, projectId} = projectInfo as ProjectInfoFromPrompt;
  const [, archiveMessage] = await archiveProjectByPromptInfo(plugin, dimension, category, projectId);

  new Notice(archiveMessage);
  console.log(archiveMessage);
}
