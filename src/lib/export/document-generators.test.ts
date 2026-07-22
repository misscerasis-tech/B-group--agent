import { describe, expect, it } from "vitest";
import { buildSimpleDocx, buildSimplePdf, buildSimpleXlsx } from "./document-generators";

describe("local document generators", () => {
  it("builds basic PDF, DOCX and XLSX buffers", () => {
    const pdf = buildSimplePdf({
      title: "素材包说明",
      lines: ["项目：巴西新品上市", "渠道：TikTok"],
    });
    const docx = buildSimpleDocx({
      title: "平台文案",
      paragraphs: ["第一条文案", "第二条文案"],
    });
    const xlsx = buildSimpleXlsx({
      sheetName: "内容排期",
      rows: [
        ["周次", "渠道"],
        ["第1周", "TikTok"],
      ],
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(docx.subarray(0, 4).readUInt32LE(0)).toBe(0x04034b50);
    expect(docx.includes(Buffer.from("word/document.xml", "utf8"))).toBe(true);
    expect(xlsx.subarray(0, 4).readUInt32LE(0)).toBe(0x04034b50);
    expect(xlsx.includes(Buffer.from("xl/worksheets/sheet1.xml", "utf8"))).toBe(true);
  });
});
