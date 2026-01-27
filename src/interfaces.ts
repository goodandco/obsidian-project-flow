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
  entityTypes?: EntityTypesRegistry;
  projectTypes?: ProjectTypesRegistry;
  ai?: AISettings;
  // Nested map: dimension -> category -> projectId -> ProjectRecord
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>;
  archivedRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>; // archived projects map
}

export type AIProvider = "openai" | "anthropic" | "ollama";

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  strictExecution?: boolean;
  memoryLimit?: number;
  mcpServers?: MCPServerConfig[];
  toolLog?: AIToolLogEntry[];
  conversation?: Array<Pick<ChatMessage, "role" | "content" | "name" | "toolCallId">>;
  pendingPlan?: PendingPlan | null;
}

export interface MCPServerConfig {
  name: string;
  url: string;
  apiKey?: string;
}

export interface AIToolLogEntry {
  ts: string;
  toolName: string;
  ok: boolean;
  error?: string;
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

export interface EntityType {
  id: string;
  name?: string;
  templatePath: string;
  templateScope?: TemplateScope;
  targetFolder: string;
  filenameRule: string;
  requiredFields?: string[];
  defaultTags?: string[];
  patchMarkers?: string[];
}

export type EntityTypesRegistry = Record<string, EntityType>;

export interface ProjectType {
  id: string;
  name: string;
  description?: string;
  folderStructure?: string[];
  initialNotes?: Array<{ fileName: string; template: string }>;
  allowedEntityTypes?: string[];
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
