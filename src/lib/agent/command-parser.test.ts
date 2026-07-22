import { ContentFrequency } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseAgentCommand } from "./command-parser";

describe("parseAgentCommand", () => {
  it("turns a Chinese channel and frequency request into structured operations", () => {
    const parsed = parseAgentCommand("巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。");

    expect(parsed.operations).toEqual([
      {
        type: "set_market",
        value: "巴西",
        label: "目标市场设为：巴西",
      },
      {
        type: "add_channel",
        value: "TikTok",
        label: "新增渠道：TikTok",
      },
      {
        type: "remove_channel",
        value: "LinkedIn",
        label: "删除渠道：LinkedIn",
      },
      {
        type: "set_package_frequency",
        value: ContentFrequency.WEEKLY,
        label: "素材包生成频率改为：每周一次",
      },
    ]);
    expect(parsed.confidence).toBe("high");
  });

  it("extracts cultural and campaign content direction hints", () => {
    const parsed = parseAgentCommand("这个月围绕世界杯与那达慕做 Facebook 活动，每两周生成一次素材包。");

    expect(parsed.operations).toContainEqual({
      type: "add_content_direction",
      value: "世界杯",
      label: "新增内容方向：世界杯",
    });
    expect(parsed.operations).toContainEqual({
      type: "add_content_direction",
      value: "那达慕",
      label: "新增内容方向：那达慕",
    });
    expect(parsed.operations).toContainEqual({
      type: "set_package_frequency",
      value: ContentFrequency.BIWEEKLY,
      label: "素材包生成频率改为：每两周一次",
    });
  });

  it("extracts audience and content direction removals", () => {
    const parsed = parseAgentCommand("不要学生用户，新增礼品购买者，本月不做小抽奖。");

    expect(parsed.operations).toContainEqual({
      type: "remove_audience",
      value: "学生用户",
      label: "删除客群：学生用户",
    });
    expect(parsed.operations).toContainEqual({
      type: "add_audience",
      value: "礼品购买者",
      label: "新增客群：礼品购买者",
    });
    expect(parsed.operations).toContainEqual({
      type: "remove_content_direction",
      value: "小抽奖",
      label: "删除内容方向：小抽奖",
    });
  });

  it("returns a low-confidence summary when no safe operation is detected", () => {
    const parsed = parseAgentCommand("帮我看看这个项目怎么样");

    expect(parsed.operations).toHaveLength(0);
    expect(parsed.confidence).toBe("low");
    expect(parsed.summary).toContain("还没有识别到");
  });
});
