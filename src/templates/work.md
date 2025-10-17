---
Type: "Section"
Project: "[[$_PROJECT_FULL_NAME]]"
Date: "$_DATE"
tags:
  - section
  - work
  - $_PROJECT_TAG
---

## Sprints

```dataviewjs
const getList = (pages, sort="desc") => pages  
  .where(b => dv.func.contains(b.Project, dv.current().Project) && 
  //dv.func.contains(b.Parent, dv.current().file.link) &&
  !dv.func.contains(b.file.name, "Template"))  
  .sort(p => p.StartedAt, sort);  
const f = (d) => moment(new Date(d))  
  .format("YYYY-MM-DD");
  
const sprints = getList(
  dv.pages("#sprint and #$_PROJECT_TAG"),
  "desc"
);  
const tasks = getList(
  dv.pages("#task and #$_PROJECT_TAG"),
  "desc"
);  

let allStoryPoints = 0;
let allStories = 0;
let allBugs = 0;
const sprintsCount = sprints.length;

for (const s of sprints) {  
  const activeSuffix = dv.func.contains(s.Status, "Active")  
    ? " - **Active** - "  
    : "";  
  let sp = 0;
    
  dv.header(3, `${s.file.link}${activeSuffix} (${f(s.StartedAt)} - ${f(s.FinishedAt)})`);  
  
  const filtered = tasks  
    .filter((t) => dv.func.contains(t.Sprint, s.file.link))
    .sort((t) => [t.StartedAt, t.file.name], 'desc')  
    .map(t =>  {
      if (!isNaN(Number(t.StoryPoints))) {
        sp += Number(t.StoryPoints);
        allStories += 1;
      } else {
        allBugs += 1;
      }
      
      return [t.file.link, t.Status, t.TaskType, t.StoryPoints, t.StartedAt, t.FinishedAt];
    });  
  allStoryPoints += sp;
  dv.table(["File", "Status", "Type", `SP (${sp})`, "Start", "End"], filtered);  
  dv.el("p", "---");  
}

dv.el("p", `Sprints: ${sprints.length}. Stories: ${allStories}. Story points: ${allStoryPoints}. Avg SP per sprint: ${sprintsCount > 0 ? Math.round(allStoryPoints / sprintsCount, 2) : 0}. Bugs: ${allBugs}`)
```

---

## Proposals / Ideas

```dataview

TABLE Status, Date FROM #ideas AND #$_PROJECT_TAG WHERE !contains(file.name, "Template") SORT Status DESC

```


## Journal
