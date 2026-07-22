import {
  ContentPackageStatus,
  PlanItemStatus,
  ReminderSeverity,
  ReminderStatus,
  type ContentFrequency,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type DailyBriefInput = {
  workspaceName: string;
  generatedPackages: Array<{
    id: string;
    name: string;
    period: string;
    frequency: ContentFrequency;
    status: ContentPackageStatus;
    project: {
      name: string;
    };
  }>;
  upcomingPlanItems: Array<{
    id: string;
    title: string;
    channel: string;
    theme: string;
    deliverable: string;
    dueDate: Date | null;
    project: {
      name: string;
    };
  }>;
  openReminders: Array<{
    id: string;
    title: string;
    severity: ReminderSeverity;
    dueAt: Date | null;
    project?: {
      name: string;
    } | null;
  }>;
  recentMetrics: Array<{
    id: string;
    period: string;
    channel: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spendCents: number;
    project: {
      name: string;
    };
  }>;
};

export type DailyBrief = {
  title: string;
  summary: string;
  highlights: string[];
  risks: string[];
  nextActions: string[];
  generatedAt: Date;
};

export async function getWorkspaceDailyBrief(workspaceId: string) {
  const now = new Date();
  const upcomingDueDate = new Date(now);
  upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);

  const [workspace, generatedPackages, upcomingPlanItems, openReminders, recentMetrics] =
    await Promise.all([
      prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          deletedAt: null,
        },
        select: {
          name: true,
        },
      }),
      prisma.contentPackage.findMany({
        where: scopedWhere(workspaceId, {
          status: {
            in: [
              ContentPackageStatus.GENERATED,
              ContentPackageStatus.REVIEW_NEEDED,
              ContentPackageStatus.APPROVED,
            ],
          },
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
        take: 5,
      }),
      prisma.reminder.findMany({
        where: scopedWhere(workspaceId, {
          status: ReminderStatus.OPEN,
        }),
        include: {
          project: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
      prisma.metricsSnapshot.findMany({
        where: scopedWhere(workspaceId),
        include: {
          project: true,
        },
        orderBy: {
          capturedAt: "desc",
        },
        take: 5,
      }),
    ]);

  return buildDailyBrief(
    {
      workspaceName: workspace?.name ?? "当前 Workspace",
      generatedPackages,
      upcomingPlanItems,
      openReminders,
      recentMetrics,
    },
    now,
  );
}

export function buildDailyBrief(input: DailyBriefInput, generatedAt = new Date()): DailyBrief {
  const generatedPackageCount = input.generatedPackages.length;
  const upcomingPlanCount = input.upcomingPlanItems.length;
  const openReminderCount = input.openReminders.length;
  const topMetric = pickTopMetric(input.recentMetrics);
  const highSeverityReminders = input.openReminders.filter(
    (reminder) =>
      reminder.severity === ReminderSeverity.CRITICAL ||
      reminder.severity === ReminderSeverity.WARNING,
  );

  const summaryParts = [
    `${input.workspaceName} 今天有 ${upcomingPlanCount} 条近期内容计划`,
    `${openReminderCount} 条待处理提醒`,
    `${generatedPackageCount} 个已生成或待审核素材包`,
  ];

  const highlights = [
    buildPackageHighlight(input.generatedPackages),
    buildPlanHighlight(input.upcomingPlanItems),
    topMetric ? buildMetricHighlight(topMetric) : null,
  ].filter(Boolean) as string[];

  const risks = [
    ...sortRemindersBySeverity(highSeverityReminders)
      .slice(0, 3)
      .map((reminder) => {
        const projectName = reminder.project?.name ?? "Workspace";
        return `${severityLabels[reminder.severity]}：${projectName} · ${reminder.title}`;
      }),
    ...buildMetricRisks(input.recentMetrics),
  ].slice(0, 4);

  const nextActions = [
    input.openReminders[0]
      ? `先处理提醒：${input.openReminders[0].project?.name ?? "Workspace"} · ${input.openReminders[0].title}`
      : null,
    input.upcomingPlanItems[0]
      ? `推进内容计划：${input.upcomingPlanItems[0].project.name} · ${input.upcomingPlanItems[0].channel} · ${input.upcomingPlanItems[0].title}`
      : null,
    input.generatedPackages[0]
      ? `检查素材包：${input.generatedPackages[0].project.name} · ${input.generatedPackages[0].name}`
      : null,
    generatedPackageCount === 0 ? "进入 B组 Agent 生成首月计划和第一份素材包结构。" : null,
  ].filter(Boolean) as string[];

  return {
    title: `${formatShortDate(generatedAt)} Agent 工作简报`,
    summary: `${summaryParts.join("，")}。`,
    highlights:
      highlights.length > 0
        ? highlights
        : ["当前没有新的素材包、计划或复盘数据，可以从项目中心选择一个项目继续推进。"],
    risks: risks.length > 0 ? risks : ["暂无明显风险；继续保持素材、策略和计划的审核节奏。"],
    nextActions:
      nextActions.length > 0 ? nextActions.slice(0, 4) : ["进入 B组 Agent，创建或更新下一轮内容增长计划。"],
    generatedAt,
  };
}

function buildPackageHighlight(packages: DailyBriefInput["generatedPackages"]) {
  if (packages.length === 0) {
    return null;
  }

  const latestPackage = packages[0];
  return `最近素材包：${latestPackage.project.name} · ${latestPackage.name}（${latestPackage.period}，${contentPackageStatusLabels[latestPackage.status]}）。`;
}

function buildPlanHighlight(planItems: DailyBriefInput["upcomingPlanItems"]) {
  if (planItems.length === 0) {
    return null;
  }

  const channels = Array.from(new Set(planItems.map((item) => item.channel))).slice(0, 4);
  return `未来 7 天有 ${planItems.length} 条内容计划待推进，覆盖 ${channels.join("、")}。`;
}

function buildMetricHighlight(metric: DailyBriefInput["recentMetrics"][number]) {
  const ctr = metric.impressions > 0 ? metric.clicks / metric.impressions : 0;
  return `${metric.project.name} ${metric.period} ${metric.channel} 近期 CTR ${formatPercent(ctr)}，转化 ${metric.conversions}。`;
}

function buildMetricRisks(metrics: DailyBriefInput["recentMetrics"]) {
  return metrics
    .filter(
      (metric) =>
        (metric.impressions >= 1000 && metric.clicks / Math.max(metric.impressions, 1) < 0.005) ||
        (metric.clicks >= 50 && metric.conversions === 0) ||
        (metric.spendCents > 0 && metric.conversions === 0),
    )
    .slice(0, 2)
    .map((metric) => `${metric.project.name} · ${metric.channel} 有流量但转化偏弱，需要复查落地页、受众或素材钩子。`);
}

function pickTopMetric(metrics: DailyBriefInput["recentMetrics"]) {
  if (metrics.length === 0) {
    return null;
  }

  return [...metrics].sort((left, right) => {
    const leftCtr = left.impressions > 0 ? left.clicks / left.impressions : 0;
    const rightCtr = right.impressions > 0 ? right.clicks / right.impressions : 0;
    return rightCtr - leftCtr || right.conversions - left.conversions;
  })[0];
}

function sortRemindersBySeverity(reminders: DailyBriefInput["openReminders"]) {
  return [...reminders].sort(
    (left, right) =>
      severityRank[right.severity] - severityRank[left.severity] ||
      (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const severityRank: Record<ReminderSeverity, number> = {
  INFO: 1,
  WARNING: 2,
  CRITICAL: 3,
};

const severityLabels: Record<ReminderSeverity, string> = {
  INFO: "提示",
  WARNING: "风险",
  CRITICAL: "紧急",
};

const contentPackageStatusLabels: Record<ContentPackageStatus, string> = {
  DRAFT: "草稿",
  GENERATED: "已生成",
  REVIEW_NEEDED: "需审核",
  APPROVED: "已通过",
  ARCHIVED: "已归档",
};
