import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import {
  AssetKind,
  AssetSource,
  AssetStatus,
  ImageGenerationMode,
  ImageGenerationStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

const LOCAL_ASSET_ROOT = "storage/assets";
const MAX_ASSET_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);
const EXPORT_EXTENSIONS = new Set([".zip", ".pdf", ".docx", ".xlsx", ".txt", ".md", ".csv"]);

export async function listWorkspaceAssets(workspaceId: string) {
  return prisma.asset.findMany({
    where: scopedWhere(workspaceId),
    include: {
      product: true,
      project: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getWorkspaceAssetForDownload(workspaceId: string, assetId: string) {
  return prisma.asset.findFirst({
    where: scopedWhere(workspaceId, {
      id: assetId,
      storagePath: {
        not: null,
      },
    }) as Prisma.AssetWhereInput,
  });
}

export async function listWorkspaceImageJobs(workspaceId: string) {
  return prisma.imageGenerationJob.findMany({
    where: scopedWhere(workspaceId),
    include: {
      project: true,
      providerConfig: true,
      resultAsset: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 12,
  });
}

export async function listWorkspaceImageProviderConfigs(workspaceId: string) {
  return prisma.imageGenerationProviderConfig.findMany({
    where: scopedWhere(workspaceId),
    orderBy: {
      provider: "asc",
    },
  });
}

export async function createTemplateCompositionJob(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  productImageAssetId: string;
  logoAssetId: string;
  aspectRatio: string;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: input.projectId,
          deletedAt: null,
        }),
      });

      if (!project) {
        throw new Error("所选项目不属于当前 Workspace。");
      }
    }

    const [productImage, logo] = await Promise.all([
      tx.asset.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: input.productImageAssetId,
          kind: AssetKind.PRODUCT_IMAGE,
          status: AssetStatus.APPROVED,
        }),
      }),
      tx.asset.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: input.logoAssetId,
          kind: AssetKind.LOGO,
          status: AssetStatus.APPROVED,
        }),
      }),
    ]);

    if (!productImage) {
      throw new Error("请选择已审核的真实产品图。");
    }

    if (!logo) {
      throw new Error("请选择已审核的官方 Logo。");
    }

    if (input.projectId) {
      await validateAssetProjectFit(tx, input.workspaceId, input.projectId, productImage);
      await validateAssetProjectFit(tx, input.workspaceId, input.projectId, logo);
    }

    const [width, height] = getCanvasSize(input.aspectRatio);
    const [productImageDataUrl, logoDataUrl] = await Promise.all([
      getAssetDataUrl(productImage),
      getAssetDataUrl(logo),
    ]);
    const job = await tx.imageGenerationJob.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        provider: "internal-template-composer",
        model: "v1-template-record",
        promptVersion: "template-composition-v1",
        sourceAssetIds: [productImage.id, logo.id],
        generationMode: ImageGenerationMode.TEMPLATE_COMPOSITION,
        aspectRatio: input.aspectRatio,
        status: ImageGenerationStatus.RUNNING,
      },
    });
    const svg = buildTemplateCompositionSvg({
      width,
      height,
      aspectRatio: input.aspectRatio,
      productName: productImage.name,
      headline: "新品内容增长素材",
      subheadline: "真实产品图 + 官方 Logo 分层合成",
      productImageDataUrl,
      logoDataUrl,
    });
    const svgBuffer = Buffer.from(svg, "utf8");
    const checksum = createHash("sha256").update(svgBuffer).digest("hex");
    const relativeDir = path.join(LOCAL_ASSET_ROOT, input.workspaceId);
    const absoluteDir = path.join(process.cwd(), relativeDir);
    const storedFilename = `${Date.now()}-${job.id}-template-composition.svg`;
    const storagePath = path.join(relativeDir, storedFilename);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, storedFilename), svgBuffer);

    const resultAsset = await tx.asset.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? productImage.projectId ?? logo.projectId ?? null,
        productId: productImage.productId ?? logo.productId ?? null,
        name: `模板化海报 ${input.aspectRatio}`,
        kind: AssetKind.GENERATED_IMAGE,
        source: AssetSource.GENERATED,
        status: AssetStatus.APPROVED,
        mimeType: "image/svg+xml",
        sizeBytes: svgBuffer.length,
        storagePath,
        originalFilename: storedFilename,
        checksum,
        metadata: {
          storageProvider: "local",
          generationMode: ImageGenerationMode.TEMPLATE_COMPOSITION,
          productSubjectLocked: true,
          layers: [
            "Background Layer",
            "Product Layer",
            "Text Layer",
            "Logo Layer",
            "Decoration Layer",
          ],
          sourceAssetIds: [productImage.id, logo.id],
        },
      },
    });
    const updatedJob = await tx.imageGenerationJob.update({
      where: {
        id: job.id,
      },
      data: {
        resultAssetId: resultAsset.id,
        status: ImageGenerationStatus.SUCCEEDED,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ImageGenerationJob",
        entityId: updatedJob.id,
        action: "template_composition_asset_created",
        summary: `生成模板化海报：${input.aspectRatio}`,
        after: {
          provider: updatedJob.provider,
          model: updatedJob.model,
          promptVersion: updatedJob.promptVersion,
          generationMode: updatedJob.generationMode,
          aspectRatio: updatedJob.aspectRatio,
          sourceAssetIds: updatedJob.sourceAssetIds,
          status: updatedJob.status,
          resultAssetId: resultAsset.id,
        },
        actorUserId: input.userId,
      },
    });

    return updatedJob;
  });
}

