import type { ProjectFlowPlugin } from "../../plugin";
import type { ToolDefinition } from "../types/tools";
import type { JSONSchema7 } from "../schemas/jsonschema";
import { fetchMcpTools, toMcpToolDefinitions } from "../mcp/client";

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

export function createToolRegistry(plugin: ProjectFlowPlugin): ToolDefinition[] {
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
      name: "listEntityTypes",
      description: "List available entity types.",
      schema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => api.listEntityTypes(),
    },
    {
      name: "createProject",
      description: "Create a project with the required metadata.",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          tag: { type: "string" },
          id: { type: "string" },
          dimension: { type: "string" },
          category: { type: "string" },
          parent: { type: "string" },
          projectTypeId: { type: "string" },
        },
        required: ["name", "tag", "id", "dimension", "category"],
        additionalProperties: false,
      },
      handler: async (args) => api.createProject(args),
    },
    {
      name: "createEntity",
      description: "Create an entity inside a project using a template.",
      schema: {
        type: "object",
        properties: {
          projectRef: projectRefSchema,
          entityTypeId: { type: "string" },
          fields: fieldsSchema,
        },
        required: ["projectRef", "entityTypeId"],
        additionalProperties: false,
      },
      handler: async (args) => api.createEntity(args),
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

export async function loadMcpToolRegistry(plugin: ProjectFlowPlugin): Promise<ToolDefinition[]> {
  const servers = plugin.settings.ai?.mcpServers || [];
  if (servers.length === 0) return [];
  const fetched = await fetchMcpTools(servers);
  const tools: ToolDefinition[] = [];
  for (const entry of fetched) {
    tools.push(...toMcpToolDefinitions(entry.server, entry.tools));
  }
  return tools;
}
