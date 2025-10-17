---
Type: "Knowledge"
Parent: "[[$_PROJECT_NAME Knowledge Base]]"
Date: <% tp.date.now("YYYY-MM-DD") %>
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - type/knowledge
  - proposal
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Knowledge Base/" + tp.file.title) %>

## Context  

Information about this topic.

---

## Summary

Summary of the topic.

---

## Related

Some links:

- [[something]]
