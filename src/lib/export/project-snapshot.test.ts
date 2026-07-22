import { describe, expect, it } from "vitest";
import { buildProjectSnapshotJson, type ProjectSnapshotExportData } from "./project-snapshot";

describe("project snapshot export", () => {
  it("builds a workspace-scoped project snapshot json", () => {
    const exportedAt = new Date("2026-07-22T00:00:00.000Z");
    const snapshot = {
      id: "project_1",
      workspaceId: "workspace_1",
      name: "巴西新品上市",
      description: "首月增长项目",
      status: "ACTIVE",
      createdAt: exportedAt,
      updatedAt: exportedAt,
      workspace: {
        id: "workspace_1",
        name: "B 组演示 Workspace",
        slug: "b-demo",
      },
      projectProducts: [
        {
          product: {
            id: "product_1",
            name: "Aurora Cup",
            description: "保温杯",
            status: "ACTIVE",
            facts: [
              {
                id: "fact_1",
                label: "卖点",
                value: "轻量便携",
                source: "USER_INPUT",
                status: "CONFIRMED",
                confidence: 88,
              },
            ],
            assets: [
              {
                id: "asset_1",
                name: "产品主图",
                kind: "PRODUCT_IMAGE",
                source: "USER_UPLOAD",
                status: "APPROVED",
                originalFilename: "cup.png",
                checksum: "checksum",
                metadata: {
                  productSubjectLocked: true,
                },
              },
            ],
          },
        },
      ],
      strategies: [
        {
          id: "strategy_1",
          version: 2,
          status: "CONFIRMED",
          targetMarkets: ["巴西"],
          audiences: ["礼品购买者"],
          channels: ["TikTok"],
          contentDirections: ["世界杯"],
          packageFrequency: "WEEKLY",
          positioning: "礼品场景",
          rationale: "本地规则型建议",
          confirmedAt: exportedAt,
        },
      ],
      contentPlanItems: [
        {
          id: "plan_1",
          week: 1,
          channel: "TikTok",
          theme: "新品认知",
          title: "短视频脚本",
          deliverable: "脚本和海报",
          status: "READY",
        },
      ],
      contentPackages: [
        {
          id: "package_1",
          name: "首月素材包",
          period: "首月第 1 周",
          frequency: "WEEKLY",
          status: "DRAFT",
          summary: "结构清单",
          files: [
            {
              id: "file_1",
              name: "Hashtags TXT",
              fileType: "TXT",
              status: "PLANNED",
              assetId: null,
            },
          ],
        },
      ],
      reminders: [],
      reviewTasks: [],
      operations: [],
      changeLogs: [],
    } as unknown as ProjectSnapshotExportData;

    const parsed = JSON.parse(buildProjectSnapshotJson(snapshot, exportedAt));

    expect(parsed.schemaVersion).toBe("b-agent-project-snapshot.v1");
    expect(parsed.workspace.id).toBe("workspace_1");
    expect(parsed.project.id).toBe("project_1");
    expect(parsed.latestStrategy.version).toBe(2);
    expect(parsed.products[0].assets[0].status).toBe("APPROVED");
    expect(parsed.planItems[0].channel).toBe("TikTok");
    expect(parsed.exportedAt).toBe("2026-07-22T00:00:00.000Z");
  });
});
