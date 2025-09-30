export type ValidationResult = { ok: true } | { ok: false; reason: string };

const TAG_REGEX = /^[A-Za-z0-9][A-Za-z0-9_/-]{1,62}$/; // 2-63 chars, start alnum; allows -, _, / after first char

export function validateProjectName(name: string): ValidationResult {
  if (!name || !name.trim()) return { ok: false, reason: 'Project name is required' };
  const cleaned = name.trim();
  if (cleaned.length > 120) return { ok: false, reason: 'Project name too long (max 120)' };
  // Forbid path separators and control characters
  for (const ch of cleaned) {
    const code = ch.charCodeAt(0);
    if (code < 32 || ch === '/' || ch === '\\') {
      return { ok: false, reason: 'Project name contains invalid characters' };
    }
  }
  return { ok: true };
}

export function validateTag(tag: string): ValidationResult {
  if (!tag || !tag.trim()) return { ok: false, reason: 'Tag is required' };
  const t = tag.trim();
  if (!TAG_REGEX.test(t)) return { ok: false, reason: 'Tag must be 2-63 chars, start with letter/digit; may include -, _, /' };
  return { ok: true };
}

export function ensureValidOrThrow(fn: () => ValidationResult, context: string): void {
  const res = fn();
  if (!res.ok) throw new Error(`${context}: ${res.reason}`);
}
