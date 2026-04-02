---
Type: "Lesson"
Module: "[[${module}]]"
Parent: ""
Status: "New"
Order: ""
Project: "[[$_PROJECT_FULL_NAME]]"
StartedAt: ""
FinishedAt: ""
tags:
  - type/lesson
  - $_PROJECT_TAG
---

## Key Concepts
<!-- ai:content -->
<!-- /ai:content -->


---

## Detailed Notes
<!-- ai:notes -->
<!-- /ai:notes -->


---

```dataviewjs
const assignments = dv.pages('#type/assignment and #$_PROJECT_TAG')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link)
    && !dv.func.contains(b.file.name, "Template"))
  .sort(p => p.Date, 'desc')
  .map(a => ([a.file.link, a.Status, a.DueDate]));

dv.header(2, 'Assignments');
dv.table(['Assignment', 'Status', 'Due'], assignments);

dv.el('p', '---');

const reviews = dv.pages('#type/review and #$_PROJECT_TAG')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link)
    && !dv.func.contains(b.file.name, "Template"))
  .sort(p => p.Date, 'desc')
  .map(r => ([r.file.link, r.Date]));

dv.header(2, 'Reviews');
dv.table(['Review', 'Date'], reviews);
```

---

## Summary & Action Items
<!-- ai:summary -->
<!-- /ai:summary -->
