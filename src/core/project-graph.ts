import type { ProjectGraph, ProjectGraphNode, ProjectRecord } from "../interfaces";

export const PROJECT_GRAPH_VERSION = 1;

let cachedGraph: ProjectGraph | null = null;

export function getProjectGraphCache(): ProjectGraph | null {
  return cachedGraph;
}

export function setProjectGraphCache(graph: ProjectGraph): void {
  cachedGraph = graph;
}

export function buildProjectGraph(
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
  archivedRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
): ProjectGraph {
  const byFullName: Record<string, ProjectGraphNode> = {};
  const archivedByFullName: Record<string, ProjectGraphNode> = {};

  if (projectRecords) {
    buildGraphFromRecords(projectRecords, byFullName);
  }
  if (archivedRecords) {
    buildGraphFromRecords(archivedRecords, archivedByFullName);
  }

  return {
    version: PROJECT_GRAPH_VERSION,
    byFullName,
    archivedByFullName,
  };
}

export function ensureProjectGraph(
  current: ProjectGraph | undefined,
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
  archivedRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
): { graph: ProjectGraph; updated: boolean } {
  if (!current || current.version !== PROJECT_GRAPH_VERSION) {
    const rebuilt = buildProjectGraph(projectRecords, archivedRecords);
    cachedGraph = rebuilt;
    return { graph: rebuilt, updated: true };
  }
  cachedGraph = current;
  return { graph: current, updated: false };
}

export function addProjectToGraph(
  graph: ProjectGraph,
  record: ProjectRecord,
  archived: boolean,
): ProjectGraph {
  const fullName = record.variables.PROJECT_FULL_NAME;
  const parent = normalizeParent(record.info.parent);
  const target = archived ? graph.archivedByFullName : graph.byFullName;
  target[fullName] = target[fullName] || { parent, children: [] };
  target[fullName].parent = parent ?? null;

  if (parent) {
    const parentNode = target[parent] || { parent: null, children: [] };
    if (!parentNode.children.includes(fullName)) {
      parentNode.children.push(fullName);
    }
    target[parent] = parentNode;
  }
  return graph;
}

export function removeProjectFromGraph(
  graph: ProjectGraph,
  fullName: string,
  archived: boolean,
): ProjectGraph {
  const target = archived ? graph.archivedByFullName : graph.byFullName;
  const node = target[fullName];
  if (node?.parent && target[node.parent]) {
    target[node.parent].children = target[node.parent].children.filter(
      (child) => child !== fullName,
    );
  }
  delete target[fullName];
  return graph;
}

export function cleanArchivedGraph(
  graph: ProjectGraph,
  archivedRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
): ProjectGraph {
  const rebuilt = buildProjectGraph(undefined, archivedRecords);
  graph.archivedByFullName = rebuilt.archivedByFullName;
  return graph;
}

export function getChildren(
  graph: ProjectGraph,
  fullName: string,
  archived: boolean,
): string[] {
  const target = archived ? graph.archivedByFullName : graph.byFullName;
  return target[fullName]?.children ?? [];
}

export function getParents(
  graph: ProjectGraph,
  fullName: string,
  archived: boolean,
): string[] {
  const target = archived ? graph.archivedByFullName : graph.byFullName;
  const parents: string[] = [];
  let current = target[fullName]?.parent ?? null;
  while (current) {
    parents.push(current);
    current = target[current]?.parent ?? null;
  }
  return parents;
}

function buildGraphFromRecords(
  records: Record<string, Record<string, Record<string, ProjectRecord>>>,
  target: Record<string, ProjectGraphNode>,
) {
  for (const categories of Object.values(records)) {
    for (const projects of Object.values(categories)) {
      for (const record of Object.values(projects)) {
        if (!record || !record.variables) continue;
        const fullName = record.variables.PROJECT_FULL_NAME;
        const parent = normalizeParent(record.info.parent);
        target[fullName] = target[fullName] || { parent, children: [] };
        target[fullName].parent = parent ?? null;
        if (parent) {
          const parentNode = target[parent] || { parent: null, children: [] };
          if (!parentNode.children.includes(fullName)) {
            parentNode.children.push(fullName);
          }
          target[parent] = parentNode;
        }
      }
    }
  }
}

function normalizeParent(parent?: string | null): string | null {
  const trimmed = parent?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
