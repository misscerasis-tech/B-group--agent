import { describe, expect, it } from "vitest";
import { parseMetricsImportRows } from "./importer";

describe("parseMetricsImportRows", () => {
  it("parses pasted CSV rows with an optional Chinese header", () => {
    const rows = parseMetricsImportRows(
      [
        "周期,渠道,曝光,点击,转化,花费,备注",
        "2026-07 第3周,TikTok,10000,600,24,1234.56,首轮数据",
        '"2026-07 第4周","Instagram",8000,240,8,560,"素材包 A"',
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        period: "2026-07 第3周",
        channel: "TikTok",
        impressions: 10000,
        clicks: 600,
        conversions: 24,
        spendCents: 123456,
        notes: "首轮数据",
      },
      {
        period: "2026-07 第4周",
        channel: "Instagram",
        impressions: 8000,
        clicks: 240,
        conversions: 8,
        spendCents: 56000,
        notes: "素材包 A",
      },
    ]);
  });

  it("parses tab-separated rows copied from spreadsheets", () => {
    const rows = parseMetricsImportRows("2026-07 第3周\tTikTok\t100\t20\t2\t30\t表格复制");

    expect(rows[0]).toMatchObject({
      period: "2026-07 第3周",
      channel: "TikTok",
      impressions: 100,
      clicks: 20,
      conversions: 2,
      spendCents: 3000,
      notes: "表格复制",
    });
  });

  it("rejects invalid metric relationships", () => {
    expect(() => parseMetricsImportRows("2026-07 第3周,TikTok,100,120,1,20")).toThrow(
      /点击不能大于曝光/,
    );
    expect(() => parseMetricsImportRows("2026-07 第3周,TikTok,100,20,30,20")).toThrow(
      /转化不能大于点击/,
    );
  });
});
