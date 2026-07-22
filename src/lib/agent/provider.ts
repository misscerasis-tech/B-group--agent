import {
  parseAgentCommand,
  type ParsedAgentCommand,
} from "@/lib/agent/command-parser";

export type AgentTextProviderInput = {
  workspaceId: string;
  projectId?: string;
  text: string;
  locale: "zh-CN";
};

export interface AgentTextProvider {
  readonly providerKey: string;
  readonly displayName: string;
  parseCommand(input: AgentTextProviderInput): Promise<ParsedAgentCommand> | ParsedAgentCommand;
}

export class LocalRuleAgentTextProvider implements AgentTextProvider {
  readonly providerKey = "local-rule";
  readonly displayName = "本地规则型 Agent";

  parseCommand(input: AgentTextProviderInput) {
    return parseAgentCommand(input.text);
  }
}

export function createAgentTextProvider(providerKey = "local-rule"): AgentTextProvider {
  const normalizedProviderKey = providerKey.trim() || "local-rule";

  if (normalizedProviderKey === "local-rule") {
    return new LocalRuleAgentTextProvider();
  }

  throw new Error(
    `当前仅启用本地规则型 Agent Provider：local-rule。${normalizedProviderKey} 需要在后续 GPT 接入阶段实现适配器。`,
  );
}

export function getConfiguredAgentTextProvider() {
  try {
    return createAgentTextProvider(process.env.AI_PROVIDER ?? "local-rule");
  } catch {
    return new LocalRuleAgentTextProvider();
  }
}
