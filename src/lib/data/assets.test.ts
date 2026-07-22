import { AssetKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveLocalAssetPath, validateAssetFile } from "./assets";

describe("validateAssetFile", () => {
  it("allows image files for product image assets", () => {
    expect(() =>
      validateAssetFile(AssetKind.PRODUCT_IMAGE, {
        name: "product.png",
        type: "image/png",
        size: 1024,
      }),
    ).not.toThrow();
  });

  it("rejects non-image files for logo assets", () => {
    expect(() =>
      validateAssetFile(AssetKind.LOGO, {
        name: "logo.pdf",
        type: "application/pdf",
        size: 1024,
      }),
    ).toThrow("必须上传图片文件");
  });

  it("allows common document files for product materials", () => {
    expect(() =>
      validateAssetFile(AssetKind.DOCUMENT, {
        name: "manual.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 2048,
      }),
    ).not.toThrow();
  });

  it("rejects files larger than 20MB", () => {
    expect(() =>
      validateAssetFile(AssetKind.PRODUCT_IMAGE, {
        name: "large.png",
        type: "image/png",
        size: 21 * 1024 * 1024,
      }),
    ).toThrow("不能超过 20MB");
  });
});

describe("resolveLocalAssetPath", () => {
  it("allows files inside the local asset storage root", () => {
    expect(resolveLocalAssetPath("storage/assets/workspace-1/product.png")).toContain(
      "storage/assets/workspace-1/product.png",
    );
  });

  it("rejects paths outside the local asset storage root", () => {
    expect(() => resolveLocalAssetPath("../.env")).toThrow("素材文件路径不在本地素材库目录内");
  });
});