export async function createUploadedAsset(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  productId?: string;
  name: string;
  kind: AssetKind;
  file: File;
}) {
  validateAssetFile(input.kind, input.file);
  await validateAssetRelations(input.workspaceId, input.projectId, input.productId);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const safeExtension = path.extname(input.file.name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  const storedFilename = `${Date.now()}-${checksum.slice(0, 16)}${safeExtension}`;
  const relativeDir = path.join(LOCAL_ASSET_ROOT, input.workspaceId);
  const absoluteDir = path.join(process.cwd(), relativeDir);
  const relativePath = path.join(relativeDir, storedFilename);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFilename), buffer);

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId || null,
        productId: input.productId || null,
        name: input.name,
        kind: input.kind,
        status: AssetStatus.UPLOADED,
        mimeType: input.file.type || null,
        sizeBytes: input.file.size,
        storagePath: relativePath,
        originalFilename: input.file.name,
        checksum,
        metadata: {
          storageProvider: "local",
          productSubjectLocked:
            input.kind === AssetKind.PRODUCT_IMAGE || input.kind === AssetKind.LOGO,
        },
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Asset",
        entityId: asset.id,
        action: "asset_uploaded",
        summary: `上传素材：${asset.name}`,
        after: {
          kind: asset.kind,
          status: asset.status,
          productId: asset.productId,
          projectId: asset.projectId,
        },
        actorUserId: input.userId,
      },
    });

    await tx.reviewTask.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId || null,
        subjectType: ReviewSubjectType.ASSET,
        subjectId: asset.id,
        title: `审核素材：${asset.name}`,
        description: buildAssetReviewDescription(asset.kind, asset.originalFilename),
        status: ReviewTaskStatus.PENDING,
      },
    });

    return asset;
  });
}

export function validateAssetFile(
  kind: AssetKind,
  file: {
    name: string;
    type: string;
    size: number;
  },
) {
  if (file.size <= 0) {
    throw new Error("请选择要上传的素材文件。");
  }

  if (file.size > MAX_ASSET_UPLOAD_BYTES) {
    throw new Error("素材文件不能超过 20MB。");
  }

  const extension = path.extname(file.name).toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (isImageAssetKind(kind) && !isAllowedImageFile(extension, mimeType)) {
    throw new Error("真实产品图、官方 Logo 和参考图必须上传图片文件。");
  }

  if (kind === AssetKind.DOCUMENT && !isAllowedDocumentFile(extension, mimeType)) {
    throw new Error("产品资料仅支持 PDF、Office、TXT、Markdown 或表格文件。");
  }

  if (kind === AssetKind.EXPORT_FILE && !isAllowedExportFile(extension, mimeType)) {
    throw new Error("导出文件仅支持 ZIP、PDF、Office、TXT、Markdown 或表格文件。");
  }
}

