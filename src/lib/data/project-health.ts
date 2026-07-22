import {
  AssetKind,
  AssetStatus,
  ContentPackageStatus,
  PlanItemStatus,
  ProductFactStatus,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  ReviewTaskStatus,
  StrategyStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProjectHealthRating = "READY" | "NEEDS_ATTENTION" | "BLOCKED";
export type ProjectHealthSignalStatus = "complete" | "warning" | "missing";

export type ProjectHealthSignal = {
  key: string;
  label: string;
  status: ProjectHealthSignalStatus;
  summary: string;
  action: string;
  href: string;
  blocking: boolean;
  score: number;
  maxScore: number;
};

export type ProjectHealthInput = {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
  linkedProductCount: number;
  confirmedFactCount: number;
  draftFactCount: number;
  confirmedStrategyCount: number;
  draftStrategyCount: number;
  totalPlanItemCount: number;
  readyPlanItemCount: number;
  contentPackageCount: number;
  generatedPackageCount: number;
  pendingReviewCount: number;
  approvedProductImageCount: number;
  approvedLogoCount: number;
  metricsSnapshotCount: number;
  openReminderCount: number;
};

export type ProjectHealthSummary = {
  projectId: string;
  projectName: string;
  rating: ProjectHealthRating;
  score: number;
  summary: string;
  signals: ProjectHealthSignal[];
  nextActions: ProjectHealthSignal[];
};

export type ProjectHealthReminderDraft = {
  signalKey: string;
  title: string;
  description: string;
  severity: ReminderSeverity;
  dueInDays: number;
};

export async function getProjectHealthSummary(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: scopedWhere(workspaceId, {
      id: projectId,
      deletedAt: null,
    }),
    select: {
      id: true,
      name: true,
      status: true,
      projectProducts: {
        select: {
          productId: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  return buildProjectHealthSummary(await collectProjectHealthInput(prisma, workspaceId, project));
}

export async function getProjectHealthSummaries(workspaceId: string, take = 4) {
  const projects = await prisma.project.findMany({
    where: scopedWhere(workspaceId, {
      deletedAt: null,
      status: {
        not: ProjectStatus.ARCHIVED,
      },
    }) as Prisma.ProjectWhereInput,
    select: {
      id: true,
      name: true,
      status: true,
      projectProducts: {
        select: {
          productId: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take,
  });

  return Promise.all(
    projects.map(async (project) =>
      buildProjectHealthSummary(await collectProjectHealthInput(prisma, workspaceId, project)),
    ),
  );
}

export async function createProjectHealthReminders(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
}) {
  const health = await getProjectHealthSummary(input.workspaceId, input.projectId);

  if (!health) {
    throw new Error("未找到当前 Workspace 下的项目，无法生成缺口提醒。");
  }

  const drafts = buildProjectHealthReminderDrafts(health);

  return prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let skippedCount = 0;

    for (const draft of drafts) {
      const existingReminder = await tx.reminder.findFirst({
        where: scopedWhere(input.workspaceId, {
          projectId: input.projectId,
          title: draft.title,
          status: ReminderStatus.OPEN,
        }) as Prisma.ReminderWhereInput,
      });

      if (existingReminder) {
        skippedCount += 1;
        continue;
      }

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + draft.dueInDays);

      const reminder = await tx.reminder.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          title: draft.title,
          description: draft.description,
          severity: draft.severity,
          status: ReminderStatus.OPEN,
          dueAt,
        },
      });

      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          entityType: "Reminder",
          entityId: reminder.id,
          action: "project_health_reminder_created",
          summary: `项目体检生成提醒：${draft.title}`,
          after: {
            id: reminder.id,
            signalKey: draft.signalKey,
            title: reminder.title,
            description: reminder.description,
            severity: reminder.severity,
            status: reminder.status,
            dueAt: reminder.dueAt,
          },
          actorUserId: input.userId,
        },
      });

      createdCount += 1;
    }

    return {
      createdCount,
      skippedCount,
      totalCandidates: drafts.length,
    };
  });
}

