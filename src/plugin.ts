import { Plugin } from "obsidian";
import { ProjectFlowSettings, type AIProvider, type AISettings, type MCPServerConfig } from "./interfaces";
import { DEFAULT_SETTINGS, ProjectFlowSettingTab } from "./settings-tab";
import { showAddProjectPrompt } from "./commands/add-project";
import { showRemoveProjectPrompt } from "./commands/remove-project";
import { showArchiveProjectPrompt } from "./commands/archive-project";
import { AI_VIEW_TYPE, ProjectFlowAIChatView } from "./ai";

export class ProjectFlowPlugin extends Plugin {
  settings: ProjectFlowSettings;
  private coreApi: any;

  async onload() {
    console.log("ProjectFlow plugin loaded");
    await this.loadSettings();
    this.addSettingTab(new ProjectFlowSettingTab(this.app, this));
    this.registerView(AI_VIEW_TYPE, (leaf) => new ProjectFlowAIChatView(leaf, this));

    this.addCommand({
      id: "add-project-info",
      name: "Add Project Info",
      callback: () => showAddProjectPrompt(this),
    });

    this.addCommand({
      id: "remove-project-by-id",
      name: "Remove Project",
      callback: () => showRemoveProjectPrompt(this),
    });

    this.addCommand({
      id: "archive-project-by-id",
      name: "Archive Project",
      callback: () => showArchiveProjectPrompt(this),
    });

    await this.exposeCoreApi();
    if (this.settings.ai?.enabled) {
      this.app.workspace.onLayoutReady(() => {
        this.toggleAiView(true);
      });
    }
  }