export function resolveLocalAssetPath(storagePath: string) {
  const root = path.resolve(process.cwd(), LOCAL_ASSET_ROOT);
  const absolutePath = path.resolve(process.cwd(), storagePath);

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("素材文件路径不在本地素材库目录内。");
  }

  return absolutePath;
}

export function buildTemplateCompositionSvg(input: {
  width: number;
  height: number;
  aspectRatio: string;
  productName: string;
  headline: string;
  subheadline: string;
  productImageDataUrl: string;
  logoDataUrl: string;
}) {
  const margin = Math.round(input.width * 0.07);
  const productBoxWidth = Math.round(input.width * 0.48);
  const productBoxHeight = Math.round(input.height * 0.58);
  const productX = input.width - margin - productBoxWidth;
  const productY = Math.round(input.height * 0.22);
  const textX = margin;
  const textY = Math.round(input.height * 0.28);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-label="${escapeXml(input.productName)} 模板化海报">
  <g id="background-layer">
    <rect width="100%" height="100%" fill="#f7f8fb"/>
    <rect x="${margin}" y="${margin}" width="${input.width - margin * 2}" height="${input.height - margin * 2}" fill="#ffffff" stroke="#d9dee8" stroke-width="3"/>
  </g>
  <g id="decoration-layer">
    <path d="M ${margin} ${input.height - margin * 1.6} H ${input.width - margin}" stroke="#6fb1a5" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${margin} ${input.height - margin * 1.25} H ${input.width - margin * 2.8}" stroke="#f0b35a" stroke-width="8" stroke-linecap="round"/>
  </g>
  <g id="logo-layer">
    <image href="${input.logoDataUrl}" x="${margin}" y="${margin}" width="${Math.round(input.width * 0.18)}" height="${Math.round(input.height * 0.08)}" preserveAspectRatio="xMinYMid meet"/>
  </g>
  <g id="text-layer" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" fill="#1d2433">
    <text x="${textX}" y="${textY}" font-size="${Math.round(input.width * 0.06)}" font-weight="700">${escapeXml(input.headline)}</text>
    <text x="${textX}" y="${textY + Math.round(input.width * 0.08)}" font-size="${Math.round(input.width * 0.032)}" fill="#4b5565">${escapeXml(input.subheadline)}</text>
    <text x="${textX}" y="${textY + Math.round(input.width * 0.14)}" font-size="${Math.round(input.width * 0.03)}" fill="#657083">比例 ${escapeXml(input.aspectRatio)} · Product Layer 已锁定真实素材</text>
  </g>
  <g id="product-layer" data-product-subject-locked="true" data-allow-repaint="false" data-allow-geometry-change="false">
    <image href="${input.productImageDataUrl}" x="${productX}" y="${productY}" width="${productBoxWidth}" height="${productBoxHeight}" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>`;
}

function getCanvasSize(aspectRatio: string): [number, number] {
  if (aspectRatio === "1:1") {
    return [1080, 1080];
  }

  if (aspectRatio === "9:16") {
    return [1080, 1920];
  }

  if (aspectRatio === "16:9") {
    return [1600, 900];
  }

  return [1080, 1350];
}

async function getAssetDataUrl(asset: {
  storagePath: string | null;
  mimeType: string | null;
  name: string;
}) {
  if (!asset.storagePath) {
    throw new Error(`素材“${asset.name}”缺少本地文件路径。`);
  }

  if (!asset.mimeType?.startsWith("image/")) {
    throw new Error(`素材“${asset.name}”不是可用于海报图层的图片文件。`);
  }

  const file = await readFile(resolveLocalAssetPath(asset.storagePath));
  return `data:${asset.mimeType};base64,${file.toString("base64")}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isImageAssetKind(kind: AssetKind) {
  return (
    kind === AssetKind.PRODUCT_IMAGE ||
    kind === AssetKind.LOGO ||
    kind === AssetKind.REFERENCE_IMAGE ||
    kind === AssetKind.GENERATED_IMAGE
  );
}

function isAllowedImageFile(extension: string, mimeType: string) {
  return mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
}

function isAllowedDocumentFile(extension: string, mimeType: string) {
  return (
    DOCUMENT_EXTENSIONS.has(extension) ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType.includes("officedocument") ||
    mimeType.includes("msword") ||
    mimeType.includes("ms-excel") ||
    mimeType.includes("ms-powerpoint")
  );
}

function isAllowedExportFile(extension: string, mimeType: string) {
  return (
    EXPORT_EXTENSIONS.has(extension) ||
    mimeType === "application/zip" ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType.includes("officedocument")
  );
}

async function validateAssetProjectFit(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectId: string,
  asset: {
    projectId: string | null;
    productId: string | null;
    name: string;
  },
) {
  if (asset.projectId === projectId) {
    return;
  }

  if (!asset.productId) {
    return;
  }

  const projectProduct = await tx.projectProduct.findUnique({
    where: {
      projectId_productId: {
        projectId,
        productId: asset.productId,
      },
    },
  });

  if (!projectProduct) {
    throw new Error(`素材“${asset.name}”未关联到当前项目或项目产品。`);
  }
}

export async function approveAsset(workspaceId: string, userId: string, assetId: string) {
  return updateAssetStatus(workspaceId, userId, assetId, AssetStatus.APPROVED);
}

export async function rejectAsset(workspaceId: string, userId: string, assetId: string) {
  return updateAssetStatus(workspaceId, userId, assetId, AssetStatus.REJECTED);
}

async function validateAssetRelations(
  workspaceId: string,
  projectId?: string,
  productId?: string,
) {
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: scopedWhere(workspaceId, {
        id: projectId,
        deletedAt: null,
      }),
    });

    if (!project) {
      throw new Error("所选项目不属于当前 Workspace。");
    }
  }

  if (productId) {
    const product = await prisma.product.findFirst({
      where: scopedWhere(workspaceId, {
        id: productId,
        deletedAt: null,
      }),
    });

    if (!product) {
      throw new Error("所选产品不属于当前 Workspace。");
    }
  }

  if (projectId && productId) {
    const projectProduct = await prisma.projectProduct.findUnique({
      where: {
        projectId_productId: {
          projectId,
          productId,
        },
      },
    });

    if (!projectProduct) {
      throw new Error("所选产品尚未关联到所选项目，请先在项目详情中建立关联。");
    }
  }
}

