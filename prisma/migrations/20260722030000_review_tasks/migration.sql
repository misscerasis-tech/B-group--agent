-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReviewSubjectType" AS ENUM ('PRODUCT_FACT', 'PROJECT_STRATEGY', 'CONTENT_PACKAGE', 'ASSET');

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "subjectType" "ReviewSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerUserId" TEXT,
    "decisionNote" TEXT,
    "dueAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewTask_workspaceId_status_idx" ON "ReviewTask"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ReviewTask_workspaceId_projectId_idx" ON "ReviewTask"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ReviewTask_reviewerUserId_idx" ON "ReviewTask"("reviewerUserId");

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
