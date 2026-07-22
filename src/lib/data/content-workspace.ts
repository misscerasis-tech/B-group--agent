import {
  AssetStatus,
  ContentFrequency,
  ContentPackageStatus,
  PackageFileStatus,
  PlanItemStatus,
  Prisma,
  ProductFactStatus,
  ReminderSeverity,
  ReminderStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
  StrategyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

type ReviewDecision =
  | typeof ReviewTaskStatus.APPROVED
  | typeof ReviewTaskStatus.CHANGES_REQUESTED;

type ReminderResolution = typeof ReminderStatus.DONE | typeof ReminderStatus.DISMISSED;
const DEFAULT_CONTENT_PACKAGE_FILES: Array<[string, string]> = [
  ["素材包说明 PDF", "PDF"],
  ["内容排期 XLSX", "XLSX"],
  ["平台文案 DOCX", "DOCX"],
  ["Hashtags TXT", "TXT"],
  ["TikTok 视频脚本 DOCX", "DOCX"],
  ["发布配文 TXT", "TXT"],
  ["模板化海报图片", "PNG"],
  ["海报文案 DOCX", "DOCX"],
  ["设计 Brief PDF", "PDF"],
  ["品牌与合规检查 PDF", "PDF"],
  ["最终 ZIP 打包下载", "ZIP"],
];

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

export async function createContentPlanItem(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  week: number;
  channel: string;
  theme: string;
  title: string;
  deliverable: string;
  dueDate?: Date;
  status: PlanItemStatus;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
    });

    if (!project) {
      throw new Error("未找到当前 Workspace 下的项目，无法创建内容计划。");
    }

    const strategy = await tx.projectStrategy.findFirst({
      where: scopedWhere(input.workspaceId, {
        projectId: input.projectId,
        status: {
          not: StrategyStatus.ARCHIVED,
        },
      }) as Prisma.ProjectStrategyWhereInput,
      orderBy: [
        {
          version: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    const planItem = await tx.contentPlanItem.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        strategyId: strategy?.id ?? null,
        week: input.week,
        channel: input.channel,
        theme: input.theme,
        title: input.title,
        deliverable: input.deliverable,
        dueDate: input.dueDate,
        status: input.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "plan_item_created",
        summary: `新增内容计划：${project.name} · 第${planItem.week}周 · ${planItem.title}`,
        after: planItemToJson(planItem),
        actorUserId: input.userId,
      },
    });

    return planItem;
  });
}

export async function updateContentPlanItemStatus(input: {
  workspaceId: string;
  userId: string;
  planItemId: string;
  status: PlanItemStatus;
}) {
  return prisma.$transaction(async (tx) => {
    const planItem = await tx.contentPlanItem.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.planItemId,
      }) as Prisma.ContentPlanItemWhereInput,
      include: {
        project: true,
      },
    });

    if (!planItem) {
      throw new Error("未找到当前 Workspace 下的内容计划。");
    }

    const updatedPlanItem = await tx.contentPlanItem.update({
      where: {
        id: planItem.id,
      },
      data: {
        status: input.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: planItem.projectId,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "plan_item_status_updated",
        summary: `更新内容计划状态：${planItem.project.name} · 第${planItem.week}周 · ${planItem.title}`,
        before: {
          status: planItem.status,
        },
        after: {
          status: updatedPlanItem.status,
        },
        actorUserId: input.userId,
      },
    });

    return updatedPlanItem;
  });
}

