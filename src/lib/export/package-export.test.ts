import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildContentPackageExportFiles, buildContentPackageZip } from "./package-export";
import { buildZipArchive } from "./zip";

const linkedAssetDir = path.join(process.cwd(), "storage/assets/test-package-export-workspace");
const linkedAssetPath = path.join(linkedAssetDir, "poster.svg");

afterEach(async () => {
  await rm(path.join(process.cwd(), "storage/assets/test-package-export-workspace"), {
    force: true,
    recursive: true,
  });
});

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

describe("buildContentPackageExportFiles", () => {
  it("includes V1 deliverable files and linked asset details in the manifest", () => {
    const files = buildContentPackageExportFiles({
      contentPackage: {
        id: "package-1",
        workspaceId: "test-package-export-workspace",
        projectId: "project-1",
        strategyId: "strategy-1",
        name: "首月第一份素材包",
        period: "首月第 1 周",
        frequency: "WEEKLY",
        status: "DRAFT",
        summary: "首周素材包。",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        strategy: {
          id: "strategy-1",
          workspaceId: "workspace-1",
          projectId: "project-1",
          version: 1,
          status: "CONFIRMED",
          targetMarkets: ["巴西"],
          audiences: ["礼品购买者"],
          channels: ["TikTok"],
          contentDirections: ["世界杯"],
          packageFrequency: "WEEKLY",
          positioning: "新品定位",
          rationale: "策略依据",
          confirmedAt: new Date("2026-07-01T00:00:00.000Z"),
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        project: {
          id: "project-1",
          workspaceId: "workspace-1",
          name: "巴西新品上市",
          description: "项目说明",
          status: "ACTIVE",
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          deletedAt: null,
          projectProducts: [
            {
              projectId: "project-1",
              productId: "product-1",
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              product: {
                id: "product-1",
                workspaceId: "workspace-1",
                name: "Aurora Cup",
                description: "产品说明",
                status: "ACTIVE",
                createdAt: new Date("2026-07-01T00:00:00.000Z"),
                updatedAt: new Date("2026-07-01T00:00:00.000Z"),
                deletedAt: null,
                facts: [],
                assets: [],
              },
            },
          ],
        },
        files: [
          {
            id: "file-1",
            contentPackageId: "package-1",
            assetId: "asset-1",
            name: "模板化海报图片",
            fileType: "PNG",
            status: "GENERATED",
            notes: "已关联素材：模板化海报 4:5",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            asset: {
              id: "asset-1",
              workspaceId: "test-package-export-workspace",
              projectId: "project-1",
              productId: "product-1",
              name: "模板化海报 4:5",
              kind: "GENERATED_IMAGE",
              source: "GENERATED",
              status: "APPROVED",
              mimeType: "image/svg+xml",
              sizeBytes: 1024,
              storagePath: "storage/assets/test-package-export-workspace/poster.svg",
              originalFilename: "poster.svg",
              checksum: "checksum",
              metadata: {},
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          },
        ],
      },
      planItems: [],
    } as never);

    const readiness = readText(files.find((file) => file.filename === "00-交付检查.txt")?.content);
    const readme = readText(files.find((file) => file.filename === "README-素材包说明.md")?.content);
    const manifest = JSON.parse(
      readText(files.find((file) => file.filename === "manifest.json")?.content),
    );

    expect(readiness).toContain("可交付性");
    expect(readiness).toContain("关联真实产品图和 Logo");
    expect(files.find((file) => file.filename === "01-素材包说明.pdf")?.content).toBeInstanceOf(
      Buffer,
    );
    expect(files.find((file) => file.filename === "02-内容排期.xlsx")?.content).toBeInstanceOf(
      Buffer,
    );
    expect(files.find((file) => file.filename === "03-平台文案.docx")?.content).toBeInstanceOf(
      Buffer,
    );
    expect(files.map((file) => file.filename)).toContain("08-海报文案.docx");
    expect(files.map((file) => file.filename)).toContain("10-品牌与合规检查.pdf");
    expect(readme).toContain("模板化海报图片 -> 模板化海报 4:5");
    expect(manifest.schemaVersion).toBe("b-agent-content-package.v1");
    expect(manifest.generatedFiles).toContain("02-内容排期.xlsx");
    expect(manifest.files[0].asset).toMatchObject({
      id: "asset-1",
      name: "模板化海报 4:5",
      kind: "GENERATED_IMAGE",
      source: "GENERATED",
      checksum: "checksum",
    });
  });

  it("packs linked local assets into the exported zip", async () => {
    await mkdir(linkedAssetDir, { recursive: true });
    await writeFile(linkedAssetPath, "<svg><title>poster</title></svg>");

    const zip = await buildContentPackageZip({
      contentPackage: {
        id: "package-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: null,
        name: "首月第一份素材包",
        period: "首月第 1 周",
        frequency: "WEEKLY",
        status: "DRAFT",
        summary: "首周素材包。",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        strategy: null,
        project: {
          id: "project-1",
          workspaceId: "workspace-1",
          name: "巴西新品上市",
          description: "项目说明",
          status: "ACTIVE",
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          deletedAt: null,
          projectProducts: [],
        },
        files: [
          {
            id: "file-1",
            contentPackageId: "package-1",
            assetId: "asset-1",
            name: "模板化海报图片",
            fileType: "PNG",
            status: "GENERATED",
            notes: "已关联素材：模板化海报 4:5",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            asset: {
              id: "asset-1",
              workspaceId: "test-package-export-workspace",
              projectId: "project-1",
              productId: null,
              name: "模板化海报 4:5",
              kind: "GENERATED_IMAGE",
              source: "GENERATED",
              status: "APPROVED",
              mimeType: "image/svg+xml",
              sizeBytes: 31,
              storagePath: "storage/assets/test-package-export-workspace/poster.svg",
              originalFilename: "poster.svg",
              checksum: "checksum",
              metadata: {},
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          },
        ],
      },
      planItems: [],
    } as never);

    expect(zip.includes(Buffer.from("linked-assets/01-模板化海报图片-poster.svg", "utf8"))).toBe(
      true,
    );
    expect(zip.includes(Buffer.from("<svg><title>poster</title></svg>", "utf8"))).toBe(true);
  });
});

function readText(value: Buffer | string | undefined) {
  if (!value) {
    return "";
  }

  return Buffer.isBuffer(value) ? value.toString("utf8") : value;
}
