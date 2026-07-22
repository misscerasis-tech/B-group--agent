import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AssetKind, AssetStatus, ReviewSubjectType, ReviewTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

const LOCAL_ASSET_ROOT = "storage/assets";

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

export async function createUploadedAsset(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  productId?: string;
  name: string;
  kind: AssetKind;
  file: File;
}) {
  if (input.file.size <= 0) {
    throw new Error("请选择要上传的素材文件。");
  }

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
