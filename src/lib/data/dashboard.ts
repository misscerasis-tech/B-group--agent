import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function getDashboardSummary(workspaceId: string) {
  const [projectCount, productCount, activeProjectCount, recentProjects, recentProducts] =
    await Promise.all([
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
    ]);

  return {
    projectCount,
    productCount,
    activeProjectCount,
    recentProjects,
    recentProducts,
  };
}
