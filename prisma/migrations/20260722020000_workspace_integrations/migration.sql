-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('FEISHU');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISABLED', 'NEEDS_RECONNECT');

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NEEDS_RECONNECT',
    "displayName" TEXT NOT NULL,
    "tenantDisplayName" TEXT,
    "notificationTargetName" TEXT,
    "notificationTargetExternalId" TEXT,
    "repositoryTargetName" TEXT,
    "repositoryTargetExternalId" TEXT,
    "notes" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationMigrationRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "fromTargetName" TEXT,
    "toTargetName" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationMigrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_workspaceId_provider_status_idx" ON "IntegrationConnection"("workspaceId", "provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationMigrationRecord_workspaceId_provider_createdAt_idx" ON "IntegrationMigrationRecord"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationMigrationRecord_connectionId_idx" ON "IntegrationMigrationRecord"("connectionId");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationMigrationRecord" ADD CONSTRAINT "IntegrationMigrationRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationMigrationRecord" ADD CONSTRAINT "IntegrationMigrationRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
