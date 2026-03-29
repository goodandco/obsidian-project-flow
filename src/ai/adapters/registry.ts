import type { ProjectFlowPlugin } from "../../plugin";
import type { ToolDefinition } from "../types/tools";
import type { JSONSchema7 } from "../schemas/jsonschema";
import type { EntityType, ProjectRecord } from "../../interfaces";
import type { ChatUi } from "../types/ui";
import type { AiStateStore } from "../domain/conversation";
import { fetchMcpTools, toMcpToolDefinitions } from "../mcp/client";
import { mergeProjectTypes } from "../../core/registry-merge";
import { sanitizePath } from "../../core/path-sanitizer";
import { isSafeRelativePath, isPathWithinRoot } from "../../core/path-constraints";

const projectRefSchema: JSONSchema7 = {
  type: "object",
  description: "Reference to a project by tag, id, or full name.",
  properties: {
    tag: { type: "string" },
    id: { type: "string" },
    fullName: { type: "string" },
  },
  additionalProperties: false,
};

const fieldsSchema: JSONSchema7 = {
  type: "object",
  description: "Fields to set on the entity (camelCase, e.g. title, description).",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
  },
  additionalProperties: true,
};

export function createToolRegistry(plugin: ProjectFlowPlugin, ui: ChatUi, state: AiStateStore): ToolDefinition[] {
  const api = plugin.getApi();
  if (!api) return [];

  return [
    {
      name: "resolveProject",
      description: "Resolve a project by tag, id, or full name.",
      schema: {
        type: "object",
        properties: {
          projectRef: projectRefSchema,
        },
        required: ["projectRef"],
        additionalProperties: false,
      },
      handler: async (args) => api.resolveProject(args.projectRef),
    },
    {
      name: "listProjects",
      description: "List all projects in the vault. Returns an array of entries with fullName, projectId, projectTag, dimension, category, projectName, and parent. Use this to find a project when you only know its name or need to browse available projects.",
      schema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => api.listProjects(),
    },
    {
      name: "listEntityTypes",
      description: "List available entity types.",
      schema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => api.listEntityTypes(),
    },
    {
      name: "listDimensions",
      description: "List all configured vault dimensions and their categories. ALWAYS call this before createProject to discover valid dimension and category values. Never invent or guess these values.",
      schema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        return plugin.settings.dimensions.map((d) => ({
          name: d.name,
          categories: d.categories,
        }));
      },
    },
    {
      name: "createDimension",
      description: "Create a new vault dimension. Use this when the user wants to organise projects under a dimension that does not yet exist. After creation the new dimension is available for createProject.",
      schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-readable name for the new dimension (e.g. 'Work')." },
        },
        required: ["name"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const name = (args.name as string).trim();
        if (!name) return { error: "Dimension name is required." };
        if (plugin.settings.dimensions.some((d) => d.name === name)) {
          return { error: `Dimension "${name}" already exists.` };
        }
        const maxOrder = plugin.settings.dimensions.reduce((m, d) => Math.max(m, d.order ?? 0), 0);
        plugin.settings.dimensions.push({ name, order: maxOrder + 1, categories: [] });
        await plugin.saveData(plugin.settings);
        return { success: true, dimension: name };
      },
    },
    {
      name: "createCategory",
      description: "Add a new category to an existing dimension. Use this when the user wants a category that does not yet exist inside a dimension.",
      schema: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "The dimension name to add the category to (must already exist)." },
          category: { type: "string", description: "The new category name to add (e.g. 'Client')." },
        },
        required: ["dimension", "category"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const dimName = (args.dimension as string).trim();
        const catName = (args.category as string).trim();
        if (!dimName || !catName) return { error: "Both dimension and category are required." };
        const dim = plugin.settings.dimensions.find((d) => d.name === dimName);
        if (!dim) return { error: `Dimension "${dimName}" does not exist. Create it first with createDimension.` };
        if (dim.categories.includes(catName)) {
          return { error: `Category "${catName}" already exists in dimension "${dimName}".` };
        }
        dim.categories.push(catName);
        await plugin.saveData(plugin.settings);
        return { success: true, dimension: dimName, category: catName };
      },
    },
    {
      name: "createProject",
      description: "Create a project. IMPORTANT: You MUST call listDimensions first and use ONLY the dimension names and categories returned by that tool — never invent or guess them. Use projectTypeId to specify the structure (e.g., 'operational' for tasks/meetings, 'learning' for courses/lessons).",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          tag: { type: "string" },
          id: { type: "string" },
          year: { type: "string" },
          dimension: { type: "string", minLength: 1, description: "MUST be a dimension name returned by listDimensions. Cannot be empty." },
          category: { type: "string", minLength: 1, description: "MUST be a category from the chosen dimension, as returned by listDimensions. Cannot be empty." },
          parent: { type: "string" },
          projectTypeId: {
            type: "string",
            enum: Object.keys(mergeProjectTypes(plugin.settings.projectTypes)),
            description: "The type ID of the project (e.g., 'operational', 'learning').",
          },
        },
        required: ["name", "tag", "id", "dimension", "category"],
        additionalProperties: false,
      },
      handler: async (args) => api.createProject(args),
    },
    {
      name: "delegateToProjectAssistant",
      description: "Delegate actions to a specialized project assistant. Use this when the user wants to act on entities (e.g., create a task, add a lesson) within a project.",
      schema: {
        type: "object",
        properties: {
          projectRef: projectRefSchema,
          instructions: { type: "string", description: "Clear instructions for the delegated assistant." },
        },
        required: ["projectRef", "instructions"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const { delegateToProjectAssistant } = await import("../handlers/specialized-agent");
        return delegateToProjectAssistant(plugin, ui, state, args as any);
      }
    },
    {
      name: "patchMarker",
      description: "Patch content into a file at an AI marker.",
      schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          marker: { type: "string" },
          content: { type: "string" },
          mode: { type: "string", enum: ["lenient", "strict"] },
        },
        required: ["path", "marker", "content"],
        additionalProperties: false,
      },
      handler: async (args) => api.patchMarker(args),
    },
    {
      name: "patchSection",
      description: "Patch content into a file by heading.",
      schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          heading: { type: "string" },
          content: { type: "string" },
          mode: { type: "string", enum: ["lenient", "strict"] },
        },
        required: ["path", "heading", "content"],
        additionalProperties: false,
      },
      handler: async (args) => api.patchSection(args),
    },
    {
      name: "getChildren",
      description: "Get child projects for a given project.",
      schema: {
        type: "object",
        properties: {
          projectRef: projectRefSchema,
          archived: { type: "boolean" },
        },
        required: ["projectRef"],
        additionalProperties: false,
      },
      handler: async (args) => api.getChildren(args.projectRef, args.archived),
    },
    {
      name: "getParents",
      description: "Get parent projects for a given project.",
      schema: {
        type: "object",
        properties: {
          projectRef: projectRefSchema,
          archived: { type: "boolean" },
        },
        required: ["projectRef"],
        additionalProperties: false,
      },
      handler: async (args) => api.getParents(args.projectRef, args.archived),
    },
  ];
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  title: "The name/title for this entity.",
  description: "A description of the entity.",
  parentFolder: "FULL relative path from the project root to the parent folder. MUST match an existing folder exactly. ALWAYS call listProjectFiles first to discover the real path. Examples: '' (empty) = course root, 'Modules/Module 1 - Intro' = that module folder, 'Modules/Module 1 - Intro/Lessons/Lesson 1 - Intro' = that lesson folder. Never guess or construct this path manually.",
  module: "The title of the parent module (last segment of parentFolder, e.g. 'Module 1 - Intro'). Extract from the parentFolder path after calling listProjectFiles.",
};

