---
Type: "[[Idea|Idea]]"
Status: "[[New|New]]"
Parent: "[[$_PROJECT_NAME Work]]"
Date: <% tp.date.now("YYYY-MM-DD") %>
Dimension: "$_PROJECT_DIMENSION"
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - ideas
  - proposal
  - $_PROJECT_TAG
---
Link of proposal: 
Related task: 

<% await tp.file.move("$_PROJECT_PATH/Work/Ideas/" + tp.file.title) %>

# Proposal 
## What

what

---

## Why


reason


---

## How

how to apply
