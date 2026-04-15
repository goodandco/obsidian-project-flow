import { Plugin } from "obsidian";
import type { ChatMessage } from "./ai/types";

export interface Dimension {
  id?: string; // optional stable id for future migrations
  name: string;
  order: number; // explicit ordering for UI and path
  categories: string[];
}

export interface ProjectFlowSettings {
  dimensions: Dimension[];
  projectsRoot?: string; // root folder where projects are created (default: "1. Projects")
  archiveRoot?: string; // root folder where archives are stored (default: "4. Archive")
  templatesRoot?: string; // vault-level templates root (default: "Templates/ProjectFlow")
  schemaVersion?: number; // lightweight settings schema version
  projectIndex?: ProjectIndex;
  projectGraph?: ProjectGraph;
  projectTypes?: ProjectTypesRegistry;
  ai?: AISettings;
  // Nested map: dimension -> category -> projectId -> ProjectRecord
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>;
  archivedRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>; // archived projects map
  pinnedProjects?: string[]; // array of pinned project IDs, max length 5, default []
}

export type AIProvider = "openai" | "anthropic" | "ollama";

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKeySecretName?: string;
  apiKey?: string; // resolved at runtime from SecretStorage/env; never persisted
  model?: string;
  baseUrl?: string;
  strictExecution?: boolean;
  memoryLimit?: number;
  mixedOfferText?: string;
  mcpServers?: MCPServerConfig[];
  conversation?: Array<Pick<ChatMessage, "role" | "content" | "name" | "toolCallId">>;
  pendingPlan?: PendingPlan | null;
}

export interface MCPServerConfig {
  name: string;
  url: string;
  apiKeySecretName?: string;
  apiKey?: string; // resolved at runtime from SecretStorage; never persisted
}


export interface PendingPlan {
  originalInput: string;
  plan?: string;
  context?: string;
  question?: string;
  fields?: Record<string, string>;
  createdAt: string;
  status?: "clarifying" | "awaiting_confirmation";
  clarifications?: string[];
}

export interface ProjectInfo {
  name: string;
  tag: string;
  id: string; // Project ID specified during setup
  parent?: string | null;
  dimension: string;
  category: string;
  projectTypeId?: string;
  year?: string; // optional year override for full name/path
}

export interface ProjectInfoFromPrompt {
  projectId: string;
  dimension: string;
  category: string;
}

export interface ProjectVariables {
  PROJECT_NAME: string;
  PROJECT_TAG: string;
  PROJECT_PARENT: string;
  PARENT_TAG: string;
  YEAR: string;
  DATE: string;
  PROJECT_FULL_NAME: string;
  PROJECT_RELATIVE_PATH: string;
  PROJECT_PATH: string;
  DIMENSION: string;
  CATEGORY: string;
  PROJECT_ID: string;
  PROJECT_DIMENSION?: string; // legacy alias used by some templates
}

export interface ProjectRecord {
  info: ProjectInfo;
  variables: ProjectVariables;
  createdAt: string; // ISO timestamp
}

export type TemplateScope = "project" | "vault" | "builtin";

export interface EntityFieldSchema {
  type: "string" | "number" | "boolean" | "date" | "reference";
  required?: boolean;
  enum?: string[];
  default?: string | number | boolean;
  role?: "title" | "index" | "parentFolder";
  description?: string;
  example?: string;
  refersTo?: {
    kind: "entity" | "project" | "folder";
    entityType?: string;
  };
  resolveHint?: string;
  /**
   * For role: "parentFolder" only.
   * Lists which entity types (by id) or "project" are valid parent targets.
   * Used by the AI agent to filter listProjectFiles results to relevant folders.
   * Examples: ["module", "project"], ["module", "lesson", "project"]
   */
  allowedParents?: string[];
}

export interface EntityType {
  id: string;
  name?: string;
  templatePath: string;
  templateScope?: TemplateScope;
  targetFolder: string;
  filenameRule: string;
  requiredFields?: string[];
  /** Per-field AI descriptions, keyed by field name. Overrides generic FIELD_DESCRIPTIONS in the tool schema. */
  fieldDescriptions?: Record<string, string>;
  /**
   * Default values for fields not supplied by the user.
   * Supports computed expressions:
   *   "today"     → current date as dd/mm/yyyy
   *   "today+Nd"  → current date + N days as dd/mm/yyyy  (e.g. "today+14d")
   * All other strings are used verbatim.
   */
  fieldDefaults?: Record<string, string>;
  defaultTags?: string[];
  patchMarkers?: string[];
  childFolders?: string[];
  /**
   * When set, the service counts existing files in the resolved targetFolder and
   * injects the next sequential number as this variable name (e.g. "taskIndex" → ${taskIndex} = 1, 2, 3…).
   */
  indexField?: string;
  fields?: Record<string, EntityFieldSchema>;
}

export type EntityTypesRegistry = Record<string, EntityType>;

export interface ProjectType {
  id: string;
  name: string;
  description?: string;
  folderStructure?: string[];
  initialNotes?: Array<{ fileName: string; template: string }>;
  projectEntities?: EntityTypesRegistry;
}

export type ProjectTypesRegistry = Record<string, ProjectType>;

export interface ProjectIndexEntry {
  fullName: string;
  projectId: string;
  projectTag: string;
  path: string;
  dimension: string;
  category: string;
  projectName: string;
  parent?: string | null;
}

export interface ProjectIndex {
  version: number;
  byFullName: Record<string, ProjectIndexEntry>;
  byId: Record<string, ProjectIndexEntry>;
  byTag: Record<string, ProjectIndexEntry>;
}

export interface ProjectGraphNode {
  parent?: string | null;
  children: string[];
}

export interface ProjectGraph {
  version: number;
  byFullName: Record<string, ProjectGraphNode>;
  archivedByFullName: Record<string, ProjectGraphNode>;
}

export interface IProjectFlowPlugin extends Plugin {
  settings: ProjectFlowSettings
}
