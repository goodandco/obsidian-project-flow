---
Type: "[[Project]]"
Parent: "$_PROJECT_PARENT"
Status: "[[Active]]"
Category: "$_CATEGORY"
Dimension: "$_DIMENSION"
Date: "$_DATE"
StartedAt: "$_DATE"
FinishedAt: ""
tags:
  - project
  - dashboard
  - $_PROJECT_TAG
Deadline: ""
---
---

## Main info

>[!Links]+
> - some link



```dataviewjs

const sections = dv.pages('#section')  
  .where(b => dv.func.contains(b.Project, dv.current().file.link))  
  .sort(p => p.Date, 'asc')
  .map((p) => ([ p.file.link ]));

dv.header(2, 'Sections');
dv.table(['File'],  sections);

```

### Timeline


---
## Journal


---


