import { describe, expect, it } from "vitest";
import { buildDashboardActionItems } from "./dashboard";

describe("buildDashboardActionItems", () => {
  it("prioritizes confirmations, reviews and asset checks before routine work", () => {
    const dueDate = new Date("2026-07-23T00:00:00.000Z");
    const items = buildDashboardActionItems({
      pendingOperations: [
        {
          id: "operation-1",
          projectId: "project-1",
          summary: "新增 TikTok，删除 LinkedIn",
          project: {
            name: "巴西新品首月增长",
          },
        },
      ],
      draftStrategies: [
        {
          id: "strategy-1",
          projectId: "project-1",
          project: {
            name: "巴西新品首月增长",
          },
        },
      ],
      pendingReviews: [
        {
          id: "review-1",
          title: "审核素材包",
          project: {
            name: "巴西新品首月增长",
          },
        },
      ],
      pendingAssets: [
        {
          id: "asset-1",
          name: "官方 Logo",
          project: null,
          product: {
            name: "Aurora Cup",
          },
        },
      ],
      draftPackages: [
        {
          id: "package-1",
          name: "首月第 1 周素材包",
          project: {
            name: "巴西新品首月增长",
          },
        },
      ],
      upcomingPlanItems: [
        {
          id: "plan-1",
          title: "TikTok 开箱脚本",
          channel: "TikTok",
          dueDate,
          project: {
            name: "巴西新品首月增长",
          },
        },
      ],
    });

    expect(items.map((item) => item.title)).toEqual([
      "确认 Agent 变更",
      "处理审核任务",
      "审核真实素材",
      "确认策略草案",
      "完善素材包",
      "推进近期内容计划",
    ]);
    expect(items[0]).toMatchObject({
      priority: "high",
      href: "/b-agent?projectId=project-1",
    });
  });

  it("returns a useful next action when there are no blockers", () => {
    const items = buildDashboardActionItems({
      pendingOperations: [],
      draftStrategies: [],
      pendingReviews: [],
      pendingAssets: [],
      draftPackages: [],
      upcomingPlanItems: [],
    });

    expect(items).toEqual([
      {
        id: "next-package",
        priority: "low",
        title: "开启下一轮内容增长",
        description: "当前没有明显阻塞，可以进入 B组 Agent 生成下一份计划或素材包。",
        href: "/b-agent",
      },
    ]);
  });
});
