import type { MCPServerConfig } from "../../interfaces";
import type { ToolDefinition } from "../types/tools";
import type { JSONSchema7 } from "../schemas/jsonschema";

interface MCPToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: JSONSchema7;
}

export async function fetchMcpTools(servers: MCPServerConfig[]): Promise<Array<{ server: MCPServerConfig; tools: MCPToolDescriptor[] }>> {
  const results: Array<{ server: MCPServerConfig; tools: MCPToolDescriptor[] }> = [];
  for (const server of servers) {
    try {
      const url = `${server.url.replace(/\/$/, "")}/tools`;
      const res = await fetch(url, {
        method: "GET",
        headers: server.apiKey ? { "x-api-key": server.apiKey } : undefined,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tools = Array.isArray(data?.tools) ? data.tools : [];
      results.push({ server, tools });
    } catch {
      // ignore unreachable servers
    }
  }
  return results;
}

export function toMcpToolDefinitions(
  server: MCPServerConfig,
  tools: MCPToolDescriptor[],
): ToolDefinition[] {
  return tools.map((tool) => ({
    name: `${server.name}:${tool.name}`,
    description: tool.description || "MCP tool",
    schema: tool.inputSchema || { type: "object", properties: {}, additionalProperties: true },
    handler: async (args) => callMcpTool(server, tool.name, args),
  }));
}

async function callMcpTool(
  server: MCPServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const url = `${server.url.replace(/\/$/, "")}/call`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(server.apiKey ? { "x-api-key": server.apiKey } : {}),
    },
    body: JSON.stringify({ name: toolName, args }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MCP call failed: ${res.status} ${text || res.statusText}`);
  }
  return await res.json().catch(() => ({}));
}
