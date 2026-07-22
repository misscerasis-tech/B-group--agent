import { describe, expect, it } from "vitest";
import {
  buildWorkspaceRecapSnapshotJson,
  type WorkspaceRecapExportData,
} from "./recap-snapshot";

describe("workspace recap snapshot export", () => {
  it("builds a stable workspace recap json with readiness signals", () => {
    const exportedAt = new Date("2026-07-22T00:00:00.000Z");
    const snapshot = {
      workspace: {
        id: "workspace_1",
        name: "B 组演示 Workspace",
        slug: "b-demo",
        createdAt: exportedAt,
        updatedAt: exportedAt,
      },
      recap: {
        metrics: {
          confirmedStrategies: 1,
          draftStrategies: 0,
          planItems: 4,
          draftPackages: 0,
          approvedPackages: 1,
          openReminders: 1,
          approvedAssets: 2,
          pendingAssets: 0,
          appliedOperations: 3,
          pendingOperations: 0,
          metricSnapshots: 2,
          impressions: 10000,
          clicks: 600,
          conversions: 24,
          spendCents: 123456,
          clickRate: 0.06,
          conversionRate: 0.04,
          costPerConversionCents: 5144,
        },
        suggestions: ["当前工作流没有明显阻塞，可以进入下一批素材包生成。"],
        projects: [
          {
            id: "project_1",
            workspaceId: "workspace_1",
            name: "巴西新品首月增长",
            description: "项目说明",
            status: "ACTIVE",
            createdAt: exportedAt,
            updatedAt: exportedAt,
            deletedAt: null,
          },
        ],
        recentMetrics: [
          {
            id: "metric_1",
            workspaceId: "workspace_1",
            projectId: "project_1",
            period: "2026-07 第3周",
            channel: "TikTok",
            impressions: 10000,
            clicks: 600,
            conversions: 24,
            spendCents: 123456,
            notes: "首轮数据",
            capturedAt: exportedAt,
            createdAt: exportedAt,
            updatedAt: exportedAt,
            project: {
              id: "project_1",
              workspaceId: "workspace_1",
              name: "巴西新品首月增长",
              description: "项目说明",
              status: "ACTIVE",
              createdAt: exportedAt,
              updatedAt: exportedAt,
              deletedAt: null,
            },
          },
        ],
        recentChangeLogs: [
          {
            id: "log_1",
            workspaceId: "workspace_1",
            projectId: "project_1",
            entityType: "MetricsSnapshot",
            entityId: "metric_1",
            action: "metrics_snapshot_created",
            summary: "录入 TikTok 指标。",
            before: null,
            after: null,
            actorUserId: "user_1",
            createdAt: exportedAt,
          },
        ],
      },
    } as unknown as WorkspaceRecapExportData;

    const parsed = JSON.parse(buildWorkspaceRecapSnapshotJson(snapshot, exportedAt));

    expect(parsed.schemaVersion).toBe("b-agent-workspace-recap.v1");
    expect(parsed.workspace.slug).toBe("b-demo");
    expect(parsed.metrics.spendYuan).toBe(1234.56);
    expect(parsed.metrics.costPerConversionYuan).toBe(51.44);
    expect(parsed.readiness).toMatchObject({
      strategyReady: true,
      packageReady: true,
      assetsReady: true,
      needsHumanConfirmation: false,
      hasPerformanceData: true,
    });
    expect(parsed.recentMetrics[0]).toMatchObject({
      projectName: "巴西新品首月增长",
      spendYuan: 1234.56,
    });
    expect(parsed.exportedAt).toBe("2026-07-22T00:00:00.000Z");
  });
});
