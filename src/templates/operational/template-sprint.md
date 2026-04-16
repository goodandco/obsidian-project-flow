---
Type: "Sprint"
Title: "${title}"
Parent: "[[$_PROJECT_NAME Work]]"
Status: Plan
Project: "[[$_PROJECT_FULL_NAME]]"
StartedAt: "${startedAt}"
FinishedAt: "${finishedAt}"
tags:
  - type/sprint
  - sprint
  - $_PROJECT_TAG
---

```dataview

TABLE TaskType as Type, StoryPoints as SP, StartedAt as Started, FinishedAt as Finished FROM #$_PROJECT_TAG AND #type/task WHERE contains(Sprint, this.file.link)
```
