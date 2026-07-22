import {
  AgentOperationStatus,
  AssetStatus,
  ContentPackageStatus,
  ReminderStatus,
  StrategyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function getWorkspaceRecapSummary(workspaceId: string) {
  const [
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
    recentChangeLogs,
  ] = await Promise.all([
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
    },
    suggestions: buildRecapSuggestions({
      draftStrategies,
      draftPackages,
      openReminders,
      pendingAssets,
      pendingOperations,
      planItems,
    }),
    recentChangeLogs,
  };
}

function buildRecapSuggestions(input: {
  draftStrategies: number;
  draftPackages: number;
  openReminders: number;
  pendingAssets: number;
  pendingOperations: number;
  planItems: number;
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

  return suggestions.length > 0 ? suggestions : ["当前工作流没有明显阻塞，可以进入下一批素材包生成。"];
}
