import { describe, expect, it } from "vitest";
import { buildZipArchive } from "./zip";

describe("package export zip builder", () => {
  it("builds a basic zip archive with UTF-8 filenames", () => {
    const zip = buildZipArchive([
      {
        filename: "README-素材包说明.md",
        content: "# 素材包",
      },
      {
        filename: "manifest.json",
        content: "{}",
      },
    ]);

    expect(zip.subarray(0, 4).readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from("README-素材包说明.md", "utf8"))).toBe(true);
    expect(zip.subarray(zip.length - 22, zip.length - 18).readUInt32LE(0)).toBe(0x06054b50);
  });
});
