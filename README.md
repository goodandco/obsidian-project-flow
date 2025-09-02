# Automator (Obsidian Plugin)

Automator helps you quickly create a well-structured project workspace inside your Obsidian vault. It asks for a few details (project name, tag, parent, dimension, and category), then generates a folder tree, main project notes, and a set of reusable templates. You can fully customize dimensions and categories in the plugin settings.


## Features
- Create a complete project structure in seconds
- Guided prompts for project name, tag, parent, dimension, and category
- Configurable Dimensions and Categories in Settings
  - Add, rename, and delete dimensions and categories
  - Nice, tidy settings UI aligned with Obsidian style
  - Reset to defaults button with confirmation dialog
- Automatic variable substitution in generated notes and templates
- Project-specific template folder with common meeting/sprint/task templates


## Installation
This plugin is intended to live inside your Obsidian vault under:

- <vault>/.obsidian/plugins/automator

Steps:
1. Copy or clone this repository into the folder above (folder name must be `automator`).
2. Build the plugin (see Development below) so `main.js`, `manifest.json`, and `styles.css` are present in the plugin folder.
3. In Obsidian, go to Settings → Community plugins → Enable community plugins → then enable “Automator”.


## Usage
Run the command:
- Command palette → “Add Project Info”

Automator will ask:
1. Project name → stored as $_PROJECT_NAME
2. Project tag → stored as $_PROJECT_TAG
3. Parent name → stored as $_PROJECT_PARENT
4. Dimension → choose from your configured list
5. Category → choose from the selected dimension

After collecting these inputs, Automator creates the project structure and files and fills template variables accordingly.


## What gets created
By default, projects are created under `1. Projects/<Dimension>/<Category>/<$_PROJECT_FULL_NAME>`.

Within that folder, Automator creates:
- Knowledge Base/
- Meetings/
- Work/
- People/
- <$_PROJECT_FULL_NAME>.md (Project)
- <$_PROJECT_NAME> Meetings.md
- <$_PROJECT_NAME> People.md
- <$_PROJECT_NAME> Work.md

Template sources are located in the plugin at `.obsidian/plugins/automator/src/templates/` and include base files like `project.md`, `meetings.md`, `people.md`, `work.md`.


## Variables available in templates
Collected from user:
- $_PROJECT_NAME
- $_PROJECT_TAG
- $_PROJECT_PARENT
- $_PARENT_TAG (currently same as $_PROJECT_TAG)

Generated automatically:
- $_YEAR (current year)
- $_DATE (YYYY-MM-DD)
- $_PROJECT_FULL_NAME = `<$_YEAR>.<$_PROJECT_PARENT>.<$_PROJECT_NAME>`
- $_PROJECT_RELATIVE_PATH = `1. Projects/<$_DIMENSION>/<$_CATEGORY>/<$_PROJECT_FULL_NAME>`
- $_PROJECT_PATH = same as relative path inside your vault
- $_DIMENSION
- $_CATEGORY

Automator replaces any `$_VARIABLE` tokens it finds in the template files before creating notes.


## Project templates per project
Automator also creates a project-specific template folder:
- `Templates/<$_PROJECT_NAME>_Templates`

It populates it with these files (names vary by project):
- <$_PROJECT_NAME>_Meeting_Daily_Template.md → from template-meeting-daily.md
- <$_PROJECT_NAME>_Meeting_Discusion_Template.md → from template-meeting-discussion.md
- <$_PROJECT_NAME>_Meeting_Knowledge_Template.md → from template-meeting-knowledge.md
- <$_PROJECT_NAME>_Meeting_Planning_Template.md → from template-meeting-planning.md
- <$_PROJECT_NAME>_Meeting_Refinement_Template.md → from template-meeting-refinement.md
- <$_PROJECT_NAME>_Meeting_Retro_Template.md → from template-meeting-retro.md
- <$_PROJECT_NAME>_Meeting_Demo_Template.md → from template-meeting-demo.md
- <$_PROJECT_NAME>_Sprint_Template.md → from template-sprint.md
- <$_PROJECT_NAME>_Task_Template.md → from template-task.md
- <$_PROJECT_NAME>_idea_Template.md → from template-idea.md

Each of those uses the same variable substitution described above.


## Settings
Open Settings → Community plugins → Automator.

You can manage your Dimensions and Categories:
- Add a new dimension (inline input + Add button)
- Add categories per dimension
- Rename any dimension or category (pencil icon → inline edit). While editing, you’ll see Apply (check) and Discard (x) instead of delete/edit.
- Delete dimensions or categories (trash icon)
- Reset to defaults using the rotate arrow icon at the top; a confirmation dialog will ask:
  - “Do you want skip settings to defaults? This will override all custom settings.”
  - Buttons: “Yes, use defaults” or “Go back”

Styling is provided by styles.css located in the plugin root; Obsidian automatically loads it.


## Development
Prerequisites: Node.js and npm.

Scripts:
- npm run dev → run the esbuild bundler in dev mode
- npm run build → type-check (tsc) and build production bundle via esbuild

Files of interest:
- main.ts → exports AutomatorPlugin
- src/plugin.ts → main plugin logic, commands, settings UI, project generation
- styles.css → settings UI look and feel
- src/templates/ → template source files used during project creation

To try in Obsidian:
1. Build the project (npm run build).
2. Ensure `main.js`, `manifest.json`, and `styles.css` are present under `<vault>/.obsidian/plugins/automator/`.
3. Toggle the plugin off/on or use View → Force reload.


## Troubleshooting
- Templates not found: The plugin reads from `.obsidian/plugins/automator/src/templates/`. Ensure those files exist in your vault folder where the plugin resides.
- Styles not applied: Verify `styles.css` is in the plugin root and that the settings tab has `.automator-settings` elements (added by the plugin).
- No categories for a dimension: Add categories in settings first; the project creation flow requires choosing a category.


## License
ISC
