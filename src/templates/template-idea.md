---
Type: "Idea"
Status: "New"
Parent: "[[$_PROJECT_NAME Work]]"
Date: <% tp.date.now("YYYY-MM-DD") %>
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - type/idea
  - proposal
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Work/Ideas/" + tp.file.title) %>

Link of proposal: 
Related task: 

# Proposal 
## What
<!-- ai:what -->
<!-- /ai:what -->


what

---

## Why
<!-- ai:why -->
<!-- /ai:why -->



reason


---

## How
<!-- ai:how -->
<!-- /ai:how -->


how to apply
