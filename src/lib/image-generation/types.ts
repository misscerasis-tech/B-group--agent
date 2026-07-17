export type ImageGenerationMode =
  | "template_composition"
  | "background_generation"
  | "image_edit"
  | "image_expand";

export type ImageGenerationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PosterLayerType =
  | "background"
  | "product"
  | "text"
  | "logo"
  | "decoration";

export type ImageGenerationMetadata = {
  provider: string;
  model: string;
  promptVersion: string;
  sourceAssetIds: string[];
  generationMode: ImageGenerationMode;
  aspectRatio: string;
  createdAt: Date;
  status: ImageGenerationStatus;
  error?: string;
};

export type ProductSubjectLock = {
  sourceAssetId: string;
  locked: true;
  allowCrop: boolean;
  allowScale: boolean;
  allowShadow: boolean;
  allowRepaint: false;
  allowGeometryChange: false;
};

export type PosterLayerReference = {
  id: string;
  type: PosterLayerType;
  sourceAssetId?: string;
  zIndex: number;
  lockedProductSubject?: ProductSubjectLock;
};

