import { ProjectStatus, ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function getDashboardSummary(workspaceId: string) {
  const [
    projectCount,
    productCount,
    activeProjectCount,
    planItemCount,
    contentPackageCount,
    openReminderCount,
  ] = await Promise.all([
    prisma.project.count({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
      }),
    }),
    prisma.product.count({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
      }),
    }),
    prisma.project.count({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
        status: ProjectStatus.ACTIVE,
      }),
    }),
    prisma.contentPlanItem.count({
      where: scopedWhere(workspaceId),
    }),
    prisma.contentPackage.count({
      where: scopedWhere(workspaceId),
    }),
    prisma.reminder.count({
      where: scopedWhere(workspaceId, {
        status: ReminderStatus.OPEN,
      }),
    }),
  ]);

  const [recentProjects, recentProducts, openReminders, recentChangeLogs] = await Promise.all([
    prisma.project.findMany({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
      }),
      take: 4,
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.product.findMany({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
      }),
      take: 4,
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.reminder.findMany({
      where: scopedWhere(workspaceId, {
        status: ReminderStatus.OPEN,
      }),
      include: {
        project: true,
      },
      orderBy: [
        {
          severity: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 4,
    }),
    prisma.changeLog.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  return {
    projectCount,
    productCount,
    activeProjectCount,
    planItemCount,
    contentPackageCount,
    openReminderCount,
    recentProjects,
    recentProducts,
    openReminders,
    recentChangeLogs,
  };
}