export function buildProjectHealthSummary(input: ProjectHealthInput): ProjectHealthSummary {
  const projectHref = `/projects/${input.project.id}`;
  const agentHref = `/b-agent?projectId=${input.project.id}`;
  const signals: ProjectHealthSignal[] = [
    buildProjectStatusSignal(input, projectHref),
    buildProductSignal(input, projectHref),
    buildProductFactSignal(input, "/brain"),
    buildStrategySignal(input, agentHref),
    buildPlanSignal(input, "/calendar"),
    buildPackageSignal(input, "/packages"),
    buildAssetSignal(input, "/assets"),
    buildReviewSignal(input, "/reviews"),
    buildMetricsSignal(input, "/recaps"),
    buildReminderSignal(input, "/reminders"),
  ];
  const rawScore = signals.reduce((total, signal) => total + signal.score, 0);
  const maxScore = signals.reduce((total, signal) => total + signal.maxScore, 0);
  const score = Math.round((rawScore / maxScore) * 100);
  const blockingGapCount = signals.filter(
    (signal) => signal.blocking && signal.status !== "complete",
  ).length;
  const missingBlockingCount = signals.filter(
    (signal) => signal.blocking && signal.status === "missing",
  ).length;
  const rating = inferProjectHealthRating(score, blockingGapCount, missingBlockingCount);
  const nextActions = signals
    .filter((signal) => signal.status !== "complete")
    .sort(compareProjectHealthActions)
    .slice(0, 4);

  return {
    projectId: input.project.id,
    projectName: input.project.name,
    rating,
    score,
    summary: buildProjectHealthSummaryText(rating, score, nextActions),
    signals,
    nextActions,
  };
}

export function buildProjectHealthReminderDrafts(
  health: ProjectHealthSummary,
  limit = 4,
): ProjectHealthReminderDraft[] {
  return health.nextActions.slice(0, limit).map((action) => ({
    signalKey: action.key,
    title: `${health.projectName}：${action.action}`,
    description: `${action.summary} 来源：项目就绪度体检。处理后请回到项目详情页重新查看评分。`,
    severity: action.blocking ? ReminderSeverity.WARNING : ReminderSeverity.INFO,
    dueInDays: action.blocking ? 3 : 7,
  }));
}

export async function collectProjectHealthInput(
  client: Prisma.TransactionClient | typeof prisma,
  workspaceId: string,
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    projectProducts: Array<{ productId: string }>;
  },
): Promise<ProjectHealthInput> {
  const productIds = project.projectProducts.map((projectProduct) => projectProduct.productId);
  const assetScope = [
    {
      projectId: project.id,
    },
    ...(productIds.length > 0
      ? [
          {
            productId: {
              in: productIds,
            },
          },
        ]
      : []),
  ];
  const [confirmedFactCount, draftFactCount] =
    productIds.length > 0
      ? await Promise.all([
          client.productFact.count({
            where: scopedWhere(workspaceId, {
              productId: {
                in: productIds,
              },
              status: ProductFactStatus.CONFIRMED,
            }) as Prisma.ProductFactWhereInput,
          }),
          client.productFact.count({
            where: scopedWhere(workspaceId, {
              productId: {
                in: productIds,
              },
              status: {
                in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
              },
            }) as Prisma.ProductFactWhereInput,
          }),
        ])
      : [0, 0];
  const [
    confirmedStrategyCount,
    draftStrategyCount,
    totalPlanItemCount,
    readyPlanItemCount,
    contentPackageCount,
    generatedPackageCount,
    pendingReviewCount,
    approvedProductImageCount,
    approvedLogoCount,
    metricsSnapshotCount,
    openReminderCount,
  ] = await Promise.all([
    client.projectStrategy.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: StrategyStatus.CONFIRMED,
      }) as Prisma.ProjectStrategyWhereInput,
    }),
    client.projectStrategy.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: StrategyStatus.DRAFT,
      }) as Prisma.ProjectStrategyWhereInput,
    }),
    client.contentPlanItem.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
      }),
    }),
    client.contentPlanItem.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: {
          in: [PlanItemStatus.READY, PlanItemStatus.DONE],
        },
      }) as Prisma.ContentPlanItemWhereInput,
    }),
    client.contentPackage.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
      }),
    }),
    client.contentPackage.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: {
          in: [
            ContentPackageStatus.GENERATED,
            ContentPackageStatus.REVIEW_NEEDED,
            ContentPackageStatus.APPROVED,
          ],
        },
      }) as Prisma.ContentPackageWhereInput,
    }),
    client.reviewTask.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: ReviewTaskStatus.PENDING,
      }),
    }),
    client.asset.count({
      where: scopedWhere(workspaceId, {
        kind: AssetKind.PRODUCT_IMAGE,
        status: AssetStatus.APPROVED,
        OR: assetScope,
      }) as Prisma.AssetWhereInput,
    }),
    client.asset.count({
      where: scopedWhere(workspaceId, {
        kind: AssetKind.LOGO,
        status: AssetStatus.APPROVED,
        OR: assetScope,
      }) as Prisma.AssetWhereInput,
    }),
    client.metricsSnapshot.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
      }),
    }),
    client.reminder.count({
      where: scopedWhere(workspaceId, {
        projectId: project.id,
        status: ReminderStatus.OPEN,
      }),
    }),
  ]);

  return {
    project,
    linkedProductCount: productIds.length,
    confirmedFactCount,
    draftFactCount,
    confirmedStrategyCount,
    draftStrategyCount,
    totalPlanItemCount,
    readyPlanItemCount,
    contentPackageCount,
    generatedPackageCount,
    pendingReviewCount,
    approvedProductImageCount,
    approvedLogoCount,
    metricsSnapshotCount,
    openReminderCount,
  };
}