  async loadSettings() {
    const raw = await this.loadData();
    try {
      const { migrateSettings, CURRENT_SETTINGS_SCHEMA_VERSION } = await import("./core/settings-schema");
      const { DEFAULT_ENTITY_TYPES, DEFAULT_PROJECT_TYPES } = await import("./core/registry-defaults");
      const { ensureProjectIndex } = await import("./core/project-index");
      const { ensureProjectGraph } = await import("./core/project-graph");
      this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(raw));
      let changed = false;

      // Migrate any legacy plaintext keys into SecretStorage and keep only secret names in settings.
      const ai = this.settings.ai;
      if (ai) {
        if (ai.apiKey) {
          const provider = ai.provider || "openai";
          const secretName = ai.apiKeySecretName?.trim() || this.getDefaultProviderSecretName(provider);
          await this.setSecret(secretName, ai.apiKey);
          ai.apiKeySecretName = secretName;
          delete ai.apiKey;
          changed = true;
        }
        if (Array.isArray(ai.mcpServers)) {
          const normalized = await this.normalizeMcpServersWithSecrets(ai.mcpServers);
          if (JSON.stringify(normalized) !== JSON.stringify(ai.mcpServers)) {
            ai.mcpServers = normalized;
            changed = true;
          }
        }
      }

      if (!this.settings.templatesRoot) {
        this.settings.templatesRoot = "Templates/ProjectFlow";
        changed = true;
      }
      if (this.settings.entityTypes && typeof this.settings.entityTypes === "object") {
        const firstVal = Object.values(this.settings.entityTypes)[0];
        // If the first value has a 'templatePath', it's the old flat format
        if (firstVal && (firstVal as any).templatePath) {
          const legacy = this.settings.entityTypes as any;
          this.settings.entityTypes = { operational: legacy };
          changed = true;
        }
      }

      if (!this.settings.entityTypes || Object.keys(this.settings.entityTypes).length === 0) {
        this.settings.entityTypes = DEFAULT_ENTITY_TYPES;
        changed = true;
      }
      if (!this.settings.projectTypes || Object.keys(this.settings.projectTypes).length === 0) {
        this.settings.projectTypes = DEFAULT_PROJECT_TYPES;
        changed = true;
      }
      if (!this.settings.schemaVersion || this.settings.schemaVersion < CURRENT_SETTINGS_SCHEMA_VERSION) {
        this.settings.schemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION;
        changed = true;
      }

      const { index, updated } = ensureProjectIndex(this.settings.projectIndex, this.settings.projectRecords);
      if (updated) {
        this.settings.projectIndex = index;
        changed = true;
      }

      const { graph, updated: graphUpdated } = ensureProjectGraph(
        this.settings.projectGraph,
        this.settings.projectRecords,
        this.settings.archivedRecords,
      );
      if (graphUpdated) {
        this.settings.projectGraph = graph;
        changed = true;
      }

      if (changed) {
        await this.saveData(this.settings);
      }
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
      const ai = this.settings.ai;
      if (ai) {
        if (ai.apiKey) {
          const provider = ai.provider || "openai";
          const secretName = ai.apiKeySecretName?.trim() || this.getDefaultProviderSecretName(provider);
          await this.setSecret(secretName, ai.apiKey);
          ai.apiKeySecretName = secretName;
          delete ai.apiKey;
        }
        if (Array.isArray(ai.mcpServers)) {
          ai.mcpServers = await this.normalizeMcpServersWithSecrets(ai.mcpServers);
        }
      }
    }
  }

  async saveSettings() {
    const sanitized = JSON.parse(JSON.stringify(this.settings)) as ProjectFlowSettings;
    if (sanitized.ai) {
      delete (sanitized.ai as any).apiKey;
      if (Array.isArray(sanitized.ai.mcpServers)) {
        sanitized.ai.mcpServers = sanitized.ai.mcpServers.map(({ apiKey, ...rest }) => rest);
      }
    }
    await this.saveData(sanitized);
  }

  private getDefaultProviderSecretName(provider: AIProvider): string {
    return `projectflow-ai-${provider}`;
  }

  private getDefaultMcpSecretName(serverName: string): string {
    const safe = (serverName || "server").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return `projectflow-mcp-${safe}`;
  }

  private getSecretStorage(): any {
    return (this.app as any).secretStorage;
  }

  private async setSecret(name: string, value: string): Promise<void> {
    const secretStorage = this.getSecretStorage();
    if (!secretStorage) return;
    if (typeof secretStorage.set === "function") {
      await Promise.resolve(secretStorage.set(name, value));
      return;
    }
    if (typeof secretStorage.setSecret === "function") {
      await Promise.resolve(secretStorage.setSecret(name, value));
      return;
    }
  }

  private async getSecret(name: string): Promise<string> {
    if (!name) return "";
    const secretStorage = this.getSecretStorage();
    if (!secretStorage) return "";
    let value: unknown = null;
    if (typeof secretStorage.get === "function") {
      value = await Promise.resolve(secretStorage.get(name));
    } else if (typeof secretStorage.getSecret === "function") {
      value = await Promise.resolve(secretStorage.getSecret(name));
    } else {
      return "";
    }
    return typeof value === "string" ? value.trim() : "";
  }

  async getAiApiKey(provider: AIProvider, secretName?: string | null): Promise<string> {
    const normalizedSecretName = typeof secretName === "string" ? secretName.trim() : "";
    const fromStorage = await this.getSecret(normalizedSecretName);
    if (fromStorage) return fromStorage;
    const env = (globalThis as any)?.process?.env || {};
    if (provider === "anthropic") {
      return String(env.ANTHROPIC_API_KEY || "").trim();
    }
    if (provider === "openai") {
      return String(env.OPENAI_API_KEY || env.OPENAI_APIKEY || "").trim();
    }
    return "";
  }

  async hasAiCredential(provider: AIProvider): Promise<boolean> {
    if (provider === "ollama") return true;
    const secretName = this.settings.ai?.apiKeySecretName;
    return Boolean(await this.getAiApiKey(provider, secretName));
  }

  async normalizeMcpServersWithSecrets(servers: MCPServerConfig[]): Promise<MCPServerConfig[]> {
    const normalized: MCPServerConfig[] = [];
    for (const server of servers || []) {
      if (!server || !server.name || !server.url) continue;
      let apiKeySecretName = (server.apiKeySecretName || "").trim();
      const rawApiKey = (server.apiKey || "").trim();
      if (rawApiKey) {
        if (!apiKeySecretName) {
          apiKeySecretName = this.getDefaultMcpSecretName(server.name);
        }
        await this.setSecret(apiKeySecretName, rawApiKey);
      }
      normalized.push({
        name: server.name,
        url: server.url,
        ...(apiKeySecretName ? { apiKeySecretName } : {}),
      });
    }
    return normalized;
  }

  async getResolvedAiSettings(): Promise<AISettings | null> {
    const ai = this.settings.ai;
    console.log('getResolvedAISettings')
    console.log(ai)
    if (!ai) return null;
    const provider = ai.provider || "openai";
    const apiKey = await this.getAiApiKey(provider, ai.apiKeySecretName);
    const resolved: AISettings = {
      ...ai,
      provider,
      apiKey,
    };
    const servers = ai.mcpServers || [];
    const resolvedServers: MCPServerConfig[] = [];
    for (const server of servers) {
      resolvedServers.push({
        ...server,
        apiKey: await this.getSecret(server.apiKeySecretName || ""),
      });
    }
    resolved.mcpServers = resolvedServers;
    return resolved;
  }

  getApi() {
    return this.coreApi;
  }

  async toggleAiView(enabled: boolean) {
    if (enabled) {
      const leaves = this.app.workspace.getLeavesOfType(AI_VIEW_TYPE);
      if (leaves.length > 0) {
        await leaves[0].setViewState({ type: AI_VIEW_TYPE, active: true });
        return;
      }
      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: AI_VIEW_TYPE, active: true });
    } else {
      this.app.workspace.detachLeavesOfType(AI_VIEW_TYPE);
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(AI_VIEW_TYPE);
  }

  private async exposeCoreApi() {
    const { createCoreApi } = await import("./api/core-api");
    this.coreApi = createCoreApi(this);
    const globalAny = window as any;
    globalAny.PluginApi = globalAny.PluginApi || {};
    globalAny.PluginApi["@projectflow/core"] = this.coreApi;
  }
}