export async function listWorkspaceContentPackages(workspaceId: string) {
  return prisma.contentPackage.findMany({
    where: scopedWhere(workspaceId),
    include: {
      project: {
        include: {
          projectProducts: {
            select: {
              productId: true,
            },
          },
        },
      },
      files: {
        include: {
          asset: true,
        },
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

export async function createContentPackage(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  name: string;
  period: string;
  frequency: ContentFrequency;
  summary?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
    });

    if (!project) {
      throw new Error("未找到当前 Workspace 下的项目，无法创建素材包。");
    }

    const strategy = await tx.projectStrategy.findFirst({
      where: scopedWhere(input.workspaceId, {
        projectId: input.projectId,
        status: {
          not: StrategyStatus.ARCHIVED,
        },
      }) as Prisma.ProjectStrategyWhereInput,
      orderBy: [
        {
          version: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    const contentPackage = await tx.contentPackage.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        strategyId: strategy?.id ?? null,
        name: input.name,
        period: input.period,
        frequency: input.frequency,
        status: ContentPackageStatus.DRAFT,
        summary: input.summary,
      },
    });

    await tx.contentPackageFile.createMany({
      data: DEFAULT_CONTENT_PACKAGE_FILES.map(([name, fileType]) => ({
        contentPackageId: contentPackage.id,
        name,
        fileType,
        status: PackageFileStatus.PLANNED,
      })),
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "content_package_created",
        summary: `创建素材包结构：${contentPackage.name}`,
        after: {
          id: contentPackage.id,
          projectId: contentPackage.projectId,
          strategyId: contentPackage.strategyId,
          name: contentPackage.name,
          period: contentPackage.period,
          frequency: contentPackage.frequency,
          status: contentPackage.status,
          fileCount: DEFAULT_CONTENT_PACKAGE_FILES.length,
        },
        actorUserId: input.userId,
      },
    });

    return contentPackage;
  });
}

export async function updateContentPackageFileStatus(input: {
  workspaceId: string;
  userId: string;
  fileId: string;
  status: PackageFileStatus;
}) {
  return prisma.$transaction(async (tx) => {
    const packageFile = await tx.contentPackageFile.findFirst({
      where: {
        id: input.fileId,
        contentPackage: {
          workspaceId: input.workspaceId,
        },
      },
      include: {
        contentPackage: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!packageFile) {
      throw new Error("未找到当前 Workspace 下的素材包文件项。");
    }

    const updatedFile = await tx.contentPackageFile.update({
      where: {
        id: packageFile.id,
      },
      data: {
        status: input.status,
      },
    });

    const siblingFiles = await tx.contentPackageFile.findMany({
      where: {
        contentPackageId: packageFile.contentPackageId,
      },
    });
    const nextPackageStatus = inferContentPackageStatus(siblingFiles);

    if (packageFile.contentPackage.status !== ContentPackageStatus.ARCHIVED) {
      await tx.contentPackage.update({
        where: {
          id: packageFile.contentPackageId,
        },
        data: {
          status: nextPackageStatus,
        },
      });
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: packageFile.contentPackage.projectId,
        entityType: "ContentPackageFile",
        entityId: packageFile.id,
        action: "package_file_status_updated",
        summary: `更新素材包文件状态：${packageFile.contentPackage.name} · ${packageFile.name}`,
        before: {
          status: packageFile.status,
        },
        after: {
          status: updatedFile.status,
          contentPackageStatus: nextPackageStatus,
        },
        actorUserId: input.userId,
      },
    });

    return updatedFile;
  });
}

export async function submitContentPackageForReview(input: {
  workspaceId: string;
  userId: string;
  contentPackageId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const contentPackage = await tx.contentPackage.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.contentPackageId,
        status: {
          not: ContentPackageStatus.ARCHIVED,
        },
      }) as Prisma.ContentPackageWhereInput,
      include: {
        project: true,
        files: true,
      },
    });

    if (!contentPackage) {
      throw new Error("未找到当前 Workspace 下可提交审核的素材包。");
    }

    const updatedContentPackage = await tx.contentPackage.update({
      where: {
        id: contentPackage.id,
      },
      data: {
        status: ContentPackageStatus.REVIEW_NEEDED,
      },
    });

    const taskCreated = await createTaskIfMissing(tx, {
      workspaceId: input.workspaceId,
      projectId: contentPackage.projectId,
      subjectType: ReviewSubjectType.CONTENT_PACKAGE,
      subjectId: contentPackage.id,
      title: `审核素材包：${contentPackage.name}`,
      description: `${contentPackage.project.name} · ${contentPackage.files.length} 个文件项 · ${contentPackage.summary ?? "待补充素材包说明"}`,
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: contentPackage.projectId,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "content_package_submitted_for_review",
        summary: `提交素材包审核：${contentPackage.name}`,
        before: {
          status: contentPackage.status,
        },
        after: {
          status: updatedContentPackage.status,
          reviewTaskCreated: taskCreated > 0,
          fileCount: contentPackage.files.length,
        },
        actorUserId: input.userId,
      },
    });

    return updatedContentPackage;
  });
}

