-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('PRODUCT_IMAGE', 'LOGO', 'DOCUMENT', 'REFERENCE_IMAGE', 'GENERATED_IMAGE', 'EXPORT_FILE');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('USER_UPLOAD', 'GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADED', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImageGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ImageGenerationMode" AS ENUM ('TEMPLATE_COMPOSITION', 'BACKGROUND_GENERATION', 'IMAGE_EDIT', 'IMAGE_EXPAND');

-- AlterTable
ALTER TABLE "ContentPackageFile" ADD COLUMN "assetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "source" "AssetSource" NOT NULL DEFAULT 'USER_UPLOAD',
    "status" "AssetStatus" NOT NULL DEFAULT 'UPLOADED',
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT,
    "originalFilename" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageGenerationProviderConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "defaultModel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGenerationProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageGenerationJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "providerConfigId" TEXT,
    "resultAssetId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT NOT NULL,
    "sourceAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "generationMode" "ImageGenerationMode" NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "status" "ImageGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentPackageFile_assetId_idx" ON "ContentPackageFile"("assetId");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_kind_status_idx" ON "Asset"("workspaceId", "kind", "status");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_productId_idx" ON "Asset"("workspaceId", "productId");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_projectId_idx" ON "Asset"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ImageGenerationProviderConfig_workspaceId_provider_idx" ON "ImageGenerationProviderConfig"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_workspaceId_status_idx" ON "ImageGenerationJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_workspaceId_projectId_idx" ON "ImageGenerationJob"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_providerConfigId_idx" ON "ImageGenerationJob"("providerConfigId");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_resultAssetId_idx" ON "ImageGenerationJob"("resultAssetId");

-- AddForeignKey
ALTER TABLE "ContentPackageFile" ADD CONSTRAINT "ContentPackageFile_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationProviderConfig" ADD CONSTRAINT "ImageGenerationProviderConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationJob" ADD CONSTRAINT "ImageGenerationJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationJob" ADD CONSTRAINT "ImageGenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationJob" ADD CONSTRAINT "ImageGenerationJob_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "ImageGenerationProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationJob" ADD CONSTRAINT "ImageGenerationJob_resultAssetId_fkey" FOREIGN KEY ("resultAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
