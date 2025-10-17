---
Type: "Project"
Parent: "$_PROJECT_PARENT"
Status: "Active"
Category: "$_CATEGORY"
Dimension: "$_DIMENSION"
ProjectID: "$_PROJECT_ID"
ProjectTag: "$_PROJECT_TAG"
Date: "$_DATE"
StartedAt: "$_DATE"
FinishedAt: ""
tags:
  - project
  - dashboard
  - type/project
  - $_PROJECT_TAG
Deadline: ""
---
---

## Main info

>[!Links]+
> - some link


```dataviewjs

const sections = dv.pages('#section and #$_PROJECT_TAG')  
  .sort(p => p.Date, 'asc')
  .map((p) => ([ p.file.link ]));

dv.header(2, 'Sections');
dv.table(['File'],  sections);

```

---

## Journal


---