export async function attachAssetToPackageFile(input: {
  workspaceId: string;
  userId: string;
  fileId: string;
  assetId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const packageFile = await tx.contentPackageFile.findFirst({
      where: {
        id: input.fileId,
        contentPackage: {
          workspaceId: input.workspaceId,
        },
      },
      include: {
        asset: true,
        contentPackage: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!packageFile) {
      throw new Error("未找到当前 Workspace 下的素材包文件项。");
    }

    const asset = await tx.asset.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.assetId,
        status: AssetStatus.APPROVED,
      }) as Prisma.AssetWhereInput,
    });

    if (!asset) {
      throw new Error("未找到当前 Workspace 下已审核的素材。");
    }

    const updatedFile = await tx.contentPackageFile.update({
      where: {
        id: packageFile.id,
      },
      data: {
        assetId: asset.id,
        status: PackageFileStatus.GENERATED,
        notes: `已关联素材：${asset.name}`,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: packageFile.contentPackage.projectId,
        entityType: "ContentPackageFile",
        entityId: packageFile.id,
        action: "package_file_asset_attached",
        summary: `素材包文件关联素材：${packageFile.contentPackage.name} · ${packageFile.name}`,
        before: {
          assetId: packageFile.assetId,
          assetName: packageFile.asset?.name ?? null,
          status: packageFile.status,
        },
        after: {
          assetId: asset.id,
          assetName: asset.name,
          status: updatedFile.status,
        },
        actorUserId: input.userId,
      },
    });

    return updatedFile;
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

export async function createManualReminder(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  severity: ReminderSeverity;
  dueAt?: Date;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: input.projectId,
          deletedAt: null,
        }),
      });

      if (!project) {
        throw new Error("所选项目不属于当前 Workspace，无法创建提醒。");
      }
    }

    const reminder = await tx.reminder.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description,
        severity: input.severity,
        dueAt: input.dueAt,
        status: ReminderStatus.OPEN,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: "manual_reminder_created",
        summary: `创建提醒：${reminder.title}`,
        after: reminderToJson(reminder),
        actorUserId: input.userId,
      },
    });

    return reminder;
  });
}

export async function createProactiveReminders(input: { workspaceId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const [projects, pendingReviews, draftStrategies, packageReviews, riskyPlanItems, recentMetrics] =
      await Promise.all([
        tx.project.findMany({
          where: scopedWhere(input.workspaceId, {
            deletedAt: null,
          }),
          include: {
            projectProducts: {
              include: {
                product: {
                  include: {
                    assets: true,
                  },
                },
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
        tx.reviewTask.findMany({
          where: scopedWhere(input.workspaceId, {
            status: ReviewTaskStatus.PENDING,
          }) as Prisma.ReviewTaskWhereInput,
        }),
        tx.projectStrategy.findMany({
          where: scopedWhere(input.workspaceId, {
            status: StrategyStatus.DRAFT,
          }) as Prisma.ProjectStrategyWhereInput,
          include: {
            project: true,
          },
        }),
        tx.contentPackage.findMany({
          where: scopedWhere(input.workspaceId, {
            status: {
              in: [ContentPackageStatus.DRAFT, ContentPackageStatus.REVIEW_NEEDED],
            },
          }),
          include: {
            project: true,
          },
        }),
        tx.contentPlanItem.findMany({
          where: scopedWhere(input.workspaceId, {
            OR: [
              {
                title: {
                  contains: "抽奖",
                },
              },
              {
                deliverable: {
                  contains: "活动",
                },
              },
              {
                theme: {
                  contains: "礼品",
                },
              },
            ],
          }) as Prisma.ContentPlanItemWhereInput,
          include: {
            project: true,
          },
        }),
        tx.metricsSnapshot.findMany({
          where: scopedWhere(input.workspaceId),
          include: {
            project: true,
          },
          orderBy: {
            capturedAt: "desc",
          },
          take: 12,
        }),
      ]);

    let createdCount = 0;

    for (const project of projects) {
      const assets = project.projectProducts.flatMap(({ product }) => product.assets);
      const approvedProductImage = assets.some(
        (asset) => asset.kind === "PRODUCT_IMAGE" && asset.status === AssetStatus.APPROVED,
      );
      const approvedLogo = assets.some(
        (asset) => asset.kind === "LOGO" && asset.status === AssetStatus.APPROVED,
      );

      if (!approvedProductImage) {
        createdCount += await createReminderIfMissing(tx, {
          workspaceId: input.workspaceId,
          projectId: project.id,
          title: "缺少已审核真实产品图",
          description:
            "正式海报和素材包必须引用已审核真实产品图，不能让图片模型重新生成产品主体。",
          severity: ReminderSeverity.CRITICAL,
        });
      }

      if (!approvedLogo) {
        createdCount += await createReminderIfMissing(tx, {
          workspaceId: input.workspaceId,
          projectId: project.id,
          title: "缺少已审核官方 Logo",
          description: "正式视觉的 Logo Layer 必须引用官方 Logo Asset，并经过人工来源检查。",
          severity: ReminderSeverity.WARNING,
        });
      }
    }

    for (const strategy of draftStrategies) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: strategy.projectId,
        title: `策略草案待确认：${strategy.project.name}`,
        description: "策略没有确认前，不应作为正式素材包生成依据。",
        severity: ReminderSeverity.WARNING,
      });
    }

    for (const contentPackage of packageReviews) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: contentPackage.projectId,
        title: `素材包待审核：${contentPackage.name}`,
        description: "发布或下载前需要检查平台比例、产品素材来源、品牌和合规要求。",
        severity: ReminderSeverity.WARNING,
      });
    }

    for (const planItem of riskyPlanItems) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: planItem.projectId,
        title: `活动规则需提前确认：${planItem.title}`,
        description: "计划中包含抽奖、礼品或活动类内容，发布前需要确认奖品、规则和免责声明。",
        severity: ReminderSeverity.WARNING,
      });
    }

    const pendingReviewsByProject = groupByProjectId(pendingReviews);

    for (const [projectId, count] of pendingReviewsByProject) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId,
        title: "存在待处理审核任务",
        description: `当前项目还有 ${count} 条审核任务未处理，建议先进入审核中心完成确认。`,
        severity: ReminderSeverity.INFO,
      });
    }

    for (const candidate of buildMetricsReminderCandidates(recentMetrics)) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: candidate.projectId,
        title: candidate.title,
        description: candidate.description,
        severity: candidate.severity,
      });
    }

    if (createdCount > 0) {
      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          entityType: "Reminder",
          entityId: input.workspaceId,
          action: "proactive_reminders_created",
          summary: `生成 ${createdCount} 条主动提醒。`,
          actorUserId: input.userId,
        },
      });
    }

    return {
      createdCount,
    };
  });
}

