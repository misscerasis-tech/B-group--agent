import {
  AgentOperationStatus,
  AssetStatus,
  ContentPackageStatus,
  PlanItemStatus,
  ProjectStatus,
  ReminderStatus,
  ReviewTaskStatus,
  StrategyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type DashboardActionPriority = "high" | "medium" | "low";

export type DashboardActionItem = {
  id: string;
  priority: DashboardActionPriority;
  title: string;
  description: string;
  href: string;
};

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

  const upcomingDueDate = new Date();
  upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);

  const [
    recentProjects,
    recentProducts,
    openReminders,
    recentChangeLogs,
    pendingOperations,
    draftStrategies,
    pendingReviews,
    pendingAssets,
    draftPackages,
    upcomingPlanItems,
  ] = await Promise.all([
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
    prisma.agentOperation.findMany({
      where: scopedWhere(workspaceId, {
        status: AgentOperationStatus.PENDING_CONFIRMATION,
      }),
      include: {
        project: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    }),
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
      take: 3,
    }),
    prisma.reviewTask.findMany({
      where: scopedWhere(workspaceId, {
        status: ReviewTaskStatus.PENDING,
      }),
      include: {
        project: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 3,
    }),
    prisma.asset.findMany({
      where: scopedWhere(workspaceId, {
        status: AssetStatus.UPLOADED,
      }),
      include: {
        project: true,
        product: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 3,
    }),
    prisma.contentPackage.findMany({
      where: scopedWhere(workspaceId, {
        status: ContentPackageStatus.DRAFT,
      }),
      include: {
        project: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 3,
    }),
    prisma.contentPlanItem.findMany({
      where: scopedWhere(workspaceId, {
        dueDate: {
          lte: upcomingDueDate,
        },
        status: {
          not: PlanItemStatus.DONE,
        },
      }),
      include: {
        project: true,
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 3,
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
    actionItems: buildDashboardActionItems({
      pendingOperations,
      draftStrategies,
      pendingReviews,
      pendingAssets,
      draftPackages,
      upcomingPlanItems,
    }),
  };
}

export function buildDashboardActionItems(input: {
  pendingOperations: Array<{
    id: string;
    summary: string;
    projectId: string | null;
    project?: { name: string } | null;
  }>;
  draftStrategies: Array<{
    id: string;
    projectId: string;
    project: { name: string };
  }>;
  pendingReviews: Array<{
    id: string;
    title: string;
    project?: { name: string } | null;
  }>;
  pendingAssets: Array<{
    id: string;
    name: string;
    project?: { name: string } | null;
    product?: { name: string } | null;
  }>;
  draftPackages: Array<{
    id: string;
    name: string;
    project: { name: string };
  }>;
  upcomingPlanItems: Array<{
    id: string;
    title: string;
    channel: string;
    dueDate: Date | null;
    project: { name: string };
  }>;
}): DashboardActionItem[] {
  const items: DashboardActionItem[] = [
    ...input.pendingOperations.map((operation) => ({
      id: `operation-${operation.id}`,
      priority: "high" as const,
      title: "确认 Agent 变更",
      description: `${operation.project?.name ?? "当前项目"}：${operation.summary}`,
      href: operation.projectId ? `/b-agent?projectId=${operation.projectId}` : "/b-agent",
    })),
    ...input.pendingReviews.map((review) => ({
      id: `review-${review.id}`,
      priority: "high" as const,
      title: "处理审核任务",
      description: `${review.project?.name ?? "Workspace"}：${review.title}`,
      href: "/reviews",
    })),
    ...input.pendingAssets.map((asset) => ({
      id: `asset-${asset.id}`,
      priority: "high" as const,
      title: "审核真实素材",
      description: `${asset.project?.name ?? asset.product?.name ?? "素材库"}：${asset.name}`,
      href: "/assets",
    })),
    ...input.draftStrategies.map((strategy) => ({
      id: `strategy-${strategy.id}`,
      priority: "medium" as const,
      title: "确认策略草案",
      description: `${strategy.project.name} 有待确认策略，确认后才进入正式执行。`,
      href: `/b-agent?projectId=${strategy.projectId}`,
    })),
    ...input.draftPackages.map((contentPackage) => ({
      id: `package-${contentPackage.id}`,
      priority: "medium" as const,
      title: "完善素材包",
      description: `${contentPackage.project.name}：${contentPackage.name}`,
      href: "/packages",
    })),
    ...input.upcomingPlanItems.map((planItem) => ({
      id: `plan-${planItem.id}`,
      priority: "low" as const,
      title: "推进近期内容计划",
      description: `${planItem.project.name} · ${planItem.channel}：${planItem.title}${
        planItem.dueDate ? `，截止 ${planItem.dueDate.toISOString().slice(0, 10)}` : ""
      }`,
      href: "/calendar",
    })),
  ];

  if (items.length === 0) {
    return [
      {
        id: "next-package",
        priority: "low",
        title: "开启下一轮内容增长",
        description: "当前没有明显阻塞，可以进入 B组 Agent 生成下一份计划或素材包。",
        href: "/b-agent",
      },
    ];
  }

  return items.slice(0, 8);
}
