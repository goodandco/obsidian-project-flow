---
Type: "[[Board]]"
Parent: "[[$_PROJECT_NAME Work]]"
Status: Plan
Project: "[[$_PROJECT_FULL_NAME]]"
Category: "[[$_CATEGORY]]"
Dimension: "[[$_DIMENSION]]"
StartedAt: ""
FinishedAt: ""
tags:
  - board
  - sprint
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Work/Sprints/" + "$_PROJECT_NAME Sprint N") %>


```dataview

TABLE TaskType as Type, StoryPoints as SP, StartedAt as Started, FinishedAt as Finished FROM #$_PROJECT_TAG AND #task WHERE contains(Sprint, this.file.link)
```