export function buildMetricsReminderCandidates(
  metricsSnapshots: Array<{
    projectId: string;
    project: { name: string };
    period: string;
    channel: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spendCents: number;
  }>,
) {
  const candidates: Array<{
    projectId: string;
    title: string;
    description: string;
    severity: ReminderSeverity;
  }> = [];

  for (const snapshot of metricsSnapshots) {
    const clickRate = snapshot.impressions > 0 ? snapshot.clicks / snapshot.impressions : null;

    if (snapshot.impressions >= 1000 && snapshot.clicks === 0) {
      candidates.push({
        projectId: snapshot.projectId,
        title: `曝光无点击：${snapshot.channel} ${snapshot.period}`,
        description: `${snapshot.project.name} 在 ${snapshot.channel} 有 ${snapshot.impressions} 次曝光但没有点击，建议检查首屏创意、标题和 CTA。`,
        severity: ReminderSeverity.CRITICAL,
      });
      continue;
    }

    if (clickRate !== null && snapshot.impressions >= 1000 && clickRate < 0.005) {
      candidates.push({
        projectId: snapshot.projectId,
        title: `点击率偏低：${snapshot.channel} ${snapshot.period}`,
        description: `${snapshot.project.name} 在 ${snapshot.channel} 的 CTR 为 ${formatPercent(
          clickRate,
        )}，建议复查素材钩子、平台比例和目标客群。`,
        severity: ReminderSeverity.WARNING,
      });
    }

    if (snapshot.clicks >= 50 && snapshot.conversions === 0) {
      candidates.push({
        projectId: snapshot.projectId,
        title: `有点击无转化：${snapshot.channel} ${snapshot.period}`,
        description: `${snapshot.project.name} 在 ${snapshot.channel} 已产生 ${snapshot.clicks} 次点击但没有转化，建议检查落地页、优惠机制和产品信任信息。`,
        severity: ReminderSeverity.WARNING,
      });
    }

    if (snapshot.spendCents >= 10000 && snapshot.conversions === 0) {
      candidates.push({
        projectId: snapshot.projectId,
        title: `有花费无转化：${snapshot.channel} ${snapshot.period}`,
        description: `${snapshot.project.name} 在 ${snapshot.channel} 已花费 ¥${(
          snapshot.spendCents / 100
        ).toFixed(2)} 但没有转化，建议暂停放量并复核策略。`,
        severity: ReminderSeverity.WARNING,
      });
    }
  }

  return candidates.slice(0, 8);
}

