import {
  AssetStatus,
  ContentPackageStatus,
  Prisma,
  ProductFactStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
  StrategyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

type ReviewDecision =
  | typeof ReviewTaskStatus.APPROVED
  | typeof ReviewTaskStatus.CHANGES_REQUESTED;

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
          in: [ReviewTaskStatus.APPROVED, ReviewTaskStatus.CHANGES_REQUESTED],
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
  decision: ReviewDecision;
  decisionNote?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const reviewTask = await tx.reviewTask.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.taskId,
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
