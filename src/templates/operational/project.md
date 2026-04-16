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
<!-- ai:main-info -->
<!-- /ai:main-info -->


>[!Links]+
> - some link


```dataview

TABLE Date
FROM #type/section AND #$_PROJECT_TAG
WHERE contains(Parent, this.file.link)
SORT Date ASC

```

---

## Journal
<!-- ai:journal -->
<!-- /ai:journal -->



---


