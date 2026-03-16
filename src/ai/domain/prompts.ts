import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatProjectContext } from "./conversation";
import { inferActiveProject } from "./context";
import type { ProjectRecord } from "../../interfaces";
import { mergeProjectTypes, mergeEntityTypes } from "../../core/registry-merge";

export async function buildSystemPrompt(
  plugin: ProjectFlowPlugin,
  chatProject?: ChatProjectContext | null,
): Promise<string> {
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
  const projectTypeSummary = getProjectTypeSummary(plugin);
  const chatProjectNote = chatProject
    ? `${chatProject.projectId} (${chatProject.projectTag})`
    : "(none)";

  return [
    "You are ProjectFlow AI. You must use tools to perform any actions.",
    "Never edit markdown directly; use tools only.",
    "Respond with tool calls when an action is required.",
    "If required fields are missing, ask the user for them instead of calling tools.",
    "If a chat project context is available, use it as the default projectRef and do not ask for project selection unless the user wants to change it.",
    "When creating projects, use a separate year field if needed; do not include the year inside the name.",
    "CRITICAL — Creating a project: You MUST call listDimensions BEFORE createProject. Use ONLY the dimension names and category values returned by listDimensions. If the required dimension does not exist, call createDimension first. If the required category does not exist inside the chosen dimension, call createCategory first. Never guess, invent, or hard-code dimension or category values.",
    "To interact with or create entities inside a project, you MUST use the `delegateToProjectAssistant` tool. Do NOT try to create entities directly.",
    "Pass clear instructions to the delegated assistant with the exact details of what needs to be created or done.",
    "Example tool call: delegateToProjectAssistant { projectRef:{tag:\"my-tag\"}, instructions:\"Create a new task titled 'Fix bug' with description 'Fix the login bug'\" }",
    "Context:",
    `Selected text: ${selection || "(none)"}`,
    `Active file: ${activeFile?.path || "(none)"}`,
    `Active file content (truncated): ${activeFileContent || "(none)"}`,
    `Active project: ${activeProject ? `${activeProject.projectTag} (${activeProject.fullName})` : "(none)"}`,
    `Chat project context: ${chatProjectNote}`,
    `Available Project Types: ${projectTypeSummary}`,
    `Entity required fields: ${entityRequirements}`,
    `Project index snapshot: ${projectIndex ? JSON.stringify(projectIndex) : "(none)"}`,
  ].join("\n");
}

function getProjectTypeSummary(plugin: ProjectFlowPlugin): string {
  try {
    const types = mergeProjectTypes(plugin.settings.projectTypes);
    const summary = Object.values(types).map((t: any) => `${t.id}: ${t.name} (${t.description || "No description"})`).join("; ");
    return summary || "(none)";
  } catch {
    return "(unavailable)";
  }
}


function getSelection(plugin: ProjectFlowPlugin): string {
  const editor = (plugin.app.workspace as any).activeEditor?.editor;
  if (!editor) return "";
  return editor.getSelection();
}

// Fields that are resolved programmatically by the agent (e.g. via listProjectFiles).
// The planner must never ask the user to provide these.
const AGENT_RESOLVED_FIELDS = new Set(["parentFolder"]);

export function getEntityRequirementsSummary(plugin: ProjectFlowPlugin): string {
  const projectTypes = mergeProjectTypes(plugin.settings.projectTypes);
  const summary: Record<string, Record<string, string[]>> = {};

  for (const typeId of Object.keys(projectTypes)) {
    const registry = mergeEntityTypes(plugin.settings.entityTypes, typeId) as Record<string, any>;
    const typeSummary: Record<string, string[]> = {};
    for (const [id, def] of Object.entries(registry)) {
      if (def && typeof def === "object" && Array.isArray(def.requiredFields) && def.requiredFields.length > 0) {
        // Exclude agent-resolved fields — the planner should never ask the user for these.
        const userFields = (def.requiredFields as string[]).filter((f) => !AGENT_RESOLVED_FIELDS.has(f));
        if (userFields.length > 0) {
          typeSummary[id] = userFields;
        }
      }
    }
    if (Object.keys(typeSummary).length > 0) {
      summary[typeId] = typeSummary;
    }
  }

  try {
    return JSON.stringify(summary);
  } catch {
    return "(unavailable)";
  }
}

