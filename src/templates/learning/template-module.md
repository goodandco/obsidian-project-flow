---
Type: "Module"
Parent: "[[$_PROJECT_NAME Modules]]"
Status: "New"
Order: ""
Project: "[[$_PROJECT_FULL_NAME]]"
StartedAt: ""
FinishedAt: ""
tags:
  - type/module
  - $_PROJECT_TAG
---

## Learning Objectives
<!-- ai:objectives -->
<!-- /ai:objectives -->


## Content
<!-- ai:content -->
<!-- /ai:content -->


---

```dataviewjs
const lessons = dv.pages('#type/lesson and #$_PROJECT_TAG')
  .where(b => dv.func.contains(b.Module, dv.current().file.link)
    && !dv.func.contains(b.file.name.toLowerCase(), "template"))
  .sort(p => p.Order, 'asc')
  .map(l => ([l.file.link, l.Status, l.Order, l.StartedAt, l.FinishedAt]));

dv.header(2, 'Lessons');
dv.table(['Lesson', 'Status', 'Order', 'Started', 'Finished'], lessons);

dv.el('p', '---');

const assignments = dv.pages('#type/assignment and #$_PROJECT_TAG')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link)
    && !dv.func.contains(b.file.name.toLowerCase(), "template"))
  .sort(p => p.Date, 'desc')
  .map(a => ([a.file.link, a.Status, a.DueDate]));

dv.header(2, 'Assignments');
dv.table(['Assignment', 'Status', 'Due'], assignments);

dv.el('p', '---');

const reviews = dv.pages('#type/review and #$_PROJECT_TAG')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link)
    && !dv.func.contains(b.file.name.toLowerCase(), "template"))
  .sort(p => p.Date, 'desc')
  .map(r => ([r.file.link, r.Date]));

dv.header(2, 'Reviews');
dv.table(['Review', 'Date'], reviews);
```

---

## Summary
<!-- ai:summary -->
<!-- /ai:summary -->
