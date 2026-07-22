import { describe, expect, it } from "vitest";
import { inferProductFactsFromText } from "./extractor";

describe("inferProductFactsFromText", () => {
  it("extracts useful product facts from Chinese source text", () => {
    const facts = inferProductFactsFromText({
      productName: "Aurora Cup",
      description: "智能温显保温杯，500ml，不锈钢，适合通勤和健身。",
      sourceText: "24小时保温，防漏便携，可作为节日礼品。BPA free 声明需核实。",
    });

    expect(facts).toContainEqual(
      expect.objectContaining({
        label: "核心卖点",
        value: expect.stringContaining("温度显示"),
      }),
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        label: "规格参数",
        value: expect.stringContaining("容量 500ml"),
      }),
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        label: "目标场景",
        value: expect.stringContaining("通勤"),
      }),
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        label: "目标人群",
        value: expect.stringContaining("礼品购买者"),
      }),
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        label: "合规注意",
        value: expect.stringContaining("安全材质声明"),
      }),
    );
  });
});