function buildProjectStatusSignal(
  input: ProjectHealthInput,
  href: string,
): ProjectHealthSignal {
  if (input.project.status === ProjectStatus.ACTIVE) {
    return signal("project-status", "项目状态", "complete", "项目处于进行中。", "继续推进", href, false, 8, 8);
  }

  if (input.project.status === ProjectStatus.DRAFT) {
    return signal("project-status", "项目状态", "warning", "项目仍是草稿。", "确认是否启动项目", href, false, 4, 8);
  }

  return signal(
    "project-status",
    "项目状态",
    "missing",
    "项目已暂停或归档，不能作为当前执行项目。",
    "恢复项目状态",
    href,
    true,
    0,
    8,
  );
}

function buildProductSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.linkedProductCount > 0) {
    return signal(
      "linked-products",
      "关联产品",
      "complete",
      `已关联 ${input.linkedProductCount} 个产品。`,
      "检查产品关联",
      href,
      false,
      10,
      10,
    );
  }

  return signal("linked-products", "关联产品", "missing", "项目还没有关联产品。", "关联至少一个产品", href, true, 0, 10);
}

function buildProductFactSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.confirmedFactCount >= 3) {
    return signal(
      "product-facts",
      "产品事实",
      "complete",
      `已有 ${input.confirmedFactCount} 条已确认产品事实。`,
      "查看产品事实",
      href,
      false,
      14,
      14,
    );
  }

  if (input.confirmedFactCount > 0 || input.draftFactCount > 0) {
    return signal(
      "product-facts",
      "产品事实",
      "warning",
      `已确认 ${input.confirmedFactCount} 条，仍有 ${input.draftFactCount} 条待确认。`,
      "确认产品事实",
      href,
      true,
      7,
      14,
    );
  }

  return signal("product-facts", "产品事实", "missing", "还没有可用于策略和素材的产品事实。", "补充产品事实", href, true, 0, 14);
}

function buildStrategySignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.confirmedStrategyCount > 0) {
    return signal("strategy", "正式策略", "complete", "已有正式策略版本。", "查看正式策略", href, false, 16, 16);
  }

  if (input.draftStrategyCount > 0) {
    return signal("strategy", "正式策略", "warning", "已有策略草案，但尚未人工确认。", "确认正式策略", href, true, 8, 16);
  }

  return signal("strategy", "正式策略", "missing", "还没有策略草案或正式策略。", "生成策略草案", href, true, 0, 16);
}

function buildPlanSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.totalPlanItemCount >= 4 && input.readyPlanItemCount > 0) {
    return signal(
      "content-plan",
      "首月计划",
      "complete",
      `已有 ${input.totalPlanItemCount} 条计划，其中 ${input.readyPlanItemCount} 条可执行。`,
      "查看内容日历",
      href,
      false,
      12,
      12,
    );
  }

  if (input.totalPlanItemCount > 0) {
    return signal(
      "content-plan",
      "首月计划",
      "warning",
      `已有 ${input.totalPlanItemCount} 条计划，但可执行项不足。`,
      "完善内容计划",
      href,
      false,
      6,
      12,
    );
  }

  return signal("content-plan", "首月计划", "missing", "还没有首月内容计划。", "生成首月计划", href, false, 0, 12);
}

function buildPackageSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.generatedPackageCount > 0) {
    return signal(
      "content-package",
      "素材包",
      "complete",
      `已有 ${input.generatedPackageCount} 个进入生成、审核或通过状态的素材包。`,
      "查看素材包",
      href,
      false,
      12,
      12,
    );
  }

  if (input.contentPackageCount > 0) {
    return signal(
      "content-package",
      "素材包",
      "warning",
      `已有 ${input.contentPackageCount} 个素材包结构，但还未生成完整交付物。`,
      "补齐素材包文件",
      href,
      false,
      6,
      12,
    );
  }

  return signal("content-package", "素材包", "missing", "还没有素材包结构。", "创建第一份素材包", href, false, 0, 12);
}

function buildAssetSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  const hasProductImage = input.approvedProductImageCount > 0;
  const hasLogo = input.approvedLogoCount > 0;

  if (hasProductImage && hasLogo) {
    return signal(
      "approved-assets",
      "真实视觉素材",
      "complete",
      `已有 ${input.approvedProductImageCount} 张审核产品图和 ${input.approvedLogoCount} 个官方 Logo。`,
      "查看素材库",
      href,
      false,
      14,
      14,
    );
  }

  if (hasProductImage || hasLogo) {
    return signal(
      "approved-assets",
      "真实视觉素材",
      "warning",
      hasProductImage ? "已有产品图，但缺少审核通过的官方 Logo。" : "已有官方 Logo，但缺少审核通过的产品图。",
      "补齐并审核视觉素材",
      href,
      true,
      7,
      14,
    );
  }

  return signal(
    "approved-assets",
    "真实视觉素材",
    "missing",
    "缺少审核通过的真实产品图和官方 Logo。",
    "上传并审核真实素材",
    href,
    true,
    0,
    14,
  );
}

function buildReviewSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.pendingReviewCount === 0) {
    return signal("reviews", "审核阻塞", "complete", "当前没有待审核任务。", "查看审核中心", href, false, 8, 8);
  }

  return signal(
    "reviews",
    "审核阻塞",
    "warning",
    `还有 ${input.pendingReviewCount} 个待审核任务。`,
    "处理审核任务",
    href,
    false,
    0,
    8,
  );
}

function buildMetricsSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.metricsSnapshotCount > 0) {
    return signal(
      "metrics",
      "数据复盘",
      "complete",
      `已有 ${input.metricsSnapshotCount} 条渠道表现记录。`,
      "查看数据复盘",
      href,
      false,
      8,
      8,
    );
  }

  return signal("metrics", "数据复盘", "warning", "还没有渠道表现记录。", "录入第一条指标", href, false, 0, 8);
}

function buildReminderSignal(input: ProjectHealthInput, href: string): ProjectHealthSignal {
  if (input.openReminderCount === 0) {
    return signal("reminders", "提醒处理", "complete", "当前没有未处理提醒。", "查看提醒中心", href, false, 6, 6);
  }

  return signal(
    "reminders",
    "提醒处理",
    "warning",
    `还有 ${input.openReminderCount} 条开放提醒。`,
    "处理提醒",
    href,
    false,
    3,
    6,
  );
}

function compareProjectHealthActions(left: ProjectHealthSignal, right: ProjectHealthSignal) {
  if (left.blocking !== right.blocking) {
    return left.blocking ? -1 : 1;
  }

  return actionPriority(left.key) - actionPriority(right.key);
}

function actionPriority(key: string) {
  const priorities: Record<string, number> = {
    "project-status": 0,
    "linked-products": 1,
    "approved-assets": 2,
    "product-facts": 3,
    strategy: 4,
    "content-plan": 5,
    "content-package": 6,
    reviews: 7,
    metrics: 8,
    reminders: 9,
  };

  return priorities[key] ?? 99;
}

function inferProjectHealthRating(
  score: number,
  blockingGapCount: number,
  missingBlockingCount: number,
): ProjectHealthRating {
  if (score >= 80 && blockingGapCount === 0) {
    return "READY";
  }

  if (score < 50 || missingBlockingCount >= 2) {
    return "BLOCKED";
  }

  return "NEEDS_ATTENTION";
}

function buildProjectHealthSummaryText(
  rating: ProjectHealthRating,
  score: number,
  nextActions: ProjectHealthSignal[],
) {
  if (rating === "READY") {
    return `就绪度 ${score} 分，可进入素材包生成、审核和投放准备。`;
  }

  if (nextActions.length === 0) {
    return `就绪度 ${score} 分，暂无明确缺口。`;
  }

  const actionText = nextActions.map((action) => action.action).join("、");
  return `就绪度 ${score} 分，建议优先处理：${actionText}。`;
}

function signal(
  key: string,
  label: string,
  status: ProjectHealthSignalStatus,
  summary: string,
  action: string,
  href: string,
  blocking: boolean,
  score: number,
  maxScore: number,
): ProjectHealthSignal {
  return {
    key,
    label,
    status,
    summary,
    action,
    href,
    blocking,
    score,
    maxScore,
  };
}
