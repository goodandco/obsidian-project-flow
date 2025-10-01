# ProjectFlow (Obsidian Plugin)

ProjectFlow helps you quickly create a well-structured project workspace inside your Obsidian vault. It asks for a few details (project name, tag, optional parent, dimension, and category), then generates a folder tree, main project notes, and a set of reusable templates. You can fully customize dimensions, their order, and categories in the plugin settings.


## Features
- Create a complete project structure in seconds
- Guided prompts for project name, tag, optional parent, dimension, and category
- Configurable Dimensions and Categories in Settings
  - Add, rename, delete, and reorder dimensions (arrow buttons)
  - Add, rename, and delete categories per dimension
  - Reset to defaults with a confirmation dialog
- Automatic variable substitution in generated notes and templates (supports `${VAR}` and legacy `$_VAR`)
- Project-specific template folder with common meeting/sprint/task templates
- Desktop-only (per Obsidian manifest); minimum Obsidian version 0.12.0


## Installation
This plugin runs inside your Obsidian vault at:

- <vault>/.obsidian/plugins/project-flow

Manual installation:
1. Copy or clone this repository into the folder above (folder name must be `project-flow`).
2. Build the plugin (see Development) so `main.js`, `manifest.json`, and `styles.css` are present in the plugin folder.
3. In Obsidian, go to Settings → Community plugins → turn on “Community plugins” (safe mode off), then enable “ProjectFlow”.

Using BRAT (optional):
- If this repository is public, you can install via the “Obsidian BRAT” plugin → Add beta plugin → paste this repo’s URL. BRAT will place it under `.obsidian/plugins/project-flow`. Then enable “ProjectFlow”.


## Quick start (Usage)
Run the command from the Command Palette:
- “Add Project Info”

You’ll be asked for:
1. Project name → stored as $_PROJECT_NAME
2. Project tag → stored as $_PROJECT_TAG
3. Project ID (used as task prefix) → stored as $_PROJECT_ID
4. Parent name (optional) → stored as $_PROJECT_PARENT
5. Dimension → select from your configured list
6. Category → select from the chosen dimension

After collecting inputs, ProjectFlow creates the project structure and files, filling template variables accordingly.


## What gets created
By default, projects are created under:
- `1. Projects/<order>. <Dimension>/<Category>/<$_PROJECT_FULL_NAME>`

Notes:
- `<order>. <Dimension>` reflects the custom order you set for each dimension (e.g., `1. Business`).
- You can change the root via the `projectsRoot` setting (default: `"1. Projects"`). Currently this is not exposed in the UI; it’s stored in the plugin’s data JSON.

Within the project folder, ProjectFlow creates:
- Knowledge Base/
- Meetings/
- Work/
  - Tasks/
- People/
- <$_PROJECT_FULL_NAME>.md (Project)
- <$_PROJECT_NAME> Meetings.md
- <$_PROJECT_NAME> People.md
- <$_PROJECT_NAME> Work.md

Template sources are expected INSIDE YOUR VAULT under `.obsidian/plugins/project-flow/src/templates/` and include base files like `project.md`, `meetings.md`, `people.md`, `work.md`. Ensure those files exist in your vault copy of the plugin during development/testing.


## Variables available in templates
Collected from user:
- $_PROJECT_NAME
- $_PROJECT_TAG
- $_PROJECT_PARENT
- $_PARENT_TAG (only set when a parent is provided; otherwise empty)

Generated automatically:
- $_YEAR (current year)
- $_DATE (YYYY-MM-DD)
- $_PROJECT_FULL_NAME = `<$_YEAR><optional .$_PROJECT_PARENT>.<$_PROJECT_NAME>`
- $_PROJECT_RELATIVE_PATH = `1. Projects/<$_DIMENSION>/<$_CATEGORY>/<$_PROJECT_FULL_NAME>`
- $_PROJECT_PATH = same as relative path inside your vault
- $_DIMENSION (dimension display name)
- $_CATEGORY
- $_PROJECT_ID (provided during setup; used to prefix task names as <ID>-N)
- $_PROJECT_DIMENSION (alias of $_DIMENSION for legacy templates)

Token syntaxes supported in templates:
- Legacy: `$_VARIABLE`
- Modern: `${VARIABLE}`


## Project-specific Templates folder
ProjectFlow also creates a project-specific template folder:
- `Templates/<$_PROJECT_NAME>_Templates`

It populates it with files such as:
- <$_PROJECT_NAME>_Meeting_Daily_Template.md → from template-meeting-daily.md
- <$_PROJECT_NAME>_Meeting_Discussion_Template.md → from template-meeting-discussion.md
- <$_PROJECT_NAME>_Meeting_Knowledge_Template.md → from template-meeting-knowledge.md
- <$_PROJECT_NAME>_Meeting_Planning_Template.md → from template-meeting-planning.md
- <$_PROJECT_NAME>_Meeting_Refinement_Template.md → from template-meeting-refinement.md
- <$_PROJECT_NAME>_Meeting_Retro_Template.md → from template-meeting-retro.md
- <$_PROJECT_NAME>_Meeting_Demo_Template.md → from template-meeting-demo.md
- <$_PROJECT_NAME>_Sprint_Template.md → from template-sprint.md
- <$_PROJECT_NAME>_Task_Template.md → from template-task.md
- <$_PROJECT_NAME>_Idea_Template.md → from template-idea.md

Each of those uses the same variable substitution described above.


## Settings
Open: Settings → Community plugins → ProjectFlow

You can:
- Manage Dimensions and Categories (add, rename, delete)
- Reorder dimensions with arrow buttons (affects folder names like `1. Business`)
- Reset to defaults using the rotate-arrow icon with confirmation
- Configure the projects root folder via the hidden setting `projectsRoot` (default: "1. Projects")

Styling comes from styles.css in the plugin root; Obsidian auto-loads it.


## Development
Prerequisites: Node.js 16+ and npm.

Scripts:
- npm run dev → watch-mode build with esbuild (inline sourcemaps)
- npm run build → type-check (tsc, no emit) + production bundle with esbuild
- npm run deploy → prompts for your vault path, builds, and copies main.js, manifest.json, styles.css (and src/templates if present) into <vault>/.obsidian/plugins/project-flow
- npm run test → run unit tests for pure helpers (vitest)
- npm run test:build → run a simple build verification script

Tooling:
- Entry: main.ts; output bundle: main.js (CJS, ES2018)
- Externals: obsidian, electron, CodeMirror, Node builtins
- Banner injected into main.js: "THIS IS A GENERATED/BUNDLED FILE BY ESBUILD"

To try in Obsidian:
1. npm run build
2. Ensure `main.js`, `manifest.json`, and `styles.css` are under `<vault>/.obsidian/plugins/project-flow/`
3. Toggle the plugin off/on or use View → Force reload

Testing (optional):
- Build verification: `npm run test:build` (checks banner and main.js size)
- Unit tests for pure modules (no Obsidian imports): `npm run test`

Compatibility:
- isDesktopOnly: true; minAppVersion: 0.12.0 (see manifest.json)


## Troubleshooting
- “Template file not found”: The plugin reads from `.obsidian/plugins/project-flow/src/templates/` inside your vault. Make sure the templates folder and files exist there.
- “Selected dimension has no categories”: Add categories in Settings for that dimension before running the command.
- Styles not applied: Verify `styles.css` exists in the plugin root.
- Command not found: Ensure the plugin is enabled and you’re on Desktop (this plugin is desktop-only).


## License
ISC
