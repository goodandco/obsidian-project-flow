// Pure template processor with dual token support (${VAR} and legacy $_VAR)
// No Obsidian imports; safe for Node environments

export type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return String(value);
  return String(value);
}

// Replace tokens in a single pass for both syntaxes. Case-sensitive variable keys.
export function processTemplate(template: string, vars: TemplateVars): string {
  if (!template || typeof template !== 'string') return '';
  let result = template;

  // 1) Legacy $_VAR tokens
  for (const [key, raw] of Object.entries(vars)) {
    const value = toStringValue(raw);
    const legacyToken = `$_${key}`;
    if (result.includes(legacyToken)) {
      result = result.split(legacyToken).join(value);
    }
  }

  // 2) Modern ${VAR} tokens (not JS template eval; plain literal replacement)
  for (const [key, raw] of Object.entries(vars)) {
    const value = toStringValue(raw);
    const pattern = new RegExp(`\\$\\{${escapeRegExp(key)}\\}`, 'g');
    result = result.replace(pattern, value);
  }

  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
