import type {
  ImageGenerationMetadata,
  ImageGenerationMode,
  PosterLayerReference,
} from "@/lib/image-generation/types";

export type ImageGenerationRequest = {
  workspaceId: string;
  prompt: string;
  promptVersion: string;
  mode: ImageGenerationMode;
  aspectRatio: string;
  sourceAssetIds: string[];
  lockedLayers: PosterLayerReference[];
};

export type ImageGenerationResult = {
  metadata: ImageGenerationMetadata;
  outputAssetId?: string;
  previewUrl?: string;
};

export interface ImageGenerationProvider {
  readonly providerKey: string;
  readonly displayName: string;
  supports(mode: ImageGenerationMode): boolean;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export function assertNoProductRepaint(request: ImageGenerationRequest) {
  const missingSourceAssetLayer = request.lockedLayers.find(
    (layer) => (layer.type === "product" || layer.type === "logo") && !layer.sourceAssetId,
  );

  if (missingSourceAssetLayer) {
    throw new Error("正式产品图和 Logo 必须引用已审核真实素材。");
  }

  const repaintableProductLayer = request.lockedLayers.find(
    (layer) =>
      layer.type === "product" &&
      (!layer.lockedProductSubject ||
        layer.lockedProductSubject.allowRepaint !== false ||
        layer.lockedProductSubject.allowGeometryChange !== false),
  );

  if (repaintableProductLayer) {
    throw new Error("正式产品图必须启用产品主体锁定，不能由图片模型重绘或改变结构。");
  }
}
