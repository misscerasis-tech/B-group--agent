import { describe, expect, it } from "vitest";
import { buildWorkspaceBackupJson, redactSensitiveFields } from "./workspace-backup";
import { validateWorkspaceBackupEnvelope } from "./workspace-backup-validate";

describe("redactSensitiveFields", () => {
  it("redacts nested secret-like fields without removing normal business data", () => {
    const redacted = redactSensitiveFields({
      workspace: {
        name: "演示增长团队",
      },
      integration: {
        appSecret: "real-secret",
        tenantKey: "tenant-key",
        nested: {
          accessToken: "token",
          notificationTargetName: "增长通知群",
        },
      },
    });

    expect(redacted).toEqual({
      workspace: {
        name: "演示增长团队",
      },
      integration: {
        appSecret: "[REDACTED]",
        tenantKey: "[REDACTED]",
        nested: {
          accessToken: "[REDACTED]",
          notificationTargetName: "增长通知群",
        },
      },
    });
  });
});

describe("buildWorkspaceBackupJson", () => {
  it("creates a safe workspace backup envelope", () => {
    const json = buildWorkspaceBackupJson(
      {
        workspace: {
          id: "workspace-1",
          name: "演示增长团队",
          slug: "demo-growth-team",
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        members: [],
        projects: [{ id: "project-1", secretNote: "should redact" }],
        products: [],
        projectStrategies: [],
        contentPlanItems: [],
        contentPackages: [],
        reviewTasks: [],
        reminders: [],
        metricsSnapshots: [],
        conversations: [],
        agentOperations: [],
        changeLogs: [],
        assets: [],
        imageProviderConfigs: [],
        imageGenerationJobs: [],
        integrationConnections: [],
        integrationMigrationRecords: [],
      } as never,
      new Date("2026-07-22T00:00:00.000Z"),
    );
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe("b-agent-workspace-backup.v1");
    expect(parsed.safety.includesSecrets).toBe(false);
    expect(parsed.counts.projects).toBe(1);
    expect(parsed.data.projects[0].secretNote).toBe("[REDACTED]");
  });
});

describe("validateWorkspaceBackupEnvelope", () => {
  it("accepts a safe workspace backup envelope", () => {
    const parsed = JSON.parse(
      buildWorkspaceBackupJson(
        {
          workspace: {
            id: "workspace-1",
            name: "演示增长团队",
            slug: "demo-growth-team",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          },
          members: [],
          projects: [{ id: "project-1", workspaceId: "workspace-1" }],
          products: [],
          projectStrategies: [],
          contentPlanItems: [],
          contentPackages: [],
          reviewTasks: [],
          reminders: [],
          metricsSnapshots: [],
          conversations: [],
          agentOperations: [],
          changeLogs: [],
          assets: [],
          imageProviderConfigs: [],
          imageGenerationJobs: [],
          integrationConnections: [],
          integrationMigrationRecords: [],
        } as never,
        new Date("2026-07-22T00:00:00.000Z"),
      ),
    );

    expect(validateWorkspaceBackupEnvelope(parsed)).toEqual(
      expect.objectContaining({
        ok: true,
        workspaceId: "workspace-1",
        issues: [],
      }),
    );
  });

  it("reports count mismatches, sensitive leaks and workspace scope issues", () => {
    const result = validateWorkspaceBackupEnvelope({
      schemaVersion: "b-agent-workspace-backup.v1",
      safety: {
        includesUploadedFileBytes: false,
        includesSecrets: false,
      },
      counts: {
        projects: 2,
        products: 0,
        assets: 0,
        contentPackages: 0,
        reminders: 0,
        metricsSnapshots: 0,
        changeLogs: 0,
      },
      data: {
        workspace: {
          id: "workspace-1",
        },
        members: [],
        projects: [{ id: "project-1", workspaceId: "workspace-2" }],
        products: [],
        projectStrategies: [],
        contentPlanItems: [],
        contentPackages: [],
        reviewTasks: [],
        reminders: [],
        metricsSnapshots: [],
        conversations: [],
        agentOperations: [],
        changeLogs: [],
        assets: [],
        imageProviderConfigs: [],
        imageGenerationJobs: [],
        integrationConnections: [{ appSecret: "real-secret", workspaceId: "workspace-1" }],
        integrationMigrationRecords: [],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "counts.projects=2 与 data.projects.length=1 不一致。",
        "data.projects[0].workspaceId 不属于当前 Workspace。",
        "$.data.integrationConnections[0].appSecret 疑似敏感字段未脱敏。",
      ]),
    );
  });
});
