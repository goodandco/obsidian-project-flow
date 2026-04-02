---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Date: $_DATE
tags:
  - type/section
  - knowledge-base
  - $_PROJECT_TAG
---

```dataview

TABLE FROM #$_PROJECT_TAG AND #type/knowledge WHERE !contains(file.name, "Template")
```

