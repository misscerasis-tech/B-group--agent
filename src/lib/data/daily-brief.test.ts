import {
  ContentPackageStatus,
  ReminderSeverity,
  type ContentFrequency,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildDailyBrief, type DailyBriefInput } from "./daily-brief";

const baseInput: DailyBriefInput = {
  workspaceName: "B组演示 Workspace",
  generatedPackages: [],
  upcomingPlanItems: [],
  openReminders: [],
  recentMetrics: [],
};

describe("buildDailyBrief", () => {
  it("summarizes packages, plans, reminders and metrics into a daily assistant brief", () => {
    const brief = buildDailyBrief(
      {
        ...baseInput,
        generatedPackages: [
          {
            id: "package-1",
            name: "7月蒙古首月素材包",
            period: "2026-07",
            frequency: "WEEKLY" as ContentFrequency,
            status: ContentPackageStatus.REVIEW_NEEDED,
            project: {
              name: "蒙古新品增长",
            },
          },
        ],
        upcomingPlanItems: [
          {
            id: "plan-1",
            title: "TikTok 开箱短视频",
            channel: "TikTok",
            theme: "新品认知",
            deliverable: "短视频脚本",
            dueDate: new Date("2026-07-25T00:00:00.000Z"),
            project: {
              name: "蒙古新品增长",
            },
          },
        ],
        openReminders: [
          {
            id: "reminder-1",
            title: "抽奖规则需要提前确认",
            severity: ReminderSeverity.CRITICAL,
            dueAt: new Date("2026-07-24T00:00:00.000Z"),
            project: {
              name: "蒙古新品增长",
            },
          },
        ],
        recentMetrics: [
          {
            id: "metric-1",
            period: "2026-W29",
            channel: "Facebook",
            impressions: 4000,
            clicks: 12,
            conversions: 0,
            spendCents: 12000,
            project: {
              name: "蒙古新品增长",
            },
          },
          {
            id: "metric-2",
            period: "2026-W29",
            channel: "TikTok",
            impressions: 2000,
            clicks: 160,
            conversions: 18,
            spendCents: 30000,
            project: {
              name: "蒙古新品增长",
            },
          },
        ],
      },
      new Date("2026-07-22T08:00:00.000Z"),
    );

    expect(brief.title).toBe("7月22日 Agent 工作简报");
    expect(brief.summary).toContain("1 条近期内容计划");
    expect(brief.highlights).toContain("未来 7 天有 1 条内容计划待推进，覆盖 TikTok。");
    expect(brief.highlights.some((item) => item.includes("CTR 8.0%"))).toBe(true);
    expect(brief.risks[0]).toContain("紧急：蒙古新品增长 · 抽奖规则需要提前确认");
    expect(brief.risks.some((item) => item.includes("Facebook 有流量但转化偏弱"))).toBe(true);
    expect(brief.nextActions[0]).toContain("抽奖规则需要提前确认");
  });

  it("returns fallback guidance when the workspace has no active work", () => {
    const brief = buildDailyBrief(baseInput, new Date("2026-07-22T08:00:00.000Z"));

    expect(brief.summary).toBe(
      "B组演示 Workspace 今天有 0 条近期内容计划，0 条待处理提醒，0 个已生成或待审核素材包。",
    );
    expect(brief.highlights[0]).toContain("当前没有新的素材包");
    expect(brief.risks[0]).toContain("暂无明显风险");
    expect(brief.nextActions[0]).toContain("进入 B组 Agent");
  });
});