export function createSpecializedToolRegistry(
  plugin: ProjectFlowPlugin,
  projectTypeId: string | undefined,
  exactProjectRef: { tag?: string; id?: string; fullName?: string },
  projectRecord?: ProjectRecord,
): ToolDefinition[] {
  const api = plugin.getApi();
  if (!api) return [];
  const { mergeEntityTypes } = require("../../core/registry-merge");

  const entityTypes = mergeEntityTypes(plugin.settings.entityTypes, projectTypeId);
  const tools: ToolDefinition[] = [];

  for (const [entityTypeId, rawDef] of Object.entries(entityTypes)) {
    if (!rawDef) continue;
    const entityType = rawDef as EntityType;
    // e.g. "task" -> "createTask"
    // Convert entityTypeId to a valid tool name (^[a-zA-Z0-9_-]+$).
    // Dots in IDs like "meeting.planning" become camelCase: "createMeetingPlanning".
    const pascalId = entityTypeId
      .split(".")
      .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
      .join("");
    const toolName = `create${pascalId}`;
    const propFields: any = {};
    const required: string[] = [];

    // Map entityType requirements to the tool schema with descriptions
    if (entityType.requiredFields) {
      for (const field of entityType.requiredFields) {
        const description = entityType.fieldDescriptions?.[field] ?? FIELD_DESCRIPTIONS[field];
        propFields[field] = {
          type: "string",
          ...(description ? { description } : {}),
        };
        required.push(field);
      }
    }

    tools.push({
      name: toolName,
      description: `Create a new ${entityType.name} (${entityTypeId}). Note: This will automatically be created in the current delegated project.`,
      schema: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            properties: propFields,
            required,
            additionalProperties: true
          }
        },
        required: ["fields"],
        additionalProperties: false,
      },
      handler: async (args) => api.createEntity({
        projectRef: exactProjectRef,
        entityTypeId,
        fields: args.fields as Record<string, any>
      })
    });
  }

  // Add listProjectFiles tool so the agent can discover existing modules/lessons
  if (projectRecord) {
    tools.push({
      name: "listProjectFiles",
      description: "List files and folders in the project directory. Use to discover existing modules and lessons before creating nested entities.",
      schema: {
        type: "object",
        properties: {
          subfolder: {
            type: "string",
            description: "Relative subfolder path within the project (e.g., 'Modules'). Empty string or omit for project root.",
          },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const projectPath = projectRecord.variables.PROJECT_PATH;
        const sub = (args.subfolder as string) || "";
        if (sub && !isSafeRelativePath(sub)) {
          return { error: "Unsafe subfolder path." };
        }
        const targetPath = sub ? sanitizePath(`${projectPath}/${sub}`) : projectPath;
        if (!isPathWithinRoot(targetPath, projectPath)) {
          return { error: "Path is outside project." };
        }
        try {
          const listing = await (plugin.app.vault as any).adapter.list(targetPath);
          // Strip the absolute project path prefix so returned paths are
          // relative to the project root — ready to use as parentFolder values.
          const toRelative = (p: string) => {
            const prefix = projectPath.endsWith("/") ? projectPath : projectPath + "/";
            return p.startsWith(prefix) ? p.slice(prefix.length) : p;
          };
          return {
            files: (listing.files || []).map(toRelative),
            folders: (listing.folders || []).map(toRelative),
          };
        } catch {
          return { files: [], folders: [] };
        }
      }
    });
  }

  return tools;
}

export async function loadMcpToolRegistry(plugin: ProjectFlowPlugin): Promise<ToolDefinition[]> {
  const servers = (await plugin.getResolvedAiSettings())?.mcpServers || [];
  if (servers.length === 0) return [];
  const fetched = await fetchMcpTools(servers);
  const tools: ToolDefinition[] = [];
  for (const entry of fetched) {
    tools.push(...toMcpToolDefinitions(entry.server, entry.tools));
  }
  return tools;
}
