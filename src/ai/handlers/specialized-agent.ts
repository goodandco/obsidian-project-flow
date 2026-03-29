import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatMessage } from "../types/core";
import { runAgentLoop } from "./agent";
import { buildSpecializedSystemPrompt } from "../domain/prompts";
import { createSpecializedToolRegistry } from "../adapters/registry";

import type { ChatUi } from "../types/ui";
import type { AiStateStore } from "../domain/conversation";

export async function delegateToProjectAssistant(
    plugin: ProjectFlowPlugin,
    ui: ChatUi,
    state: AiStateStore,
    args: { projectRef: { tag?: string; id?: string; fullName?: string }; instructions: string }
): Promise<string> {
    const api = plugin.getApi();
    if (!api) throw new Error("API not available");

    // 1. Resolve project
    const resolved = api.resolveProject(args.projectRef);
    if (!resolved) {
        throw new Error(`Could not resolve project based on reference: ${JSON.stringify(args.projectRef)}`);
    }

    const projectTypeId = resolved.record.info.projectTypeId;

    // 2. Instantiate specialized tools
    const specializedTools = createSpecializedToolRegistry(plugin, projectTypeId, { id: resolved.entry.projectId }, resolved.record);

    if (specializedTools.length === 0) {
        return `Project (type: ${projectTypeId}) has no specialized tools available to act upon.`;
    }

    // 3. Build specialized prompt
    const systemPrompt = await buildSpecializedSystemPrompt(plugin, resolved.record);

    // 4. Set up the sub-agent run using the real UI and State
    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.instructions }
    ];

    try {
        await runAgentLoop({
            plugin,
            ui,
            state,
            messages,
            tools: specializedTools,
            showAssistant: false,
        });

        // Extract the final assistant answer from messages
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
            return `Delegated action completed. Sub-agent says: ${lastMessage.content}`;
        }
        return "Delegated action completed successfully.";

    } catch (err: any) {
        return `Failed to execute delegated action: ${err.message}`;
    }
}
