/**
 * Converts an entity `targetFolder` template string into a regex that matches
 * vault folder paths (relative to project root) of that entity type.
 *
 * Rules:
 *   - `${parentFolder}` → `.+`  (multi-segment wildcard for dynamic parent paths)
 *   - any other `${VAR}` → `[^/]+`  (single path-segment wildcard)
 *   - literal parts are regex-escaped (`.`, `+`, `?`, etc.)
 *   - `/` is NOT escaped (not a special regex char; used as path separator)
 *
 * Examples:
 *   "Modules/${title}"                      → /^Modules\/[^\/]+$/
 *   "${parentFolder}/Lessons/${title}"      → /^.+\/Lessons\/[^\/]+$/
 *   "Work/Sprints"                          → /^Work\/Sprints$/
 */
export function templateToFolderRegex(template: string): RegExp {
  // Split on ${...} tokens; odd indices are tokens, even indices are literals
  const parts = template.split(/(\$\{[^}]+\})/);
  const pattern = parts
    .map((part, i) => {
      if (i % 2 === 1) {
        // Template token
        return part === "${parentFolder}" ? ".+" : "[^/]+";
      }
      // Literal segment — escape regex special chars (but not `/`)
      return part.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp("^" + pattern + "$");
}
