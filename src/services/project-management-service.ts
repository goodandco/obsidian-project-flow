import { ProjectRecord, IProjectFlowPlugin } from "../interfaces";

export async function deleteProjectById(
  plugin: IProjectFlowPlugin,
  dimension: string,
  category: string,
  projectId: string,
): Promise<[boolean, string]> {
  let msg = "";
  const projectRecords = plugin.settings.projectRecords as Record<
    string,
    Record<string, Record<string, ProjectRecord>>
  >;
  const projectData = projectRecords[dimension][category][projectId];

  const {SafeFileManager} = await import("./file-manager");
  const fm = new SafeFileManager(plugin.app);
  const {sanitizePath} = await import("../core/path-sanitizer");
  const projectDir = sanitizePath(projectData.variables.PROJECT_PATH);
  const templatesDir = sanitizePath(`Templates/${projectData.info.name}_Templates`);

  try {
    await fm.removeDir(projectDir);
    await fm.removeDir(templatesDir);

    try {
      if (projectRecords[dimension][category][projectId]) {
        delete projectRecords[dimension][category][projectId];
        if (Object.keys(projectRecords[dimension][category]).length === 0)
          delete projectRecords[dimension][category];
        if (Object.keys(projectRecords[dimension]).length === 0) delete projectRecords[dimension];
      }
      try {
        const { ensureProjectIndex, removeFromProjectIndex, toIndexEntry } = await import("../core/project-index");
        const { index } = ensureProjectIndex(plugin.settings.projectIndex, projectRecords);
        plugin.settings.projectIndex = removeFromProjectIndex(
          index,
          toIndexEntry(projectData, projectId, dimension, category),
        );
      } catch (e) {
        console.warn("Failed to update projectIndex after delete:", e);
      }
      await plugin.saveData(plugin.settings);
      msg = "Project deleted successfully.";
    } catch (e) {
      msg = "Failed to update projectRecords after delete";
      console.warn(msg, e);
    }
    return [true, msg];
  } catch (e: any) {
    msg = "Error removing project: " + e.message;
    console.error("Error removing project:", e);
  }

  return [false, msg];
}

