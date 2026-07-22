import {
  AgentOperationStatus,
  AssetStatus,
  ContentPackageStatus,
  Prisma,
  ReminderStatus,
  StrategyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function getWorkspaceRecapSummary(workspaceId: string) {
  const [
    projects,
    confirmedStrategies,
    draftStrategies,
    planItems,
    draftPackages,
    approvedPackages,
    openReminders,
    approvedAssets,
    pendingAssets,
    appliedOperations,
    pendingOperations,
    metricsAggregate,
    recentMetrics,
    recentChangeLogs,
  ] = await Promise.all([
    prisma.project.findMany({
      where: scopedWhere(workspaceId, {
        deletedAt: null,
      }),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.projectStrategy.count({
      where: scopedWhere(workspaceId, {
        status: StrategyStatus.CONFIRMED,
      }),
    }),
    prisma.projectStrategy.count({
      where: scopedWhere(workspaceId, {
        status: StrategyStatus.DRAFT,
      }),
    }),
    prisma.contentPlanItem.count({
      where: scopedWhere(workspaceId),
    }),
    prisma.contentPackage.count({
      where: scopedWhere(workspaceId, {
        status: ContentPackageStatus.DRAFT,
      }),
    }),
    prisma.contentPackage.count({
      where: scopedWhere(workspaceId, {
        status: ContentPackageStatus.APPROVED,
      }),
    }),
    prisma.reminder.count({
      where: scopedWhere(workspaceId, {
        status: ReminderStatus.OPEN,
      }),
    }),
    prisma.asset.count({
      where: scopedWhere(workspaceId, {
        status: AssetStatus.APPROVED,
      }),
    }),
    prisma.asset.count({
      where: scopedWhere(workspaceId, {
        status: AssetStatus.UPLOADED,
      }),
    }),
    prisma.agentOperation.count({
      where: scopedWhere(workspaceId, {
        status: AgentOperationStatus.APPLIED,
      }),
    }),
    prisma.agentOperation.count({
      where: scopedWhere(workspaceId, {
        status: AgentOperationStatus.PENDING_CONFIRMATION,
      }),
    }),
    prisma.metricsSnapshot.aggregate({
      where: scopedWhere(workspaceId),
      _count: {
        _all: true,
      },
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        spendCents: true,
      },
    }),
    prisma.metricsSnapshot.findMany({
      where: scopedWhere(workspaceId),
      include: {
        project: true,
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 8,
    }),
    prisma.changeLog.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
  ]);

  return {
    metrics: {
      confirmedStrategies,
      draftStrategies,
      planItems,
      draftPackages,
      approvedPackages,
      openReminders,
      approvedAssets,
      pendingAssets,
      appliedOperations,
      pendingOperations,
      metricSnapshots: metricsAggregate._count._all,
      impressions: metricsAggregate._sum.impressions ?? 0,
      clicks: metricsAggregate._sum.clicks ?? 0,
      conversions: metricsAggregate._sum.conversions ?? 0,
      spendCents: metricsAggregate._sum.spendCents ?? 0,
    },
    suggestions: buildRecapSuggestions({
      draftStrategies,
      draftPackages,
      openReminders,
      pendingAssets,
      pendingOperations,
      planItems,
      metricSnapshots: metricsAggregate._count._all,
      conversions: metricsAggregate._sum.conversions ?? 0,
    }),
    projects,
    recentMetrics,
    recentChangeLogs,
  };
}

export async function createMetricsSnapshot(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  period: string;
  channel: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
    });

    if (!project) {
      throw new Error("未找到当前 Workspace 下的项目，无法录入指标。");
    }

    const metricsSnapshot = await tx.metricsSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        period: input.period,
        channel: input.channel,
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        spendCents: input.spendCents,
        notes: input.notes,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        entityType: "MetricsSnapshot",
        entityId: metricsSnapshot.id,
        action: "metrics_snapshot_created",
        summary: `录入 ${project.name} ${input.period} ${input.channel} 指标。`,
        after: metricsSnapshotToJson(metricsSnapshot),
        actorUserId: input.userId,
      },
    });

    return metricsSnapshot;
  });
}

function buildRecapSuggestions(input: {
  draftStrategies: number;
  draftPackages: number;
  openReminders: number;
  pendingAssets: number;
  pendingOperations: number;
  planItems: number;
  metricSnapshots: number;
  conversions: number;
}) {
  const suggestions: string[] = [];

  if (input.draftStrategies > 0) {
    suggestions.push("仍有策略草案待人工确认，建议先进入审核中心锁定正式策略。");
  }

  if (input.pendingOperations > 0) {
    suggestions.push("存在待确认的中文指令变更，建议回到 B组 Agent 检查冲突后再应用。");
  }

  if (input.pendingAssets > 0) {
    suggestions.push("有素材尚未审核，正式海报前请先完成产品图和 Logo 来源检查。");
  }

  if (input.draftPackages > 0) {
    suggestions.push("已有素材包结构但仍是草稿，建议推进文件生成和审核。");
  }

  if (input.openReminders > 0) {
    suggestions.push("当前有待处理提醒，优先处理活动规则、奖品和合规说明。");
  }

  if (input.planItems === 0) {
    suggestions.push("还没有内容计划，建议从 B组 Agent 生成首月计划。");
  }

  if (input.metricSnapshots === 0) {
    suggestions.push("还没有表现数据，建议先手动录入一个渠道周期数据，后续再接平台 API。");
  } else if (input.conversions === 0) {
    suggestions.push("已有曝光/点击数据但暂无转化，建议复查 CTA、落地页或促销机制。");
  }

  return suggestions.length > 0 ? suggestions : ["当前工作流没有明显阻塞，可以进入下一批素材包生成。"];
}

function metricsSnapshotToJson(metricsSnapshot: {
  id: string;
  period: string;
  channel: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  notes: string | null;
}) {
  return {
    id: metricsSnapshot.id,
    period: metricsSnapshot.period,
    channel: metricsSnapshot.channel,
    impressions: metricsSnapshot.impressions,
    clicks: metricsSnapshot.clicks,
    conversions: metricsSnapshot.conversions,
    spendCents: metricsSnapshot.spendCents,
    notes: metricsSnapshot.notes,
  } satisfies Prisma.JsonObject;
}
