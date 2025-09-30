import type { App, Vault } from 'obsidian';

/**
 * Minimal SafeFileManager: non-throwing helpers for common FS ops.
 * - has(path): boolean existence check
 * - ensureFolder(path): create folder if missing (shallow; Obsidian auto-creates parents where possible)
 * - createIfAbsent(path, data): create a file only if it doesn't exist
 */
export class SafeFileManager {
  private vault: Vault;

  constructor(app: App) {
    this.vault = app.vault;
  }

  /**
   * Create multiple files/folders in a best-effort batch.
   * On any failure, attempts to rollback already-created files (not folders).
   */
  async createBatch(ops: Array<{ type: 'folder'; path: string } | { type: 'file'; path: string; data: string }>): Promise<{ ok: true } | { ok: false; error: unknown }> {
    const createdFiles: string[] = [];
    try {
      for (const op of ops) {
        if (op.type === 'folder') {
          await this.ensureFolder(op.path);
        } else {
          const res = await this.createIfAbsent(op.path, op.data);
          if (res === 'created') createdFiles.push(op.path);
        }
      }
      return { ok: true } as const;
    } catch (e) {
      // rollback: try to delete files that we created in this batch
      for (const path of createdFiles.reverse()) {
        try {
          const file = this.vault.getAbstractFileByPath(path);
          if (file && (this.vault as any).delete) {
            await (this.vault as any).delete(file);
          }
        } catch { /* ignore rollback errors */ }
      }
      return { ok: false, error: e } as const;
    }
  }

  async has(path: string): Promise<boolean> {
    try {
      const file = this.vault.getAbstractFileByPath(path);
      if (file) return true;
      if ((this.vault as any).adapter?.exists) {
        return await (this.vault as any).adapter.exists(path);
      }
      return false;
    } catch {
      return false;
    }
  }

  async ensureFolder(path: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (!existing) {
      // Obsidian's createFolder creates parents as needed in recent versions; if not, we can split and ensure each.
      try {
        await this.vault.createFolder(path);
      } catch (e) {
        // Best-effort: attempt recursive ensure if parent missing
        if (e && typeof e === 'object' && (e as any).message?.includes('Parent folder')) {
          const segments = path.split('/').filter(Boolean);
          let cur = '';
          for (const seg of segments) {
            cur = cur ? `${cur}/${seg}` : seg;
            if (!this.vault.getAbstractFileByPath(cur)) {
              try { await this.vault.createFolder(cur); } catch { /* ignore */ }
            }
          }
        }
      }
    }
  }

  async createIfAbsent(path: string, data: string): Promise<'created' | 'skipped'> {
    if (await this.has(path)) {
      return 'skipped';
    }
    try {
      await this.vault.create(path, data);
      return 'created';
    } catch {
      // If create failed, treat as skipped to avoid throwing per minimal safe semantics
      return (await this.has(path)) ? 'skipped' : 'skipped';
    }
  }
}
