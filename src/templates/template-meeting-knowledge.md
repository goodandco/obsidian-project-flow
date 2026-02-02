---
Type: "Meeting"
MeetingType: "KnowledgeSharing"
Parent: "[[$_PROJECT_NAME Meetings]]"
DateTime: <% tp.date.now("YYYY-MM-DD") %>T09:30:00
Duration: 30 min
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - type/meeting
  - meeting
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Meetings/Knowledge/" + tp.date.now("YYYY.MM.DD") + " Knowledge Sharing Session") %>

## 🗓️ Agenda  
<!-- ai:agenda -->
<!-- /ai:agenda -->


Why is this meeting being held? Create a task over here   
  
## 📝 Discussion Notes  
<!-- ai:discussion-notes -->
<!-- /ai:discussion-notes -->


Notes from the discussion  
  
## ✔️ Action Items  
<!-- ai:action-items -->
<!-- /ai:action-items -->


- Tasks that needs to be completed.

