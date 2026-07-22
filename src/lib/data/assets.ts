import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AssetKind, AssetStatus } from "@prisma/client";
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
  projectId?: string;
  productId?: string;
  name: string;
  kind: AssetKind;
  file: File;
}) {
  if (input.file.size <= 0) {
    throw new Error("请选择要上传的素材文件。");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const safeExtension = path.extname(input.file.name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  const storedFilename = `${Date.now()}-${checksum.slice(0, 16)}${safeExtension}`;
  const relativeDir = path.join(LOCAL_ASSET_ROOT, input.workspaceId);
  const absoluteDir = path.join(process.cwd(), relativeDir);
  const relativePath = path.join(relativeDir, storedFilename);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFilename), buffer);

  return prisma.asset.create({
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
}

export async function approveAsset(workspaceId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: scopedWhere(workspaceId, {
      id: assetId,
    }),
  });

  if (!asset) {
    throw new Error("未找到当前 Workspace 下的素材。");
  }

  return prisma.asset.update({
    where: {
      id: asset.id,
    },
    data: {
      status: AssetStatus.APPROVED,
    },
  });
}
