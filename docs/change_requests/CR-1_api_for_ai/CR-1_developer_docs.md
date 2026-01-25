# CR-1 Developer Docs (Core API)

## Overview
ProjectFlow exposes a versioned, UI-free core API for plugin-to-plugin automation via:
- `window.PluginApi["@projectflow/core"]` (primary)
- `app.plugins.getPlugin("project-flow")?.getApi?.()` (fallback)

The API is stable and versioned and should not trigger UI side effects.

## Getting the API
```js
const api =
  window.PluginApi?.["@projectflow/core"] ||
  app.plugins.getPlugin("project-flow")?.getApi?.();
```

## Compatibility
Use `api.compatibility` to check schema/index versions:
```js
api.compatibility
// { settingsSchemaVersion, projectIndexVersion, projectGraphVersion }
```

## Key Methods
```ts
api.resolveProject(ref)
api.listProjects()
api.listProjectTypes()
api.describeProjectType(id)
api.listEntityTypes()
api.describeEntityType(id)
api.createProject(req)
api.createEntity(req)
api.patchMarker(req)
api.patchSection(req)
api.getChildren(ref, archived?)
api.getParents(ref, archived?)
api.clearArchivedProjectGraph()
```

## Project Reference
You can reference projects by full name, id, or tag:
```js
"2025.Mobiquity.KLM-API"
{ id: "KLM-API" }
{ tag: "project/klm-api" }
```

## createProject Example
```js
const [ok, msg] = await api.createProject({
  name: "KLM-API",
  tag: "project/klm-api",
  id: "KLM-API",
  parent: "2025.Mobiquity",
  dimension: "Business",
  category: "R&D",
  projectTypeId: "operational"
});
```

## createEntity Example
```js
const result = await api.createEntity({
  projectRef: { id: "KLM-API" },
  entityTypeId: "task",
  fields: {
    TITLE: "Implement indexing",
    DATE: "2025-03-01"
  }
});
```

## Template Resolution
Entity templates resolve in this order:
1) `Templates/<PROJECT_NAME>_Templates/`
2) `Templates/ProjectFlow/` (vault-level override)
3) Built-in templates in the plugin

## Error Handling
Input validation errors are thrown as exceptions. You can standardize errors with:
```js
try {
  await api.createEntity(...);
} catch (err) {
  const info = api.wrapError(err);
  console.log(info);
}
```

## Patching
- Markers follow `<!-- AI:NAME -->`.
- `patchMode: "lenient"` falls back to heading or append.
- `patchMode: "strict"` returns an error if not found.

