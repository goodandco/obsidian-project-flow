---
ID: "${PROJECT_ID}-${taskIndex}"
Index: ${taskIndex}
Type: "Task"
Status: "New"
Project: "[[${PROJECT_FULL_NAME}]]"
StartedAt: ${startedAt}
FinishedAt: ${finishedAt}
tags:
  - type/task
  - ${PROJECT_TAG}
Parent: "[[${PROJECT_NAME} Work]]"
Sprint: "${sprint}"
TaskType: ${taskType}
StoryPoints:
---

## Description
<!-- ai:description -->
<!-- /ai:description -->




---

```dataviewjs

const tasks = dv.pages('#type/task')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link))
  .sort(p => [p.StartedAt, p.file.name], 'asc')
  .map(p => ([
    p.file.link, p.Status, p.StoryPoints, p.StartedAt, p.FinishedAt
  ]));

dv.header(2, 'Subtasks');

dv.table(['File', 'Status', 'Start', 'End', 'SP' ],  tasks);

dv.el('p', '---');

const questions = dv.pages('#faq')
  .where(b => dv.func.contains(b.Parent, dv.current().file.link))
  .sort(k => k.file.name, 'asc')
  .map(p => ([ p.file.link, p.Status ]));

dv.header(2, 'Questions');
dv.table(['File', 'Status'],  questions);
```


---

## Notes
<!-- ai:notes -->
<!-- /ai:notes -->

