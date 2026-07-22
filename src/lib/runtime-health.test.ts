import { describe, expect, it } from "vitest";
import { buildRuntimeHealth, buildRuntimeHealthNextSteps } from "./runtime-health";

describe("buildRuntimeHealthNextSteps", () => {
  it("asks the user to configure DATABASE_URL before checking the database", () => {
    const steps = buildRuntimeHealthNextSteps({
      database: {
        status: "unavailable",
        message: "missing",
      },
      databaseUrlConfigured: false,
      aiProvider: "local-rule",
    });

    expect(steps).toContain("复制 .env.example 为 .env，并填写 DATABASE_URL。");
  });

  it("explains local-rule fallback when a future AI provider is configured", () => {
    const health = buildRuntimeHealth({
      checkedAt: "2026-07-22T00:00:00.000Z",
      database: {
        status: "ok",
      },
      databaseUrlConfigured: true,
      nodeVersion: "v22.0.0",
      nodeEnvironment: "test",
      aiProvider: "openai",
      assetStorageDirConfigured: false,
    });

    expect(health.ok).toBe(true);
    expect(health.nextSteps).toContain(
      "当前阶段真实 GPT 适配器尚未启用，AI_PROVIDER 会自动降级到 local-rule。",
    );
    expect(health.environment.databaseUrl).toBe("configured");
  });

  it("returns the B group entrypoint when everything is ready", () => {
    const steps = buildRuntimeHealthNextSteps({
      database: {
        status: "ok",
      },
      databaseUrlConfigured: true,
      aiProvider: "local-rule",
    });

    expect(steps).toEqual([
      "运行 npx pnpm@10.13.1 run dev:b 后打开 http://127.0.0.1:3002/b-agent。",
    ]);
  });
});