export async function resolveReminder(input: {
  workspaceId: string;
  userId: string;
  reminderId: string;
  status: ReminderResolution;
}) {
  return prisma.$transaction(async (tx) => {
    const reminder = await tx.reminder.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.reminderId,
        status: ReminderStatus.OPEN,
      }) as Prisma.ReminderWhereInput,
    });

    if (!reminder) {
      throw new Error("未找到待处理的提醒。");
    }

    const updatedReminder = await tx.reminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        status: input.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: reminder.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: input.status === ReminderStatus.DONE ? "reminder_done" : "reminder_dismissed",
        summary:
          input.status === ReminderStatus.DONE
            ? `完成提醒：${reminder.title}`
            : `忽略提醒：${reminder.title}`,
        before: reminderToJson(reminder),
        after: reminderToJson(updatedReminder),
        actorUserId: input.userId,
      },
    });

    return updatedReminder;
  });
}

export async function getWorkspaceReviewQueue(workspaceId: string) {
  const [
    reviewTasks,
    completedReviewTasks,
    strategyDrafts,
    packageReviews,
    assetReviews,
    factReviews,
  ] = await Promise.all([
    prisma.reviewTask.findMany({
      where: scopedWhere(workspaceId, {
        status: ReviewTaskStatus.PENDING,
      }) as Prisma.ReviewTaskWhereInput,
      include: {
        project: true,
        reviewer: true,
      },
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    }),
    prisma.reviewTask.findMany({
      where: scopedWhere(workspaceId, {
        status: {
          in: [
            ReviewTaskStatus.APPROVED,
            ReviewTaskStatus.CHANGES_REQUESTED,
            ReviewTaskStatus.CANCELED,
          ],
        },
      }) as Prisma.ReviewTaskWhereInput,
      include: {
        project: true,
        reviewer: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
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
    prisma.asset.findMany({
      where: scopedWhere(workspaceId, {
        status: AssetStatus.UPLOADED,
      }) as Prisma.AssetWhereInput,
      include: {
        project: true,
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.productFact.findMany({
      where: scopedWhere(workspaceId, {
        status: {
          in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
        },
      }) as Prisma.ProductFactWhereInput,
      include: {
        product: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  return {
    reviewTasks,
    completedReviewTasks,
    strategyDrafts,
    packageReviews,
    assetReviews,
    factReviews,
  };
}

export async function createMissingReviewTasks(input: { workspaceId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const [strategyDrafts, packageReviews, assetReviews, factReviews] = await Promise.all([
      prisma.projectStrategy.findMany({
        where: scopedWhere(input.workspaceId, {
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
        where: scopedWhere(input.workspaceId, {
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
      prisma.asset.findMany({
        where: scopedWhere(input.workspaceId, {
          status: AssetStatus.UPLOADED,
        }) as Prisma.AssetWhereInput,
        include: {
          project: true,
          product: true,
        },
      }),
      prisma.productFact.findMany({
        where: scopedWhere(input.workspaceId, {
          status: {
            in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
          },
        }) as Prisma.ProductFactWhereInput,
        include: {
          product: true,
        },
      }),
    ]);

    let createdCount = 0;

    for (const strategy of strategyDrafts) {
      createdCount += await createTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: strategy.projectId,
        subjectType: ReviewSubjectType.PROJECT_STRATEGY,
        subjectId: strategy.id,
        title: `确认项目策略 v${strategy.version}`,
        description: `${strategy.project.name}：${strategy.targetMarkets.join("、") || "待补充市场"} · ${strategy.channels.join(" + ") || "待补充渠道"}`,
      });
    }

    for (const contentPackage of packageReviews) {
      createdCount += await createTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: contentPackage.projectId,
        subjectType: ReviewSubjectType.CONTENT_PACKAGE,
        subjectId: contentPackage.id,
        title: `审核素材包：${contentPackage.name}`,
        description: `${contentPackage.project.name} · ${contentPackage.files.length} 个文件项 · ${contentPackage.summary ?? "待补充素材包说明"}`,
      });
    }

    for (const asset of assetReviews) {
      createdCount += await createTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: asset.projectId,
        subjectType: ReviewSubjectType.ASSET,
        subjectId: asset.id,
        title: `审核素材：${asset.name}`,
        description: `${asset.product?.name ?? "未关联产品"} · ${asset.originalFilename ?? "无原始文件名"}。产品图和 Logo 必须确认来源真实。`,
      });
    }

    for (const fact of factReviews) {
      createdCount += await createTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: undefined,
        subjectType: ReviewSubjectType.PRODUCT_FACT,
        subjectId: fact.id,
        title: `确认产品事实：${fact.label}`,
        description: `${fact.product.name} · ${fact.value}`,
      });
    }

    if (createdCount > 0) {
      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          entityType: "ReviewTask",
          entityId: input.workspaceId,
          action: "review_tasks_created",
          summary: `创建 ${createdCount} 条待审核任务。`,
          actorUserId: input.userId,
        },
      });
    }

    return {
      createdCount,
    };
  });
}

export async function decideReviewTask(input: {
  workspaceId: string;
  userId: string;
  taskId: string;
  projectId?: string;
  decision: ReviewDecision;
  decisionNote?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const reviewTask = await tx.reviewTask.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.taskId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        status: ReviewTaskStatus.PENDING,
      }) as Prisma.ReviewTaskWhereInput,
    });

    if (!reviewTask) {
      throw new Error("未找到待处理的审核任务。");
    }

    await applyReviewDecisionToSubject(tx, input.workspaceId, reviewTask, input.decision);

    const updatedTask = await tx.reviewTask.update({
      where: {
        id: reviewTask.id,
      },
      data: {
        status: input.decision,
        reviewerUserId: input.userId,
        decisionNote: input.decisionNote,
        decidedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: reviewTask.projectId,
        entityType: "ReviewTask",
        entityId: reviewTask.id,
        action:
          input.decision === ReviewTaskStatus.APPROVED
            ? "review_approved"
            : "review_changes_requested",
        summary:
          input.decision === ReviewTaskStatus.APPROVED
            ? `审核通过：${reviewTask.title}`
            : `要求修改：${reviewTask.title}`,
        before: reviewTaskToJson(reviewTask),
        after: reviewTaskToJson(updatedTask),
        actorUserId: input.userId,
      },
    });

    return updatedTask;
  });
}

