import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatMessage, ToolCall } from "../types/core";
import type { ToolDefinition } from "../types/tools";
import type { PlanningResult } from "../types/planning";
import { streamProvider } from "../providers/provider";
import { buildToolCallsFromDeltas, finalizeToolCalls } from "./tool-calls";
import { executeToolCalls } from "../handlers/tool-executor";
import { getEntityRequirementsSummary } from "./prompts";

const PLANNER_PROMPT = [
  "You are a planner for ProjectFlow AI.",
  "Return ONLY valid JSON with keys: needsFollowup (boolean), question (string), plan (string), context (string), fields (object).",
  "fields must include required values for createEntity/createProject when applicable (e.g., TITLE, DESCRIPTION).",
  "If you need more info, set needsFollowup=true and ask a concise question.",
  "If you have enough info, set needsFollowup=false and provide a short plan, context summary, and fields.",
  "If a chat project context is provided, assume that project and do NOT ask the user to choose a project.",
  "When planning createProject, do not include the year in the name; use a separate year field if needed.",
  "MANDATORY RULE — createProject: dimension and category MUST be explicitly chosen by the user.",
  "  Step 1: Call the listDimensions tool to retrieve all available dimensions and their categories.",
  "  Step 2: Set needsFollowup=true. In the question, list the available dimensions/categories and ask the user to choose.",
  "  Step 3: NEVER put dimension or category in the fields object during planning — leave them out entirely.",
  "  Step 4: Only set needsFollowup=false after the user has explicitly stated their dimension and category choice.",
  "  This rule applies even if you think you can infer the values from context. Always ask.",
  "Format text in `question` and `plan` keys as markdown"
].join("\n");

export async function runPlanningStage(options: {
  plugin: ProjectFlowPlugin;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  allowToolCalls?: boolean;
  chatProjectContext?: { projectId: string; projectTag: string; fullName: string } | null;
}): Promise<PlanningResult> {
  const chatProjectNote = options.chatProjectContext
    ? `${options.chatProjectContext.projectId} (${options.chatProjectContext.projectTag})`
    : "(none)";
  const entityRequirements = getEntityRequirementsSummary(options.plugin);
  const planningMessages: ChatMessage[] = [
    {
      role: "system",
      content: [
        PLANNER_PROMPT,
        `Chat project context: ${chatProjectNote}`,
        `Entity required fields (by project type → entity type): ${entityRequirements}`,
        "When the user's request involves creating an entity, check the required fields above.",
        "If any required field is missing from what the user provided, set needsFollowup=true and ask for it.",
        "EXCEPTION — never ask the user for these fields; they are resolved automatically by the agent using tools: parentFolder.",
      ].join("\n"),
    },
    // Strip the main system prompt — the planner only needs the conversation turns,
    // not the full project index (which would let it infer dimension/category silently).
    ...options.messages.filter((m) => m.role !== "tool" && m.role !== "system"),
  ];

  const content = await runPlannerLoop({
    plugin: options.plugin,
    messages: planningMessages,
    tools: options.tools,
    allowToolCalls: options.allowToolCalls ?? false,
  });
  const parsed = parsePlannerJson(content);
  if (!parsed) {
    return {
      needsFollowup: false,
      plan: "",
      context: "",
      fields: {},
    };
  }
  return parsed;
}

async function runPlannerLoop(options: {
  plugin: ProjectFlowPlugin;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  allowToolCalls: boolean;
}): Promise<string> {
  const aiSettings = await options.plugin.getResolvedAiSettings();
  if (!aiSettings) {
    throw new Error("AI settings are missing");
  }
  let content = "";
  const maxSteps = 6;
  const toolDefs = options.allowToolCalls ? options.tools : [];
  for (let step = 0; step < maxSteps; step += 1) {
    const toolCallsAccumulator = new Map<number, ToolCall>();
    content = "";
    for await (const evt of streamProvider(aiSettings, options.messages, toolDefs)) {
      if (evt.type === "content" && evt.delta) {
        content += evt.delta;
      }
      if (evt.type === "tool_call_delta" && evt.toolCalls) {
        buildToolCallsFromDeltas(evt.toolCalls, toolCallsAccumulator);
      }
    }
    const toolCalls = finalizeToolCalls(toolCallsAccumulator);
    options.messages.push({ role: "assistant", content, toolCalls });
    if (toolCalls.length === 0 || !options.allowToolCalls) {
      return content.trim();
    }
    const results = await executeToolCalls(toolCalls, options.tools);
    for (let i = 0; i < results.length; i += 1) {
      const res = results[i];
      const payload = res.ok
        ? { ok: true, result: res.result }
        : { ok: false, error: res.error };
      options.messages.push({
        role: "tool",
        name: res.toolName,
        toolCallId: toolCalls[i]?.id,
        content: JSON.stringify(payload),
      });
    }
  }
  return content.trim();
}

export function parsePlannerJson(raw: string): PlanningResult | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = raw.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    const fields = obj.fields && typeof obj.fields === "object" ? obj.fields : {};
    return {
      needsFollowup: Boolean(obj.needsFollowup),
      question: typeof obj.question === "string" ? obj.question : "",
      plan: typeof obj.plan === "string" ? obj.plan : "",
      context: typeof obj.context === "string" ? obj.context : "",
      fields,
    };
  } catch {
    return null;
  }
}
