---
Type: "Sprint"
Parent: "[[$_PROJECT_NAME Work]]"
Status: Plan
Project: "[[$_PROJECT_FULL_NAME]]"
StartedAt: ""
FinishedAt: ""
tags:
  - type/sprint
  - sprint
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Work/Sprints/" + "$_PROJECT_NAME Sprint N") %>


```dataview

TABLE TaskType as Type, StoryPoints as SP, StartedAt as Started, FinishedAt as Finished FROM #$_PROJECT_TAG AND #type/task WHERE contains(Sprint, this.file.link)
```

