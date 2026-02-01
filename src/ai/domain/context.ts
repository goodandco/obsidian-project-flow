import type { ProjectFlowPlugin } from "../../plugin";
import type { ProjectIndexEntry } from "../../interfaces";

export function inferActiveProject(plugin: ProjectFlowPlugin): ProjectIndexEntry | null {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) return null;
  const index = plugin.settings.projectIndex;
  if (!index) return null;
  const path = activeFile.path;
  const entries = Object.values(index.byFullName || {});
  let best: ProjectIndexEntry | null = null;
  for (const entry of entries) {
    if (!entry.path) continue;
    if (path.startsWith(entry.path)) {
      if (!best || entry.path.length > best.path.length) {
        best = entry;
      }
    }
  }
  return best;
}

export function findProjectMatches(
  plugin: ProjectFlowPlugin,
  query: string,
  limit = 5,
): ProjectIndexEntry[] {
  const index = plugin.settings.projectIndex;
  if (!index) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const entries = Object.values(index.byFullName || {});
  const scored = entries
    .map((entry) => {
      const tag = entry.projectTag?.toLowerCase() || "";
      const name = entry.projectName?.toLowerCase() || "";
      let score = 0;
      if (tag === q) score += 100;
      if (name === q) score += 90;
      if (tag.startsWith(q)) score += 60;
      if (name.startsWith(q)) score += 50;
      if (tag.includes(q)) score += 30;
      if (name.includes(q)) score += 20;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.entry);
}