export async function archiveProjectByPromptInfo(
  plugin: IProjectFlowPlugin,
  dimension: string,
  category: string,
  projectId: string,
): Promise<[boolean, string]> {
  try {
    const projectRecords = plugin.settings.projectRecords as Record<
      string,
      Record<string, Record<string, ProjectRecord>>
    >;
    const projectRecord = projectRecords?.[dimension]?.[category]?.[projectId];
    if (!projectRecord) {
      return [false, "Project not found."];
    }

    const { sanitizePath } = await import("../core/path-sanitizer");
    const { SafeFileManager } = await import("./file-manager");
    const fm = new SafeFileManager(plugin.app);
    const adapter: any = (plugin.app.vault as any).adapter;

    const srcProjectDir = sanitizePath(projectRecord.variables.PROJECT_PATH);
    const srcTemplatesDir = sanitizePath(`Templates/${projectRecord.info.name}_Templates`);

    const archiveRoot = plugin.settings.archiveRoot || "4. Archive";
    const year = projectRecord.variables.YEAR;
    const dim = projectRecord.variables.DIMENSION || projectRecord.info.dimension;
    const cat = projectRecord.info.category;
    const parent = (projectRecord.info.parent && projectRecord.info.parent.trim().length > 0) ? projectRecord.info.parent.trim() : null;
    const baseName = projectRecord.info.name;
    const newArchivedName = parent ? `${year}.${dim}.${cat}.${parent}.${baseName}` : `${year}.${dim}.${cat}.${baseName}`;
    const destProjectDir = sanitizePath(`${archiveRoot}/${newArchivedName}`);

    const parentOf = (p: string) => {
      const parts = p.split('/').filter(Boolean);
      parts.pop();
      return parts.join('/');
    };
    await fm.ensureFolder(parentOf(destProjectDir));

    if (!(await adapter.exists(srcProjectDir))) {
      return [false, `Project directory not found: ${srcProjectDir}`];
    }
    if (await adapter.exists(destProjectDir)) {
      return [false, `Archive destination already exists: ${destProjectDir}`];
    }

    await adapter.rename(srcProjectDir, destProjectDir);

    try {
      if (await adapter.exists(srcTemplatesDir)) {
        const destTemplatesParent = sanitizePath(`${destProjectDir}/Templates`);
        await fm.ensureFolder(destTemplatesParent);
        const destTemplatesDir = sanitizePath(`${destTemplatesParent}/${projectRecord.info.name}_Templates`);
        if (await adapter.exists(destTemplatesDir)) {
          const altDir = sanitizePath(`${destTemplatesParent}/${projectRecord.info.name}_Templates_archived`);
          await adapter.rename(srcTemplatesDir, altDir);
        } else {
          await adapter.rename(srcTemplatesDir, destTemplatesDir);
        }
      }
    } catch (e) {
      console.warn("Archiving templates failed:", e);
    }

    try {
      const active = plugin.settings.projectRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
      if (!plugin.settings.archivedRecords || Array.isArray(plugin.settings.archivedRecords)) {
        (plugin.settings as any).archivedRecords = (plugin.settings.archivedRecords && Array.isArray(plugin.settings.archivedRecords)) ? {} : (plugin.settings.archivedRecords || {});
      }
      const archived = plugin.settings.archivedRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
      archived[dimension] = archived[dimension] || {};
      archived[dimension][category] = archived[dimension][category] || {};
      archived[dimension][category][projectId] = projectRecord;
      
      if (active?.[dimension]?.[category]?.[projectId]) {
        delete active[dimension][category][projectId];
        if (Object.keys(active[dimension][category]).length === 0) {
          delete active[dimension][category];
        }
        if (Object.keys(active[dimension] || {}).length === 0) {
          delete active[dimension];
        }
      }
      try {
        const { ensureProjectIndex, removeFromProjectIndex, toIndexEntry } = await import("../core/project-index");
        const { index } = ensureProjectIndex(plugin.settings.projectIndex, active);
        plugin.settings.projectIndex = removeFromProjectIndex(
          index,
          toIndexEntry(projectRecord, projectId, dimension, category),
        );
      } catch (e) {
        console.warn("Failed to update projectIndex after archive:", e);
      }
      await plugin.saveData(plugin.settings);
    } catch (e) {
      console.warn("Failed to move project record to archive in settings:", e);
    }

    return [true, "Project archived successfully." ];
  } catch (e: any) {
    console.error("Archive failed:", e);
    return [false, e?.message ?? "Failed to archive project." ];
  }
}

export async function deleteArchivedProject(
  plugin: IProjectFlowPlugin,
  dimension: string,
  category: string,
  projectId: string,
): Promise<[boolean, string]> {
  try {
    const archived = plugin.settings.archivedRecords as Record<string, Record<string, Record<string, ProjectRecord>>>;
    const rec = archived?.[dimension]?.[category]?.[projectId];
    if (!rec) {
      return [false, "Archived project not found."];
    }
    const { sanitizePath } = await import("../core/path-sanitizer");
    const { SafeFileManager } = await import("./file-manager");
    const fm = new SafeFileManager(plugin.app);
    const adapter: any = (plugin.app.vault as any).adapter;

    const archiveRoot = plugin.settings.archiveRoot || "4. Archive";
    const year = rec.variables.YEAR;
    const dim = rec.variables.DIMENSION || rec.info.dimension;
    const cat = rec.info.category;
    const parent = (rec.info.parent && rec.info.parent.trim().length > 0) ? rec.info.parent.trim() : null;
    const baseName = rec.info.name;
    const archivedName = parent ? `${year}.${dim}.${cat}.${parent}.${baseName}` : `${year}.${dim}.${cat}.${baseName}`;
    const archivedDir = sanitizePath(`${archiveRoot}/${archivedName}`);

    if (await adapter.exists(archivedDir)) {
      await fm.removeDir(archivedDir);
    }

    try {
      if (archived?.[dimension]?.[category]?.[projectId]) {
        delete archived[dimension][category][projectId];
        if (Object.keys(archived[dimension][category]).length === 0) {
          delete archived[dimension][category];
        }
        if (Object.keys(archived[dimension] || {}).length === 0) {
          delete archived[dimension];
        }
      }
      await plugin.saveData(plugin.settings);
    } catch (e) {
      console.warn("Failed to update archivedRecords after delete:", e);
    }

    return [true, "Archived project deleted."];
  } catch (e: any) {
    console.error("deleteArchivedProject error:", e);
    return [false, e?.message ?? "Failed to delete archived project."];
  }
}
