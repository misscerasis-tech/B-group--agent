import { describe, expect, it } from "vitest";
import { assertNoProductRepaint, type ImageGenerationRequest } from "./provider";

const baseRequest: ImageGenerationRequest = {
  workspaceId: "workspace_1",
  prompt: "生成节日背景，不改变产品主体。",
  promptVersion: "test-v1",
  mode: "template_composition",
  aspectRatio: "4:5",
  sourceAssetIds: ["product_asset", "logo_asset"],
  lockedLayers: [
    {
      id: "product-layer",
      type: "product",
      sourceAssetId: "product_asset",
      zIndex: 2,
      lockedProductSubject: {
        sourceAssetId: "product_asset",
        locked: true,
        allowCrop: true,
        allowScale: true,
        allowShadow: true,
        allowRepaint: false,
        allowGeometryChange: false,
      },
    },
    {
      id: "logo-layer",
      type: "logo",
      sourceAssetId: "logo_asset",
      zIndex: 4,
    },
  ],
};

describe("assertNoProductRepaint", () => {
  it("allows locked product and logo layers backed by source assets", () => {
    expect(() => assertNoProductRepaint(baseRequest)).not.toThrow();
  });

  it("rejects product layers without source assets", () => {
    expect(() =>
      assertNoProductRepaint({
        ...baseRequest,
        lockedLayers: [
          {
            ...baseRequest.lockedLayers[0],
            sourceAssetId: undefined,
          },
        ],
      }),
    ).toThrow("必须引用已审核真实素材");
  });

  it("rejects product layers that allow repainting", () => {
    const unsafeRequest = {
      ...baseRequest,
      lockedLayers: [
        {
          ...baseRequest.lockedLayers[0],
          lockedProductSubject: {
            ...baseRequest.lockedLayers[0].lockedProductSubject!,
            allowRepaint: true,
          },
        },
      ],
    } as unknown as ImageGenerationRequest;

    expect(() =>
      assertNoProductRepaint(unsafeRequest),
    ).toThrow("不能由图片模型重绘");
  });
});