export async function cancelReviewTask(input: {
  workspaceId: string;
  userId: string;
  taskId: string;
  projectId?: string;
  decisionNote?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const reviewTask = await tx.reviewTask.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.taskId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        status: ReviewTaskStatus.PENDING,
      }) as Prisma.ReviewTaskWhereInput,
    });

    if (!reviewTask) {
      throw new Error("未找到待取消的审核任务。");
    }

    const updatedTask = await tx.reviewTask.update({
      where: {
        id: reviewTask.id,
      },
      data: {
        status: ReviewTaskStatus.CANCELED,
        reviewerUserId: input.userId,
        decisionNote: input.decisionNote,
        decidedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: reviewTask.projectId,
        entityType: "ReviewTask",
        entityId: reviewTask.id,
        action: "review_canceled",
        summary: `取消审核任务：${reviewTask.title}`,
        before: reviewTaskToJson(reviewTask),
        after: reviewTaskToJson(updatedTask),
        actorUserId: input.userId,
      },
    });

    return updatedTask;
  });
}

async function createTaskIfMissing(
  tx: Prisma.TransactionClient,
  data: {
    workspaceId: string;
    projectId?: string | null;
    subjectType: ReviewSubjectType;
    subjectId: string;
    title: string;
    description?: string | null;
  },
) {
  const existingTask = await tx.reviewTask.findFirst({
    where: {
      workspaceId: data.workspaceId,
      subjectType: data.subjectType,
      subjectId: data.subjectId,
      status: ReviewTaskStatus.PENDING,
    },
  });

  if (existingTask) {
    return 0;
  }

  await tx.reviewTask.create({
    data: {
      ...data,
      status: ReviewTaskStatus.PENDING,
    },
  });

  return 1;
}

