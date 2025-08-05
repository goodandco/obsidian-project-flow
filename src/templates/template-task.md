---
ID: 
Type: "[[Task|Task]]"
Status: New
Project: "[[$_PROJECT_FULL_NAME]]"
Category: "[[$_CATEGORY]]"
Dimension: "[[$_DIMENSION]]"
StartedAt: ""
FinishedAt: ""
tags:
  - task
  - $_PROJECT_TAG
Parent: "[[$_PROJECT_NAME Work]]"
Sprint: 
TaskType: 
StoryPoints: 
---
<% await tp.file.move("$_PROJECT_PATH/Work/Tasks/" + "Task " + tp.file.title) %>

## Description



---

```dataviewjs

const tasks = dv.pages('#task')  
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

