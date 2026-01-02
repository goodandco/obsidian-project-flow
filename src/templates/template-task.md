---
ID: "$_PROJECT_ID-N"
Type: "Task"
Status: "New"
Project: "[[$_PROJECT_FULL_NAME]]"
StartedAt: ""
FinishedAt: ""
tags:
  - type/task
  - $_PROJECT_TAG
Parent: "[[$_PROJECT_NAME Work]]"
Sprint: 
TaskType: 
StoryPoints: 
---
<%*
const projectId = "$_PROJECT_ID".split('/').join('-');
const targetDir = "$_PROJECT_PATH/Work/Tasks";
let next = 1;
try {
  const listing = await app.vault.adapter.list(targetDir);
  const files = (listing && listing.files) ? listing.files : [];
  const nums = files
    .map(f => f.split('/').pop())
    .filter(name => name && name.startsWith(projectId + '-'))
    .map(name => parseInt(name.substring(projectId.length + 1)))
    .filter(n => !isNaN(n));
  next = nums.length ? Math.max(...nums) + 1 : 1;
} catch (e) {
  console.warn('Could not list tasks folder, defaulting to 1', e);
}
const newName = `${projectId}-${next} ${tp.file.title}`;
await tp.file.move(`${targetDir}/${newName}`);
%>

## Description



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

