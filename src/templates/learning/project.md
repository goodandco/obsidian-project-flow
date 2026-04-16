---
Type: "Project"
Parent: "$_PROJECT_PARENT"
Status: "Active"
Category: "$_CATEGORY"
Dimension: "$_DIMENSION"
ProjectID: "$_PROJECT_ID"
ProjectTag: "$_PROJECT_TAG"
ProjectType: "learning"
Date: "$_DATE"
StartedAt: "$_DATE"
FinishedAt: ""
tags:
  - project
  - dashboard
  - type/project
  - type/course
  - $_PROJECT_TAG
Deadline: ""
---

---

## Course Overview

<!-- ai:main-info -->
<!-- /ai:main-info -->

> [!Links]+
>
> - [Course Link]
> - [Reference Materials]

```dataviewjs
const sections = dv.pages('#type/section and #$_PROJECT_TAG')
  .sort(p => p.Date, 'asc')
  .map((p) => ([ p.file.link ]));

dv.header(2, 'Sections');
dv.table(['File'], sections);
```

---

## Progress

```dataviewjs
const modules = dv.pages('#type/module and #$_PROJECT_TAG')
  .where(b => !dv.func.contains(b.file.name.toLowerCase(), "Template"))
  .sort(p => p.Order, 'asc');

let completed = 0;
const total = modules.length;
for (const m of modules) {
  if (dv.func.contains(m.Status, "Completed")) completed++;
}
const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

dv.el('p', `**Progress: ${completed}/${total} modules completed (${pct}%)**`);

const data = modules.map(m => ([
  m.file.link, m.Status, m.Order, m.StartedAt, m.FinishedAt
]));
dv.table(['Module', 'Status', 'Order', 'Started', 'Finished'], data);
```

---

## Journal

<!-- ai:journal -->
<!-- /ai:journal -->

---
