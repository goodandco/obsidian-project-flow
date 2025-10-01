import type { ProjectFlowSettings } from '../interfaces';

export const CURRENT_SETTINGS_SCHEMA_VERSION = 2;

export interface VersionedSettings extends ProjectFlowSettings {
  schemaVersion?: number;
}

export function migrateSettings(input: Partial<VersionedSettings> | undefined): VersionedSettings {
  const s: VersionedSettings = {
    dimensions: (input?.dimensions as any) ?? [],
    projectsRoot: input?.projectsRoot ?? '1. Projects',
    schemaVersion: input?.schemaVersion ?? 0,
    projectRecords: {} as any,
  } as any;

  // Normalize projectRecords to nested map
  const pr = (input as any)?.projectRecords;
  if (pr && typeof pr === 'object' && !Array.isArray(pr)) {
    s.projectRecords = pr as any;
  } else if (Array.isArray(pr)) {
    const migrated: Record<string, Record<string, Record<string, any>>> = {};
    for (const rec of pr) {
      if (!rec || !rec.info) continue;
      const d = rec.info.dimension;
      const c = rec.info.category;
      const id = rec.info.id;
      if (!d || !c || !id) continue;
      migrated[d] = migrated[d] || {};
      migrated[d][c] = migrated[d][c] || {};
      migrated[d][c][id] = rec;
    }
    s.projectRecords = migrated as any;
  } else {
    s.projectRecords = {} as any;
  }

  // Migrate dimensions from name-with-order to structured { name, order }
  if (Array.isArray(s.dimensions)) {
    let orderCounter = 1;
    s.dimensions = (s.dimensions as any[]).map((d: any) => {
      if (d && typeof d === 'object') {
        let name = d.name ?? '';
        let order = d.order;
        const m = typeof name === 'string' ? name.match(/^\s*(\d+)\.\s*(.+)$/) : null;
        if (m) {
          order = parseInt(m[1], 10);
          name = m[2];
        }
        if (order == null || Number.isNaN(order)) {
          order = orderCounter++;
        }
        return { name, order, categories: Array.isArray(d.categories) ? d.categories : [] };
      }
      return { name: String(d ?? ''), order: orderCounter++, categories: [] };
    }) as any;
  } else {
    s.dimensions = [] as any;
  }

  // Normalize order to be 1..n unique
  const sorted = [...(s.dimensions as any[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((d, i) => { d.order = i + 1; });
  s.dimensions = sorted as any;

  // future migrations can transform s based on schemaVersion
  if (!s.schemaVersion || s.schemaVersion < CURRENT_SETTINGS_SCHEMA_VERSION) {
    s.schemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION;
  }
  return s;
}
