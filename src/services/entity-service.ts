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
import { patchMarkerInFile } from "../core/markdown-patcher";

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

  const entityTypes = mergeEntityTypes(plugin.settings.entityTypes, resolved.record.info.projectTypeId);
  const entityType = entityTypes[req.entityTypeId];
  if (!entityType) {
    throw new Error(`Entity type not found: ${req.entityTypeId}`);
  }

  const normalizedFields = normalizeFieldAliases(req.fields);
  validateRequiredFields(entityType, normalizedFields);

  const nextIndex = entityType.indexField
    ? await computeNextIndex(plugin, entityType, resolved.record.variables.PROJECT_PATH)
    : null;

  const variables = {
    ...(resolved.record.variables as any),
    ...resolveFieldDefaults(entityType, normalizedFields),
    ...(normalizedFields || {}),
    ...(nextIndex !== null && entityType.indexField ? { [entityType.indexField]: String(nextIndex) } : {}),
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
  // Strip any unresolved ${tokens} so optional frontmatter fields render as empty
  const processed = processTemplate(templateContent, variables).replace(/\$\{[^}]+\}/g, "");

  let relativeTarget = processTemplate(entityType.targetFolder, variables);
  // Normalize: strip leading slashes (from empty ${parentFolder}) and collapse double slashes
  relativeTarget = relativeTarget.replace(/^\/+/, '').replace(/\/\/+/g, '/');
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

  // Create child folders if defined on entity type (e.g., module creates Lessons/, Notes/, etc.)
  if (entityType.childFolders?.length) {
    for (const child of entityType.childFolders) {
      if (!isSafeRelativePath(child)) continue;
      const childPath = sanitizePath(`${folderPath}/${child}`);
      if (isPathWithinRoot(childPath, projectPath)) {
        await fm.ensureFolder(childPath);
      }
    }
  }

  await patchFieldsIntoMarkers(plugin, filePath, normalizedFields);

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

async function patchFieldsIntoMarkers(
  plugin: IProjectFlowPlugin,
  filePath: string,
  fields?: Record<string, any>,
): Promise<void> {
  if (!fields) return;
  const entries = Object.entries(fields)
    .filter(([key, value]) => key.toLowerCase() === key)
    .filter(([key, value]) => key !== "title" && value != null && String(value).trim().length > 0);

  for (const [key, value] of entries) {
    const marker = `ai:${key}`;
    const content = String(value);
    const res = await patchMarkerInFile(plugin.app, {
      path: filePath,
      marker,
      content,
      patchMode: "strict",
    });
    if (!res.ok) {
      // Ignore missing markers for fields not supported by the template
      continue;
    }
  }
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

  const templateBasename = templateName.includes("/")
    ? templateName.slice(templateName.lastIndexOf("/") + 1)
    : templateName;

  const tryScopes = (scopes: TemplateScope[]) => scopes.map((scope) => {
    if (scope === "project") return { scope, path: sanitizePath(`${projectDir}/${templateBasename}`) };
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

async function computeNextIndex(
  plugin: IProjectFlowPlugin,
  entityType: EntityType,
  projectPath: string,
): Promise<number> {
  const { processTemplate } = await import("../core/template-processor");
  const adapter: any = (plugin.app.vault as any).adapter;
  // Resolve the target folder without index variable (it won't appear in folder path normally)
  const relativeTarget = processTemplate(entityType.targetFolder, {});
  const folderPath = sanitizePath(relativeTarget ? `${projectPath}/${relativeTarget}` : projectPath);
  try {
    const listing = await adapter.list(folderPath);
    const files: string[] = listing?.files ?? [];
    return files.length + 1;
  } catch {
    return 1;
  }
}

/**
 * Resolve fieldDefaults for an entity type into concrete values.
 * Computed expressions:
 *   "today"     → yyyy-mm-dd of the current date
 *   "today+Nd"  → yyyy-mm-dd of today + N days
 */
function resolveFieldDefaults(entityType: EntityType, providedFields?: Record<string, any> | undefined): Record<string, string> {
  if (!entityType.fieldDefaults) return {};
  const now = new Date();
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };
  const parseDate = (s: string): Date | null => {
    // Accepts yyyy-mm-dd
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  };
  const addDays = (base: Date, n: number): Date => {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  };

  // First pass: resolve all "today"-based defaults, skipping user-provided fields.
  const result: Record<string, string> = {};
  for (const [field, expr] of Object.entries(entityType.fieldDefaults)) {
    const userVal = providedFields?.[field] ?? providedFields?.[field.toLowerCase()] ?? providedFields?.[field.toUpperCase()];
    if (userVal != null) continue; // user provided — skip default
    if (expr === "today") {
      result[field] = fmt(now);
    } else {
      const todayPlus = expr.match(/^today\+(\d+)d$/);
      if (todayPlus) {
        result[field] = fmt(addDays(now, parseInt(todayPlus[1], 10)));
      } else {
        result[field] = expr;
      }
    }
  }

  // Second pass: for any "today+Nd" default that was computed, rebase it onto a
  // sibling field if that sibling was explicitly provided by the user.
  // e.g. finishedAt = "today+14d" → rebase onto user-provided startedAt if available.
  for (const [field, expr] of Object.entries(entityType.fieldDefaults)) {
    const todayPlus = expr.match(/^today\+(\d+)d$/);
    if (!todayPlus) continue;
    if (result[field] == null) continue; // field was user-provided, nothing to rebase

    // Find if there is another date-defaulted field whose user-supplied value
    // can serve as the base. Look for sibling fields whose default is "today".
    for (const [sibling, siblingExpr] of Object.entries(entityType.fieldDefaults)) {
      if (sibling === field) continue;
      if (siblingExpr !== "today") continue;
      const siblingUserVal = providedFields?.[sibling] ?? providedFields?.[sibling.toLowerCase()] ?? providedFields?.[sibling.toUpperCase()];
      if (siblingUserVal == null) continue;
      const base = parseDate(String(siblingUserVal));
      if (!base) continue;
      result[field] = fmt(addDays(base, parseInt(todayPlus[1], 10)));
      break;
    }
  }

  return result;
}
