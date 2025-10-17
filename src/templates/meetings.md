---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Date: $_DATE
tags:
  - section
  - meetings
  - $_PROJECT_TAG
---

```dataviewjs

const {  
  Project: CProject,  
  file: {  
    path,  
    link  
  }  
} = dv.current();  

const CAT_LIMIT = 15;
const map = {};

const meetings = dv.pages('#meeting AND #$_PROJECT_TAG')  
  .where(b => b.DateTime && !dv.func.contains(b.file.name, "Template"))
  .sort(p => p['DateTime'], 'desc')
  .slice(0, 50);

dv.header(2, `Meetings (${meetings.length})`);

for (const meeting of meetings) {
  if (!map[meeting.MeetingType]) {
     map[meeting.MeetingType] = [];
  }
  if (map[meeting.MeetingType].length <= CAT_LIMIT) {
    map[meeting.MeetingType].push(meeting);
  }  
}

for (const type in map) {
  const data = map[type].map((p) => ([ p.file.link, p.DateTime ]));
  dv.header(3, `${type} (${data.length})`);
  dv.table(['File', 'Date' ],  data);
  dv.el('p', '---');
}
```
