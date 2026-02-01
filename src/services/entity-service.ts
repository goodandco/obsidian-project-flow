import type {
  EntityType,
  IProjectFlowPlugin,
  ProjectFlowSettings,
  ProjectRecord,
  TemplateScope,
} from "../interfaces";
import type { CreateEntityRequest, CreateEntityResult } from "../api/types";
import { sanitizeFileName, sanitizePath } from "../core/path-sanitizer";
import { isPathWithinRoot, isSafeRelativePath } from "../core/path-constraints";

export async function createEntity(
  plugin: IProjectFlowPlugin,
  req: CreateEntityRequest,
): Promise<CreateEntityResult> {
  const { resolveProject } = await import("./resolve-service");
  const { mergeEntityTypes } = await import("../core/registry-merge");
  const { processTemplate } = await import("../core/template-processor");
  const { SafeFileManager } = await import("./file-manager");

  const resolved = resolveProject(plugin, req.projectRef);
  if (!resolved) {
    throw new Error("Project not found for reference.");
  }

  const entityTypes = mergeEntityTypes(plugin.settings.entityTypes);
  const entityType = entityTypes[req.entityTypeId];
  if (!entityType) {
    throw new Error(`Entity type not found: ${req.entityTypeId}`);
  }

  const normalizedFields = normalizeFieldAliases(req.fields);
  validateRequiredFields(entityType, normalizedFields);

  const variables = {
    ...(resolved.record.variables as any),
    ...(normalizedFields || {}),
  };

  const resolvedTemplate = await resolveTemplatePath(
    plugin,
    entityType,
    resolved.record,
    variables,
  );
  if (!resolvedTemplate) {
    throw new Error(`Template not found for entity type: ${entityType.id}`);
  }

  const adapter: any = (plugin.app.vault as any).adapter;
  const templateContent = await adapter.read(resolvedTemplate.path);
  const processed = processTemplate(templateContent, variables);

  const relativeTarget = processTemplate(entityType.targetFolder, variables);
  if (!isSafeRelativePath(relativeTarget)) {
    throw new Error("Unsafe targetFolder path.");
  }

  const projectPath = sanitizePath(resolved.record.variables.PROJECT_PATH);
  const folderPath = relativeTarget
    ? sanitizePath(`${projectPath}/${relativeTarget}`)
    : projectPath;

  if (!isPathWithinRoot(folderPath, projectPath)) {
    throw new Error("Target folder is outside project path.");
  }
  if (!isAllowedWritePath(folderPath, plugin.settings)) {
    throw new Error("Target folder is outside allowed roots.");
  }

  const filenameTemplate = entityType.filenameRule || "Untitled";
  const resolvedName = processTemplate(filenameTemplate, variables);
  const normalizedName = resolvedName.endsWith(".md")
    ? resolvedName.slice(0, -3)
    : resolvedName;
  const fileName = sanitizeFileName(normalizedName);
  const filePath = sanitizePath(`${folderPath}/${fileName}.md`);

  if (!isPathWithinRoot(filePath, projectPath)) {
    throw new Error("Target file is outside project path.");
  }
  if (!isAllowedWritePath(filePath, plugin.settings)) {
    throw new Error("Target file is outside allowed roots.");
  }

  const fm = new SafeFileManager(plugin.app);
  await fm.ensureFolder(folderPath);
  if (await fm.has(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  await fm.createIfAbsent(filePath, processed);

  return { path: filePath };
}

export function isAllowedWritePath(path: string, settings: ProjectFlowSettings): boolean {
  const projectsRoot = settings.projectsRoot || "1. Projects";
  const archiveRoot = settings.archiveRoot || "4. Archive";
  return (
    isPathWithinRoot(path, projectsRoot) ||
    isPathWithinRoot(path, archiveRoot)
  );
}

function validateRequiredFields(entityType: EntityType, fields?: Record<string, any>): void {
  if (!entityType.requiredFields || entityType.requiredFields.length === 0) return;
  const missing = entityType.requiredFields.filter(
    (k) => fields == null || fields[k] == null || String(fields[k]).trim() === "",
  );
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

function normalizeFieldAliases(fields?: Record<string, any>): Record<string, any> | undefined {
  if (!fields) return fields;
  const out: Record<string, any> = { ...fields };
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    const upper = key.toUpperCase();
    const lower = key.toLowerCase();
    if (!(upper in out)) out[upper] = value;
    if (!(lower in out)) out[lower] = value;
  }
  return out;
}

async function resolveTemplatePath(
  plugin: IProjectFlowPlugin,
  entityType: EntityType,
  record: ProjectRecord,
  variables: Record<string, any>,
): Promise<{ path: string; scope: TemplateScope } | null> {
  const { processTemplate } = await import("../core/template-processor");
  const adapter: any = (plugin.app.vault as any).adapter;
  const templateName = processTemplate(entityType.templatePath, variables);

  const projectDir = sanitizePath(`Templates/${record.info.name}_Templates`);
  const vaultDir = sanitizePath(plugin.settings.templatesRoot || "Templates/ProjectFlow");
  const builtinDir = `.obsidian/plugins/${plugin.manifest.id}/src/templates`;

  const tryScopes = (scopes: TemplateScope[]) => scopes.map((scope) => {
    if (scope === "project") return { scope, path: sanitizePath(`${projectDir}/${templateName}`) };
    if (scope === "vault") return { scope, path: sanitizePath(`${vaultDir}/${templateName}`) };
    return { scope, path: `${builtinDir}/${templateName}` };
  });

  const preferredScopes: TemplateScope[] = entityType.templateScope
    ? ([entityType.templateScope, "builtin"] as TemplateScope[]).filter(
        (v, i, arr) => arr.indexOf(v) === i,
      )
    : (["project", "vault", "builtin"] as TemplateScope[]);

  for (const candidate of tryScopes(preferredScopes)) {
    if (await adapter.exists(candidate.path)) {
      return candidate;
    }
  }
  return null;
}
