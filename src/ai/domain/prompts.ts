import type { ProjectFlowPlugin } from "../../plugin";
import { inferActiveProject } from "./context";

export async function buildSystemPrompt(plugin: ProjectFlowPlugin): Promise<string> {
  const selection = getSelection(plugin);
  const activeFile = plugin.app.workspace.getActiveFile();
  let activeFileContent = "";
  if (activeFile) {
    try {
      const raw = await plugin.app.vault.cachedRead(activeFile);
      activeFileContent = raw.slice(0, 1000);
    } catch {
      activeFileContent = "";
    }
  }
  const projectIndex = plugin.settings.projectIndex;
  const activeProject = inferActiveProject(plugin);
  const entityRequirements = getEntityRequirementsSummary(plugin);

  return [
    "You are ProjectFlow AI. You must use tools to perform any actions.",
    "Never edit markdown directly; use tools only.",
    "Respond with tool calls when an action is required.",
    "If required fields are missing, ask the user for them instead of calling tools.",
    "Use camelCase fields in createEntity (e.g., fields.title, fields.description).",
    "Example tool call: createEntity { projectRef:{tag:\"my-tag\"}, entityTypeId:\"task\", fields:{ title:\"...\", description:\"...\" } }",
    "Context:",
    `Selected text: ${selection || "(none)"}`,
    `Active file: ${activeFile?.path || "(none)"}`,
    `Active file content (truncated): ${activeFileContent || "(none)"}`,
    `Active project: ${activeProject ? `${activeProject.projectTag} (${activeProject.fullName})` : "(none)"}`,
    `Entity required fields: ${entityRequirements}`,
    `Project index snapshot: ${projectIndex ? JSON.stringify(projectIndex) : "(none)"}`,
  ].join("\n");
}

export function buildUserMessage(input: string): string {
  return `I'm going to create a project with tag ${input}\n${input}`;
}

function getSelection(plugin: ProjectFlowPlugin): string {
  const editor = (plugin.app.workspace as any).activeEditor?.editor;
  if (!editor) return "";
  return editor.getSelection();
}

function getEntityRequirementsSummary(plugin: ProjectFlowPlugin): string {
  const registry = plugin.settings.entityTypes || {};
  const summary: Record<string, string[]> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (def?.requiredFields && def.requiredFields.length > 0) {
      summary[id] = def.requiredFields;
    }
  }
  try {
    return JSON.stringify(summary);
  } catch {
    return "(unavailable)";
  }
}
