import { describe, expect, it } from "vitest";
import { agentCommandCapabilities, getAgentCommandCapabilitiesByCategory } from "./capabilities";

describe("agentCommandCapabilities", () => {
  it("keeps capability keys unique with user-facing Chinese examples", () => {
    const keys = agentCommandCapabilities.map((capability) => capability.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(agentCommandCapabilities.length).toBeGreaterThanOrEqual(10);
    expect(agentCommandCapabilities.every((capability) => capability.example.length > 0)).toBe(true);
    expect(agentCommandCapabilities.some((capability) => capability.example.includes("素材包"))).toBe(
      true,
    );
  });

  it("does not bind command capabilities to a specific external AI vendor", () => {
    const serialized = JSON.stringify(agentCommandCapabilities).toLowerCase();

    expect(serialized).not.toContain("openai");
    expect(serialized).not.toContain("firefly");
    expect(getAgentCommandCapabilitiesByCategory("review").length).toBeGreaterThan(0);
  });
});