export async function buildSpecializedSystemPrompt(
  plugin: ProjectFlowPlugin,
  projectRecord: ProjectRecord
): Promise<string> {
  const projectTypeId = projectRecord.info.projectTypeId || "operational";
  const entityRequirements = getEntityRequirementsSummaryForProject(plugin, projectTypeId);

  const lines = [
    `You are a specialized ProjectFlow AI assistant for the project "${projectRecord.info.name}" (Type: ${projectTypeId}).`,
    "You have access to specialized tools to create and manage entities specific to this project type.",
    "You must use tools to perform any actions.",
    "Never edit markdown directly; use tools only.",
    "Respond with tool calls when an action is required.",
    "Use camelCase fields when creating entities (e.g., fields.title, fields.description).",
    `Entity required fields: ${entityRequirements}`,
  ];

  if (projectTypeId === "learning") {
    lines.push(
      "",
      "LEARNING PROJECT STRUCTURE:",
      "This project uses deeply nested folders. Module folders live under Modules/. Lesson folders live under Modules/{moduleTitle}/Lessons/.",
      "",
      "Folder layout:",
      "  Modules/{moduleTitle}/                    ← module folder (title is the full name e.g. 'Module 1 - Intro')",
      "  Modules/{moduleTitle}/{moduleTitle}.md     ← module file",
      "  Modules/{moduleTitle}/Lessons/{lessonTitle}/              ← lesson folder",
      "  Modules/{moduleTitle}/Lessons/{lessonTitle}/{lessonTitle}.md ← lesson file",
      "",
      "CRITICAL RULE — parentFolder:",
      "  parentFolder MUST be the EXACT existing folder path from the project root.",
      "  You MUST call listProjectFiles (with subfolder='Modules') BEFORE creating any lesson, note, assignment, or review.",
      "  Use the returned folder paths verbatim as parentFolder. Never construct the path from the title alone.",
      "  When creating a lesson, also set 'module' = last segment of parentFolder (e.g. parentFolder 'Modules/Module 1 - Intro' → module 'Module 1 - Intro').",
      "",
      "  *** LESSON parentFolder RULE (CRITICAL) ***",
      "  For createLesson: parentFolder = the MODULE folder (e.g. 'Modules/Module 1 - Intro').",
      "  The system AUTOMATICALLY appends /Lessons/{title} to place the lesson inside the Lessons subfolder.",
      "  NEVER pass the Lessons subfolder (e.g. 'Modules/Module 1 - Intro/Lessons') as parentFolder for a lesson.",
      "  NEVER pass a lesson folder (e.g. 'Modules/Module 1 - Intro/Lessons/Lesson 2') as parentFolder for a lesson.",
      "  When you see 'Lessons', 'Notes', 'Assignments', 'Reviews' subfolders in listProjectFiles results,",
      "  IGNORE them when determining parentFolder for a new lesson. Only use the module-level folder.",
      "",
      "  parentFolder examples (after calling listProjectFiles):",
      "  - '' (empty string) → course-level, entities go to root Notes/, Assignments/, Reviews/",
      "  - 'Modules/Module 1 - Intro' → module-level (USE THIS for createLesson)",
      "  - 'Modules/Module 1 - Intro/Lessons/Lesson 1 - Intro' → lesson-level (for notes/assignments/reviews inside a lesson)",
    );
  }

  return lines.join("\n");
}

function getEntityRequirementsSummaryForProject(plugin: ProjectFlowPlugin, projectTypeId: string): string {
  const registry = mergeEntityTypes(plugin.settings.entityTypes, projectTypeId) as Record<string, any>;
  const typeSummary: Record<string, string[]> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (def && typeof def === "object" && Array.isArray(def.requiredFields) && def.requiredFields.length > 0) {
      typeSummary[id] = def.requiredFields;
    }
  }
  try {
    return JSON.stringify(typeSummary);
  } catch {
    return "(unavailable)";
  }
}
