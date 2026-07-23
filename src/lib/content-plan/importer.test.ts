import { PlanItemStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseContentPlanImportRows } from "./importer";

describe("parseContentPlanImportRows", () => {
  it("parses pasted CSV rows with an optional Chinese header", () => {
    const rows = parseContentPlanImportRows(
      [
        "周次,渠道,主题,标题,交付物,截止日期,状态",
        "第1周,TikTok,新品认知,15秒开箱短视频,脚本+配文,2026-08-07,可执行",
        "2,Instagram,礼赠场景,轮播图文,海报+发布文案,2026/08/14,需审核",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        week: 1,
        channel: "TikTok",
        theme: "新品认知",
        title: "15秒开箱短视频",
        deliverable: "脚本+配文",
        dueDate: "2026-08-07",
        status: PlanItemStatus.READY,
      },
      {
        week: 2,
        channel: "Instagram",
        theme: "礼赠场景",
        title: "轮播图文",
        deliverable: "海报+发布文案",
        dueDate: "2026-08-14",
        status: PlanItemStatus.REVIEW_NEEDED,
      },
    ]);
  });

  it("parses tab-separated rows copied from spreadsheets", () => {
    const rows = parseContentPlanImportRows(
      "第3周\tFacebook\t节日预热\t抽奖预告帖\t图文+规则草案\t2026年08月21日\t草稿",
    );

    expect(rows[0]).toEqual({
      week: 3,
      channel: "Facebook",
      theme: "节日预热",
      title: "抽奖预告帖",
      deliverable: "图文+规则草案",
      dueDate: "2026-08-21",
      status: PlanItemStatus.DRAFT,
    });
  });

  it("rejects incomplete rows and invalid weeks", () => {
    expect(() => parseContentPlanImportRows("第1周,TikTok,主题")).toThrow(/至少需要/);
    expect(() =>
      parseContentPlanImportRows("第13周,TikTok,主题,标题,交付物,2026-08-07,可执行"),
    ).toThrow(/周次必须/);
  });
});
