---
Type: "[[2. Areas/Abstracts/Types/Meeting|Meeting]]"
MeetingType: Planning
Parent: "[[$_PROJECT_NAME Meetings]]"
DateTime: <% tp.date.now("YYYY-MM-DD") %>T09:30:00
Duration: 30 min
Dimension: "$_PROJECT_DIMENSION"
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - meeting
  - $_PROJECT_TAG
---
<% await tp.file.move("$_PROJECT_PATH/Meetings/Planning/" + tp.date.now("YYYY.MM.DD") + " Sprint Planning") %>

## 🗓️ Agenda  

Why is this meeting being held? Create a task over here   
  
## 📝 Discussion Notes  

Notes from the discussion  
  
## ✔️ Action Items  

- Tasks that needs to be completed.

