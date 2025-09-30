// Utilities to sanitize file and folder names for Obsidian vault paths.
// Keep characters safe across platforms; do minimal transformations to avoid surprises.

export function sanitizeFileName(name: string): string {
  const trimmed = (name ?? '').trim();
  // Remove control characters without using control-char regex
  const noControl = Array.from(trimmed).filter(ch => ch.charCodeAt(0) >= 32).join('');
  return noControl
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\.+$/g, '') // remove trailing dots
    .substring(0, 200) // keep reasonably short
    || 'untitled';
}

export function sanitizePath(path: string): string {
  if (!path) return '';
  const parts = path.split('/').filter(Boolean).map(sanitizeFileName);
  // Avoid duplicate slashes and ensure relative path (no leading slash)
  return parts.join('/');
}
