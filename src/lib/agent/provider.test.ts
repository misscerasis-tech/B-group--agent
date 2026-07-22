import { ContentFrequency } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createAgentTextProvider } from "./provider";

describe("AgentTextProvider", () => {
  it("uses the local-rule provider for structured Chinese commands", async () => {
    const provider = createAgentTextProvider("local-rule");
    const parsed = await provider.parseCommand({
      workspaceId: "workspace-1",
      projectId: "project-1",
      text: "巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。",
      locale: "zh-CN",
    });

    expect(provider.providerKey).toBe("local-rule");
    expect(parsed.operations).toContainEqual({
      type: "set_package_frequency",
      value: ContentFrequency.WEEKLY,
      label: "素材包生成频率改为：每周一次",
    });
  });

  it("fails loudly for providers that have not been implemented yet", () => {
    expect(() => createAgentTextProvider("openai")).toThrow(/local-rule/);
  });
});
