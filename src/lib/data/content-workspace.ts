import { ContentPackageStatus, StrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function listWorkspacePlanItems(workspaceId: string) {
  return prisma.contentPlanItem.findMany({
    where: scopedWhere(workspaceId),
    include: {
      project: true,
      strategy: true,
    },
    orderBy: [
      {
        projectId: "asc",
      },
      {
        week: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
}

export async function listWorkspaceContentPackages(workspaceId: string) {
  return prisma.contentPackage.findMany({
    where: scopedWhere(workspaceId),
    include: {
      project: true,
      files: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function listWorkspaceReminders(workspaceId: string) {
  return prisma.reminder.findMany({
    where: scopedWhere(workspaceId),
    include: {
      project: true,
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        severity: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function getWorkspaceReviewQueue(workspaceId: string) {
  const [strategyDrafts, packageReviews] = await Promise.all([
    prisma.projectStrategy.findMany({
      where: scopedWhere(workspaceId, {
        status: StrategyStatus.DRAFT,
      }),
      include: {
        project: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.contentPackage.findMany({
      where: scopedWhere(workspaceId, {
        status: {
          in: [ContentPackageStatus.DRAFT, ContentPackageStatus.REVIEW_NEEDED],
        },
      }),
      include: {
        project: true,
        files: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  return {
    strategyDrafts,
    packageReviews,
  };
}
