import { AssetKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildTemplateCompositionSvg, resolveLocalAssetPath, validateAssetFile } from "./assets";

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

describe("buildTemplateCompositionSvg", () => {
  it("builds a layered poster without allowing product repaint", () => {
    const svg = buildTemplateCompositionSvg({
      width: 1080,
      height: 1350,
      aspectRatio: "4:5",
      productName: "Aurora <Cup>",
      headline: "新品内容增长素材",
      subheadline: "真实产品图 + 官方 Logo 分层合成",
      productImageDataUrl: "data:image/png;base64,product",
      logoDataUrl: "data:image/png;base64,logo",
    });

    expect(svg).toContain('id="background-layer"');
    expect(svg).toContain('id="product-layer"');
    expect(svg).toContain('id="text-layer"');
    expect(svg).toContain('id="logo-layer"');
    expect(svg).toContain('id="decoration-layer"');
    expect(svg).toContain('data-product-subject-locked="true"');
    expect(svg).toContain('data-allow-repaint="false"');
    expect(svg).toContain("Aurora &lt;Cup&gt;");
  });
});
