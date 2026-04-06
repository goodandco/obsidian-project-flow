---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Date: "$_DATE"
tags:
  - type/section
  - modules
  - $_PROJECT_TAG
---

## Modules
<!-- ai:modules -->
<!-- /ai:modules -->


```dataviewjs
const modules = dv.pages('#type/module and #$_PROJECT_TAG')
  .where(b => !dv.func.contains(b.file.name.toLowerCase(), "template"))
  .sort(p => p.Order, 'asc');

for (const m of modules) {
  const activeSuffix = dv.func.contains(m.Status, "Active")
    ? " - **Active** - " : "";

  dv.header(3, `${m.file.link}${activeSuffix}`);

  const lessons = dv.pages('#type/lesson and #$_PROJECT_TAG')
    .where(b => dv.func.contains(b.Module, m.file.link)
      && !dv.func.contains(b.file.name.toLowerCase(), "template"))
    .sort(p => p.Order, 'asc')
    .map(l => ([l.file.link, l.Status, l.Order]));

  dv.table(['Lesson', 'Status', 'Order'], lessons);
  dv.el('p', '---');
}
```

---

## Notes
<!-- ai:notes -->
<!-- /ai:notes -->


```dataview
TABLE Status, Date FROM #type/note AND #$_PROJECT_TAG WHERE !contains(lower(file.name), "template") SORT Date DESC
```

---

## Journal
<!-- ai:journal -->
<!-- /ai:journal -->
