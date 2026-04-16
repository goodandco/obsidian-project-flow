---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Date: "$_DATE"
tags:
  - type/section
  - knowledge-base
  - $_PROJECT_TAG
---

## Assignments

<!-- ai:assignments -->
<!-- /ai:assignments -->

```dataview
TABLE Status, DueDate FROM #type/assignment AND #$_PROJECT_TAG WHERE !contains(lower(file.name), "template") SORT DueDate ASC
```

---

## Reviews

<!-- ai:reviews -->
<!-- /ai:reviews -->

```dataview
TABLE Date FROM #type/review AND #$_PROJECT_TAG WHERE !contains(lower(file.name), "template") SORT Date DESC
```

---

## Notes

<!-- ai:notes -->
<!-- /ai:notes -->

```dataview
TABLE Date FROM #type/note AND #$_PROJECT_TAG WHERE !contains(lower(file.name), "template") SORT Date DESC
```