async function updateAssetStatus(
  workspaceId: string,
  userId: string,
  assetId: string,
  status: AssetStatus,
) {
  const asset = await prisma.asset.findFirst({
    where: scopedWhere(workspaceId, {
      id: assetId,
    }),
  });

  if (!asset) {
    throw new Error("未找到当前 Workspace 下的素材。");
  }

  return prisma.$transaction(async (tx) => {
    const updatedAsset = await tx.asset.update({
      where: {
        id: asset.id,
      },
      data: {
        status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        projectId: asset.projectId,
        entityType: "Asset",
        entityId: asset.id,
        action: status === AssetStatus.APPROVED ? "asset_approved" : "asset_rejected",
        summary:
          status === AssetStatus.APPROVED
            ? `审核通过素材：${asset.name}`
            : `拒绝素材：${asset.name}`,
        before: {
          status: asset.status,
        },
        after: {
          status: updatedAsset.status,
        },
        actorUserId: userId,
      },
    });

    await tx.reviewTask.updateMany({
      where: {
        workspaceId,
        subjectType: ReviewSubjectType.ASSET,
        subjectId: asset.id,
        status: ReviewTaskStatus.PENDING,
      },
      data: {
        status:
          status === AssetStatus.APPROVED
            ? ReviewTaskStatus.APPROVED
            : ReviewTaskStatus.CHANGES_REQUESTED,
        reviewerUserId: userId,
        decisionNote:
          status === AssetStatus.APPROVED
            ? "已在素材库直接标记为已审核。"
            : "已在素材库直接拒绝素材。",
        decidedAt: new Date(),
      },
    });

    return updatedAsset;
  });
}

function buildAssetReviewDescription(kind: AssetKind, originalFilename: string | null) {
  const filename = originalFilename ?? "无原始文件名";

  if (kind === AssetKind.PRODUCT_IMAGE) {
    return `${filename}。真实产品图必须确认来源、产品结构、颜色和比例，禁止 AI 重绘产品主体。`;
  }

  if (kind === AssetKind.LOGO) {
    return `${filename}。官方 Logo 必须确认来源和版本，禁止静默替换或由图片模型重绘。`;
  }

  return `${filename}。请确认素材来源、用途和是否允许进入正式素材包。`;
}
