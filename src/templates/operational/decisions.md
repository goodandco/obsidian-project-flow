---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Parent: "[[$_PROJECT_FULL_NAME]]"
Date: $_DATE
tags:
  - type/section
  - decisions
  - $_PROJECT_TAG
---

## Decisions

```dataview

TABLE Date, Status FROM #$_PROJECT_TAG AND #type/decision WHERE !contains(lower(file.name), "template") SORT Date
```

