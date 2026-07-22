-- CreateEnum
CREATE TYPE "ProductFactStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('DRAFT', 'READY', 'REVIEW_NEEDED', 'DONE');

-- CreateEnum
CREATE TYPE "ContentPackageStatus" AS ENUM ('DRAFT', 'GENERATED', 'REVIEW_NEEDED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackageFileStatus" AS ENUM ('PLANNED', 'GENERATED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ReminderSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AgentOperationStatus" AS ENUM ('APPLIED', 'PENDING_CONFIRMATION', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ProductFact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 80,
    "status" "ProductFactStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStrategy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "StrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "targetMarkets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "audiences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "contentDirections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "packageFrequency" "ContentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "positioning" TEXT,
    "rationale" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "strategyId" TEXT,
    "week" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "deliverable" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "PlanItemStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPackage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "strategyId" TEXT,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "frequency" "ContentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "status" "ContentPackageStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPackageFile" (
    "id" TEXT NOT NULL,
    "contentPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "PackageFileStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPackageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "ReminderSeverity" NOT NULL DEFAULT 'INFO',
    "status" "ReminderStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentOperation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "projectId" TEXT,
    "rawText" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "conflictCheck" TEXT,
    "status" "AgentOperationStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFact_workspaceId_productId_idx" ON "ProductFact"("workspaceId", "productId");

-- CreateIndex
CREATE INDEX "ProductFact_workspaceId_status_idx" ON "ProductFact"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ProjectStrategy_workspaceId_projectId_status_idx" ON "ProjectStrategy"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ContentPlanItem_workspaceId_projectId_status_idx" ON "ContentPlanItem"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ContentPlanItem_strategyId_idx" ON "ContentPlanItem"("strategyId");

-- CreateIndex
CREATE INDEX "ContentPackage_workspaceId_projectId_status_idx" ON "ContentPackage"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ContentPackage_strategyId_idx" ON "ContentPackage"("strategyId");

-- CreateIndex
CREATE INDEX "ContentPackageFile_contentPackageId_status_idx" ON "ContentPackageFile"("contentPackageId", "status");

-- CreateIndex
CREATE INDEX "Reminder_workspaceId_status_idx" ON "Reminder"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Reminder_workspaceId_projectId_idx" ON "Reminder"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "AgentConversation_workspaceId_projectId_idx" ON "AgentConversation"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "AgentMessage_workspaceId_conversationId_createdAt_idx" ON "AgentMessage"("workspaceId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentOperation_workspaceId_status_idx" ON "AgentOperation"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AgentOperation_workspaceId_projectId_idx" ON "AgentOperation"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ChangeLog_workspaceId_projectId_createdAt_idx" ON "ChangeLog"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_workspaceId_entityType_entityId_idx" ON "ChangeLog"("workspaceId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ProductFact" ADD CONSTRAINT "ProductFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFact" ADD CONSTRAINT "ProductFact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStrategy" ADD CONSTRAINT "ProjectStrategy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStrategy" ADD CONSTRAINT "ProjectStrategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "ProjectStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "ProjectStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackageFile" ADD CONSTRAINT "ContentPackageFile_contentPackageId_fkey" FOREIGN KEY ("contentPackageId") REFERENCES "ContentPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOperation" ADD CONSTRAINT "AgentOperation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOperation" ADD CONSTRAINT "AgentOperation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOperation" ADD CONSTRAINT "AgentOperation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
