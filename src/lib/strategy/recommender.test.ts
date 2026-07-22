import { ContentFrequency } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildStrategyRecommendation } from "./recommender";

describe("buildStrategyRecommendation", () => {
  it("recommends market, audience, channels and directions from product facts", () => {
    const recommendation = buildStrategyRecommendation({
      projectName: "巴西智能杯首月增长",
      products: [
        {
          name: "Aurora Cup",
          description: "巴西上市新品",
          facts: [
            {
              label: "核心卖点",
              value: "24小时保温、防漏便携、温度显示",
              status: "CONFIRMED",
            },
            {
              label: "目标场景",
              value: "通勤、健身、节日礼品",
              status: "NEEDS_REVIEW",
            },
            {
              label: "规格参数",
              value: "500ml 不锈钢，BPA free 声明需核实",
              status: "NEEDS_REVIEW",
            },
          ],
        },
      ],
    });

    expect(recommendation.targetMarkets).toEqual(["巴西"]);
    expect(recommendation.audiences).toEqual(
      expect.arrayContaining(["年轻通勤人群", "健身和户外用户", "礼品购买者"]),
    );
    expect(recommendation.channels).toEqual(
      expect.arrayContaining(["TikTok", "Instagram", "Facebook"]),
    );
    expect(recommendation.contentDirections).toEqual(
      expect.arrayContaining(["长效保温场景", "通勤随身", "安全材质科普"]),
    );
    expect(recommendation.packageFrequency).toBe(ContentFrequency.WEEKLY);
    expect(recommendation.rationale).toContain("3 条产品事实");
  });
});
