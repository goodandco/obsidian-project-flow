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
    "CRITICAL — Creating a project: The user MUST explicitly provide the project id (unique vault folder identifier, e.g. 'myproj') and tag (reference label, e.g. 'project/my-project'). NEVER invent or auto-generate these values unless the user has explicitly asked you to do so (e.g. 'generate the id for me'). If either is missing, ask the user before calling createProject.",
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
  ].join("\n");
}

function getProjectTypeSummary(plugin: ProjectFlowPlugin): string {
  try {
    const types = mergeProjectTypes(plugin.settings.projectTypes);
    const summary = Object.values(types)
      .map((t: any) => `${t.id}: ${t.name} (${t.description || "No description"})`)
      .join("; ");
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
  const summary: Record<string, Record<string, Record<string, string>>> = {};

  for (const typeId of Object.keys(projectTypes)) {
    const registry = mergeEntityTypes(projectTypes, typeId) as Record<string, any>;
    const typeSummary: Record<string, Record<string, string>> = {};
    for (const [id, def] of Object.entries(registry)) {
      if (!def?.fields) continue;
      const fieldSummary: Record<string, string> = {};
      for (const [key, schema] of Object.entries(def.fields as Record<string, any>)) {
        if (schema.role === "index") {
          fieldSummary[key] = "auto-index";
          continue;
        }
        // Exclude agent-resolved fields from user-facing planner summary
        if (AGENT_RESOLVED_FIELDS.has(key)) continue;
        if (schema.type === "reference" && schema.refersTo?.entityType) {
          fieldSummary[key] = `reference:${schema.refersTo.entityType}`;
        } else {
          fieldSummary[key] = schema.required ? "required" : "optional";
        }
      }
      if (Object.keys(fieldSummary).length > 0) typeSummary[id] = fieldSummary;
    }
    if (Object.keys(typeSummary).length > 0) summary[typeId] = typeSummary;
  }

  try {
    return JSON.stringify(summary);
  } catch {
    return "(unavailable)";
  }
}

export async function buildSpecializedSystemPrompt(
  plugin: ProjectFlowPlugin,
  projectRecord: ProjectRecord,
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
      "  Modules/{moduleTitle}/                                              ← module folder",
      "  Modules/{moduleTitle}/{moduleTitle}.md                             ← module file",
      "  Modules/{moduleTitle}/Lessons/{lessonTitle}/                       ← lesson folder",
      "  Modules/{moduleTitle}/Lessons/{lessonTitle}/{lessonTitle}.md       ← lesson file",
      "",
      "CRITICAL RULE — parentFolder:",
      "  parentFolder MUST be the EXACT existing folder path from the project root.",
      "  You MUST call listProjectFiles (with subfolder='Modules') BEFORE creating any lesson, note, assignment, or review.",
      "  Use the returned folder paths verbatim as parentFolder. Never construct the path from the title alone.",
      "",
      "  Allowed parentFolder targets per entity type (from the fields schema):",
      "  - createLesson:     module folder or project root (e.g. 'Modules/Module 1 - Intro' or '')",
      "  - createNote:       module, lesson, project root, assignment, or review folder",
      "  - createAssignment: module, lesson, or project root",
      "  - createReview:     project root, module, lesson, or assignment folder",
      "",
      "  LESSON parentFolder (CRITICAL):",
      "  parentFolder for a lesson = the MODULE folder (e.g. 'Modules/Module 1 - Intro').",
      "  The system AUTOMATICALLY appends /Lessons/{title} to place the lesson inside the Lessons subfolder.",
      "  NEVER pass a Lessons subfolder (e.g. 'Modules/Module 1 - Intro/Lessons') as parentFolder for a lesson.",
      "",
      "  parentFolder examples (after calling listProjectFiles):",
      "  - '' (empty string) → course-level, entities go to root Notes/, Assignments/, Reviews/",
      "  - 'Modules/Module 1 - Intro' → module-level (USE THIS for createLesson)",
      "  - 'Modules/Module 1 - Intro/Lessons/Lesson 1 - Intro' → lesson-level (for notes/assignments/reviews inside a lesson)",
    );
  }

  return lines.join("\n");
}

function getEntityRequirementsSummaryForProject(
  plugin: ProjectFlowPlugin,
  projectTypeId: string,
): string {
  const registry = mergeEntityTypes(
    mergeProjectTypes(plugin.settings.projectTypes),
    projectTypeId,
  ) as Record<string, any>;
  const typeSummary: Record<string, Record<string, string>> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (!def?.fields) continue;
    const fieldSummary: Record<string, string> = {};
    for (const [key, schema] of Object.entries(def.fields as Record<string, any>)) {
      if (schema.role === "index") {
        fieldSummary[key] = "auto-index";
        continue;
      }
      if (schema.type === "reference" && schema.refersTo?.entityType) {
        fieldSummary[key] = `reference:${schema.refersTo.entityType}`;
      } else {
        fieldSummary[key] = schema.required ? "required" : "optional";
      }
    }
    if (Object.keys(fieldSummary).length > 0) typeSummary[id] = fieldSummary;
  }
  try {
    return JSON.stringify(typeSummary);
  } catch {
    return "(unavailable)";
  }
}
