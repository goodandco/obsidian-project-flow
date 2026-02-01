import type {
  EntityType,
  EntityTypesRegistry,
  ProjectIndexEntry,
  ProjectInfo,
  ProjectRecord,
  ProjectType,
  ProjectTypesRegistry,
} from "../interfaces";
import type { ApiErrorCode } from "./errors";
import type { PatchMarkerRequest, PatchSectionRequest } from "../core/markdown-patcher";

export type ProjectRef = string | { fullName?: string; id?: string; tag?: string };

export type CreateProjectRequest = ProjectInfo;
export type CreateProjectResult = [boolean, string];

export type EntityFieldValue = string | number | boolean | null | undefined;

export interface CreateEntityRequest {
  projectRef: ProjectRef;
  entityTypeId: string;
  fields?: Record<string, EntityFieldValue>;
}

export interface CreateEntityResult {
  path: string;
}

export type PatchResult = { ok: true } | { ok: false; error: string };

export type { PatchMarkerRequest, PatchSectionRequest };

export interface ResolvedProject {
  entry: ProjectIndexEntry;
  record: ProjectRecord;
}

export interface ApiCapabilities {
  resolveProject: boolean;
  listProjects: boolean;
  entityTypes: boolean;
  projectTypes: boolean;
  createProject: boolean;
  createEntity: boolean;
  patching: boolean;
  projectGraph: boolean;
  errorHandling: "throws";
}

export interface ApiCompatibility {
  settingsSchemaVersion: number;
  projectIndexVersion: number;
  projectGraphVersion: number;
}

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiErrorResponse = { ok: false; error: ApiErrorPayload };

export interface ProjectFlowApi {
  version: string;
  capabilities: ApiCapabilities;
  compatibility: ApiCompatibility;
  resolveProject(ref: ProjectRef): ResolvedProject | null;
  listProjects(): ProjectIndexEntry[];
  listProjectTypes(): ProjectTypesRegistry;
  describeProjectType(id: string): ProjectType | null;
  listEntityTypes(): EntityTypesRegistry;
  describeEntityType(id: string): EntityType | null;
  createProject(req: CreateProjectRequest): Promise<CreateProjectResult>;
  createEntity(req: CreateEntityRequest): Promise<CreateEntityResult>;
  patchMarker(req: PatchMarkerRequest): Promise<PatchResult>;
  patchSection(req: PatchSectionRequest): Promise<PatchResult>;
  getChildren(ref: ProjectRef, archived?: boolean): string[];
  getParents(ref: ProjectRef, archived?: boolean): string[];
  clearArchivedProjectGraph(): Promise<{ ok: true }>;
  wrapError(err: unknown): ApiErrorResponse;
}