async function applyReviewDecisionToSubject(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  reviewTask: {
    subjectType: ReviewSubjectType;
    subjectId: string;
  },
  decision: ReviewDecision,
) {
  if (reviewTask.subjectType === ReviewSubjectType.PROJECT_STRATEGY) {
    await tx.projectStrategy.updateMany({
      where: {
        id: reviewTask.subjectId,
        workspaceId,
      },
      data:
        decision === ReviewTaskStatus.APPROVED
          ? {
              status: StrategyStatus.CONFIRMED,
              confirmedAt: new Date(),
            }
          : {
              status: StrategyStatus.DRAFT,
            },
    });
  }

  if (reviewTask.subjectType === ReviewSubjectType.CONTENT_PACKAGE) {
    await tx.contentPackage.updateMany({
      where: {
        id: reviewTask.subjectId,
        workspaceId,
      },
      data: {
        status:
          decision === ReviewTaskStatus.APPROVED
            ? ContentPackageStatus.APPROVED
            : ContentPackageStatus.REVIEW_NEEDED,
      },
    });
  }

  if (reviewTask.subjectType === ReviewSubjectType.ASSET) {
    await tx.asset.updateMany({
      where: {
        id: reviewTask.subjectId,
        workspaceId,
      },
      data: {
        status:
          decision === ReviewTaskStatus.APPROVED ? AssetStatus.APPROVED : AssetStatus.REJECTED,
      },
    });
  }

  if (reviewTask.subjectType === ReviewSubjectType.PRODUCT_FACT) {
    await tx.productFact.updateMany({
      where: {
        id: reviewTask.subjectId,
        workspaceId,
      },
      data: {
        status:
          decision === ReviewTaskStatus.APPROVED
            ? ProductFactStatus.CONFIRMED
            : ProductFactStatus.NEEDS_REVIEW,
      },
    });
  }
}

function reviewTaskToJson(reviewTask: {
  id: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  title: string;
  status: ReviewTaskStatus;
  reviewerUserId: string | null;
  decisionNote: string | null;
}) {
  return {
    id: reviewTask.id,
    subjectType: reviewTask.subjectType,
    subjectId: reviewTask.subjectId,
    title: reviewTask.title,
    status: reviewTask.status,
    reviewerUserId: reviewTask.reviewerUserId,
    decisionNote: reviewTask.decisionNote,
  };
}

async function createReminderIfMissing(
  tx: Prisma.TransactionClient,
  data: {
    workspaceId: string;
    projectId?: string | null;
    title: string;
    description: string;
    severity: ReminderSeverity;
  },
) {
  const existingReminder = await tx.reminder.findFirst({
    where: {
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      title: data.title,
      status: ReminderStatus.OPEN,
    },
  });

  if (existingReminder) {
    return 0;
  }

  await tx.reminder.create({
    data: {
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: ReminderStatus.OPEN,
    },
  });

  return 1;
}

function groupByProjectId(items: Array<{ projectId: string | null }>) {
  const groups = new Map<string | null, number>();

  for (const item of items) {
    groups.set(item.projectId, (groups.get(item.projectId) ?? 0) + 1);
  }

  return groups;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function reminderToJson(reminder: {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  severity: ReminderSeverity;
  status: ReminderStatus;
}) {
  return {
    id: reminder.id,
    projectId: reminder.projectId,
    title: reminder.title,
    description: reminder.description,
    severity: reminder.severity,
    status: reminder.status,
  };
}

function planItemToJson(planItem: {
  id: string;
  projectId: string;
  strategyId: string | null;
  week: number;
  channel: string;
  theme: string;
  title: string;
  deliverable: string;
  dueDate: Date | null;
  status: PlanItemStatus;
}) {
  return {
    id: planItem.id,
    projectId: planItem.projectId,
    strategyId: planItem.strategyId,
    week: planItem.week,
    channel: planItem.channel,
    theme: planItem.theme,
    title: planItem.title,
    deliverable: planItem.deliverable,
    dueDate: planItem.dueDate,
    status: planItem.status,
  };
}

function inferContentPackageStatus(files: Array<{ status: PackageFileStatus }>) {
  if (files.length > 0 && files.every((file) => file.status === PackageFileStatus.APPROVED)) {
    return ContentPackageStatus.APPROVED;
  }

  if (files.some((file) => file.status !== PackageFileStatus.PLANNED)) {
    return ContentPackageStatus.GENERATED;
  }

  return ContentPackageStatus.DRAFT;
}
