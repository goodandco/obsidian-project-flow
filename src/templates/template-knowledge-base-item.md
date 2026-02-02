---
Type: "Knowledge"
Parent: "[[$_PROJECT_NAME Knowledge Base]]"
Date: <% tp.date.now("YYYY-MM-DD") %>
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - type/knowledge
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Knowledge Base/" + tp.file.title) %>

## Context  
<!-- ai:context -->
<!-- /ai:context -->


Information about this topic.

---

## Summary
<!-- ai:summary -->
<!-- /ai:summary -->


Summary of the topic.

---

## Related
<!-- ai:related -->
<!-- /ai:related -->


Some links:

- [[something]]
