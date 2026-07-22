import {
  AgentMessageRole,
  AgentOperationStatus,
  AssetKind,
  AssetStatus,
  ContentFrequency,
  ContentPackageStatus,
  PackageFileStatus,
  PlanItemStatus,
  Prisma,
  ProductFactStatus,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
  StrategyStatus,
} from "@prisma/client";
import type { ParsedAgentOperation } from "@/lib/agent/command-parser";
import { getConfiguredAgentTextProvider } from "@/lib/agent/provider";
import {
  buildProjectHealthReminderDrafts,
  buildProjectHealthSummary,
  collectProjectHealthInput,
} from "@/lib/data/project-health";
import { buildContentPackageReadiness } from "@/lib/content-package-readiness";
import { buildMetricsReminderCandidates } from "@/lib/data/content-workspace";
import { inferProductFactsFromText } from "@/lib/product-facts/extractor";
import { prisma } from "@/lib/prisma";
import { buildStrategyRecommendation } from "@/lib/strategy/recommender";
import { scopedWhere } from "@/lib/workspace-scope";

type ProjectStrategyRecord = Awaited<ReturnType<typeof ensureProjectStrategy>>;

type StrategyMutableFields = {
  targetMarkets: string[];
  audiences: string[];
  channels: string[];
  contentDirections: string[];
  packageFrequency: ContentFrequency;
};

type ActivePlanChannelUsage = {
  channel: string;
  title: string;
  week: number;
};

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

export async function getAssistantState(workspaceId: string, projectId?: string) {
  const projects = await prisma.project.findMany({
    where: scopedWhere(workspaceId, {
      deletedAt: null,
    }),
    include: {
      projectProducts: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const selectedProject =
    (projectId ? projects.find((project) => project.id === projectId) : undefined) ??
    projects[0] ??
    null;

  if (!selectedProject) {
    return {
      projects,
      selectedProject: null,
      linkedProducts: [],
      productFacts: [],
      strategy: null,
      strategyHistory: [],
      planItems: [],
      contentPackages: [],
      reminders: [],
      conversation: null,
      recentOperations: [],
      changeLogs: [],
    };
  }

  const linkedProducts = selectedProject.projectProducts.map(({ product }) => product);
  const linkedProductIds = linkedProducts.map((product) => product.id);

  const [
    productFacts,
    strategy,
    strategyHistory,
    planItems,
    contentPackages,
    reminders,
    conversation,
    recentOperations,
    changeLogs,
  ] = await Promise.all([
    prisma.productFact.findMany({
      where: scopedWhere(workspaceId, {
        productId: {
          in: linkedProductIds,
        },
      }) as Prisma.ProductFactWhereInput,
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.projectStrategy.findFirst({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
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
    }),
    prisma.projectStrategy.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
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
      take: 8,
    }),
    prisma.contentPlanItem.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
      }),
      orderBy: [
        {
          week: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    }),
    prisma.contentPackage.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
      }),
      include: {
        files: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.reminder.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
        status: "OPEN",
      }) as Prisma.ReminderWhereInput,
      orderBy: [
        {
          severity: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    prisma.agentConversation.findFirst({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
      }) as Prisma.AgentConversationWhereInput,
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          take: 12,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.agentOperation.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
      }) as Prisma.AgentOperationWhereInput,
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    }),
    prisma.changeLog.findMany({
      where: scopedWhere(workspaceId, {
        projectId: selectedProject.id,
      }) as Prisma.ChangeLogWhereInput,
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
  ]);

  return {
    projects,
    selectedProject,
    linkedProducts,
    productFacts,
    strategy,
    strategyHistory,
    planItems,
    contentPackages,
    reminders,
    conversation,
    recentOperations,
    changeLogs,
  };
}

export async function submitAgentCommand(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  text: string;
}) {
  const text = input.text.trim();

  if (!text) {
    throw new Error("请输入要交给 B 组 Agent 执行的中文指令。");
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
    });

    if (!project) {
      throw new Error("未找到当前 Workspace 下的项目，无法执行指令。");
    }

    const conversation = await ensureConversation(tx, input.workspaceId, project.id);
    const strategy = await ensureProjectStrategy(tx, input.workspaceId, project.id);
    const agentProvider = getConfiguredAgentTextProvider();
    const parsed = await agentProvider.parseCommand({
      workspaceId: input.workspaceId,
      projectId: project.id,
      text,
      locale: "zh-CN",
    });
    const noSafeOperation = parsed.operations.length === 0;
    const hasConfirmationSensitiveOperation = parsed.operations.some(
      isConfirmationSensitiveOperation,
    );
    const requiresConfirmation =
      strategy.status === StrategyStatus.CONFIRMED && hasConfirmationSensitiveOperation;
    const activePlanChannelUsage = await findActivePlanChannelUsage(tx, {
      workspaceId: input.workspaceId,
      projectId: project.id,
      operations: parsed.operations,
    });
    const completionTargetWarnings = await findCompletionTargetWarnings(tx, {
      workspaceId: input.workspaceId,
      projectId: project.id,
      operations: parsed.operations,
    });
    const hasMissingCompletionTargets = completionTargetWarnings.length > 0;
    const operationStatus =
      noSafeOperation || hasMissingCompletionTargets
        ? AgentOperationStatus.FAILED
        : requiresConfirmation
          ? AgentOperationStatus.PENDING_CONFIRMATION
          : AgentOperationStatus.APPLIED;
    const conflictCheck = buildAgentConflictCheck({
      noSafeOperation,
      requiresConfirmation,
      hasConfirmationSensitiveOperation,
      strategy,
      operations: parsed.operations,
      activePlanChannelUsage,
      completionTargetWarnings,
    });

    await tx.agentMessage.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        role: AgentMessageRole.USER,
        content: text,
      },
    });

    const operation = await tx.agentOperation.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        projectId: project.id,
        rawText: text,
        summary: parsed.summary,
        operations: parsed.operations as Prisma.InputJsonValue,
        conflictCheck,
        status: operationStatus,
      },
    });

    let updatedStrategy = strategy;

    if (operationStatus === AgentOperationStatus.APPLIED) {
      const strategyOperations = parsed.operations.filter(isStrategyOperation);
      const strategyRecommendationOperations =
        parsed.operations.filter(isStrategyRecommendationOperation);
      const projectOperations = parsed.operations.filter(isProjectOperation);
      const reminderOperations = parsed.operations.filter(isReminderOperation);
      const projectHealthReminderOperations = parsed.operations.filter(
        isProjectHealthReminderOperation,
      );
      const productFactOperations = parsed.operations.filter(isProductFactOperation);
      const productFactConfirmationOperations = parsed.operations.filter(
        isProductFactConfirmationOperation,
      );
      const starterPlanOperations = parsed.operations.filter(isStarterPlanOperation);
      const metricsOperations = parsed.operations.filter(isMetricsOperation);
      const metricsRiskReminderOperations = parsed.operations.filter(
        isMetricsRiskReminderOperation,
      );
      const planItemOperations = parsed.operations.filter(isPlanItemOperation);
      const planItemDueDateOperations = parsed.operations.filter(isPlanItemDueDateOperation);
      const planItemStatusOperations = parsed.operations.filter(isPlanItemStatusOperation);
      const calendarGapReminderOperations = parsed.operations.filter(
        isCalendarGapReminderOperation,
      );
      const contentPackageOperations = parsed.operations.filter(isContentPackageOperation);
      const packageReadinessReminderOperations = parsed.operations.filter(
        isPackageReadinessReminderOperation,
      );
      const packageFilesStatusOperations = parsed.operations.filter(
        isPackageFilesStatusOperation,
      );
      const posterPackageAttachmentOperations = parsed.operations.filter(
        isPosterPackageAttachmentOperation,
      );
      const packageReviewOperations = parsed.operations.filter(isPackageReviewOperation);
      const packageReviewDecisionOperations = parsed.operations.filter(
        isPackageReviewDecisionOperation,
      );
      const reviewTaskDecisionOperations = parsed.operations.filter(
        isReviewTaskDecisionOperation,
      );
      const reviewTaskCancellationOperations = parsed.operations.filter(
        isReviewTaskCancellationOperation,
      );
      const missingReviewTaskOperations = parsed.operations.filter(
        isMissingReviewTaskOperation,
      );
      const reminderDueDateOperations = parsed.operations.filter(isReminderDueDateOperation);
      const reminderCompletionOperations = parsed.operations.filter(isReminderCompletionOperation);
      const reminderDismissalOperations = parsed.operations.filter(isReminderDismissalOperation);
      const planItemCompletionOperations = parsed.operations.filter(isPlanItemCompletionOperation);

      if (strategyOperations.length > 0) {
        const before = strategyToJson(strategy);
        const nextData = applyOperationsToStrategy(strategy, strategyOperations);

        updatedStrategy = await tx.projectStrategy.update({
          where: {
            id: strategy.id,
          },
          data: nextData,
        });

        await tx.changeLog.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: project.id,
            entityType: "ProjectStrategy",
            entityId: strategy.id,
            action: "agent_command_applied",
            summary: parsed.summary,
            before,
            after: strategyToJson(updatedStrategy),
            actorUserId: input.userId,
          },
        });
      }

      if (strategyRecommendationOperations.length > 0) {
        updatedStrategy = await applyStrategyRecommendationOperations(tx, {
          workspaceId: input.workspaceId,
          userId: input.userId,
          project,
          strategy: updatedStrategy,
          operations: strategyRecommendationOperations,
        });
      }

      if (projectOperations.length > 0) {
        const before = projectToJson(project);
        const updatedProject = await tx.project.update({
          where: {
            id: project.id,
          },
          data: applyOperationsToProject(project, projectOperations),
        });

        await tx.changeLog.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: project.id,
            entityType: "Project",
            entityId: project.id,
            action: "agent_project_updated",
            summary: parsed.summary,
            before,
            after: projectToJson(updatedProject),
            actorUserId: input.userId,
          },
        });
      }

      await applyReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reminderOperations,
      });

      await applyProjectHealthReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        project,
        operations: projectHealthReminderOperations,
      });

      await applyProductFactOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: productFactOperations,
      });

      await applyProductFactConfirmationOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: productFactConfirmationOperations,
      });

      await applyMetricsOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: metricsOperations,
      });

      await applyMetricsRiskReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: metricsRiskReminderOperations,
      });

      await applyPlanItemOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        strategyId: updatedStrategy.id,
        operations: planItemOperations,
      });

      await applyPlanItemDueDateOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: planItemDueDateOperations,
      });

      await applyPlanItemStatusOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: planItemStatusOperations,
      });

      await applyCalendarGapReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        strategy: updatedStrategy,
        operations: calendarGapReminderOperations,
      });

      await applyContentPackageOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        strategyId: updatedStrategy.id,
        operations: contentPackageOperations,
      });

      await applyPackageReadinessReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: packageReadinessReminderOperations,
      });

      await applyPackageFilesStatusOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: packageFilesStatusOperations,
      });

      await applyPosterPackageAttachmentOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: posterPackageAttachmentOperations,
      });

      await applyPackageReviewOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: packageReviewOperations,
      });

      await applyPackageReviewDecisionOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: packageReviewDecisionOperations,
      });

      await applyReviewTaskDecisionOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reviewTaskDecisionOperations,
      });

      await applyReviewTaskCancellationOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reviewTaskCancellationOperations,
      });

      await applyMissingReviewTaskOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: missingReviewTaskOperations,
      });

      await applyReminderDueDateOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reminderDueDateOperations,
      });

      await applyReminderCompletionOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reminderCompletionOperations,
      });

      await applyReminderDismissalOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reminderDismissalOperations,
      });

      await applyPlanItemCompletionOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: planItemCompletionOperations,
      });

      if (starterPlanOperations.length > 0) {
        await createStarterPlanIfMissing(tx, {
          workspaceId: input.workspaceId,
          userId: input.userId,
          projectId: project.id,
          strategy: updatedStrategy,
        });
      }
    }

    await tx.agentMessage.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        role: AgentMessageRole.ASSISTANT,
        content: buildAssistantReply(parsed.summary, operationStatus, conflictCheck),
      },
    });

    await tx.agentConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return {
      operation,
      strategy: updatedStrategy,
      status: operationStatus,
    };
  });
}

export async function applyPendingAgentOperation(input: {
  workspaceId: string;
  userId: string;
  operationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const operation = await tx.agentOperation.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.operationId,
        status: AgentOperationStatus.PENDING_CONFIRMATION,
      }) as Prisma.AgentOperationWhereInput,
    });

    if (!operation || !operation.projectId) {
      throw new Error("未找到需要确认的 Agent 操作。");
    }

    const strategy = await ensureProjectStrategy(tx, input.workspaceId, operation.projectId);
    const parsedOperations = parseStoredOperations(operation.operations);
    const strategyOperations = parsedOperations.filter(isStrategyOperation);
    const strategyRecommendationOperations = parsedOperations.filter(
      isStrategyRecommendationOperation,
    );
    const projectOperations = parsedOperations.filter(isProjectOperation);
    const reminderOperations = parsedOperations.filter(isReminderOperation);
    const projectHealthReminderOperations = parsedOperations.filter(
      isProjectHealthReminderOperation,
    );
    const productFactOperations = parsedOperations.filter(isProductFactOperation);
    const productFactConfirmationOperations = parsedOperations.filter(
      isProductFactConfirmationOperation,
    );
    const starterPlanOperations = parsedOperations.filter(isStarterPlanOperation);
    const metricsOperations = parsedOperations.filter(isMetricsOperation);
    const metricsRiskReminderOperations = parsedOperations.filter(isMetricsRiskReminderOperation);
    const planItemOperations = parsedOperations.filter(isPlanItemOperation);
    const planItemDueDateOperations = parsedOperations.filter(isPlanItemDueDateOperation);
    const planItemStatusOperations = parsedOperations.filter(isPlanItemStatusOperation);
    const calendarGapReminderOperations = parsedOperations.filter(isCalendarGapReminderOperation);
    const contentPackageOperations = parsedOperations.filter(isContentPackageOperation);
    const packageReadinessReminderOperations = parsedOperations.filter(
      isPackageReadinessReminderOperation,
    );
    const packageFilesStatusOperations = parsedOperations.filter(isPackageFilesStatusOperation);
    const posterPackageAttachmentOperations = parsedOperations.filter(
      isPosterPackageAttachmentOperation,
    );
    const packageReviewOperations = parsedOperations.filter(isPackageReviewOperation);
    const packageReviewDecisionOperations = parsedOperations.filter(
      isPackageReviewDecisionOperation,
    );
    const reviewTaskDecisionOperations = parsedOperations.filter(isReviewTaskDecisionOperation);
    const reviewTaskCancellationOperations = parsedOperations.filter(
      isReviewTaskCancellationOperation,
    );
    const missingReviewTaskOperations = parsedOperations.filter(isMissingReviewTaskOperation);
    const reminderDueDateOperations = parsedOperations.filter(isReminderDueDateOperation);
    const reminderCompletionOperations = parsedOperations.filter(isReminderCompletionOperation);
    const reminderDismissalOperations = parsedOperations.filter(isReminderDismissalOperation);
    const planItemCompletionOperations = parsedOperations.filter(isPlanItemCompletionOperation);
    let updatedStrategy: ProjectStrategyRecord = strategy;

    if (strategyOperations.length > 0) {
      const before = strategyToJson(strategy);
      const nextData = applyOperationsToStrategy(strategy, strategyOperations);
      let changeAction = "agent_command_confirmed";
      let changeSummary = operation.summary;
      let changeEntityId = strategy.id;

      if (strategy.status === StrategyStatus.CONFIRMED) {
        updatedStrategy = await tx.projectStrategy.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: operation.projectId,
            version: strategy.version + 1,
            status: StrategyStatus.CONFIRMED,
            targetMarkets: nextData.targetMarkets,
            audiences: nextData.audiences,
            channels: nextData.channels,
            contentDirections: nextData.contentDirections,
            packageFrequency: nextData.packageFrequency,
            positioning: strategy.positioning,
            rationale: strategy.rationale,
            confirmedAt: new Date(),
          },
        });
        changeAction = "strategy_version_created";
        changeSummary = `确认变更并创建正式策略 v${updatedStrategy.version}：${operation.summary}`;
        changeEntityId = updatedStrategy.id;
      } else {
        updatedStrategy = await tx.projectStrategy.update({
          where: {
            id: strategy.id,
          },
          data: nextData,
        });
      }

      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: operation.projectId,
          entityType: "ProjectStrategy",
          entityId: changeEntityId,
          action: changeAction,
          summary: changeSummary,
          before,
          after: strategyToJson(updatedStrategy),
          actorUserId: input.userId,
        },
      });
    }

    if (strategyRecommendationOperations.length > 0) {
      const project = await tx.project.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: operation.projectId,
          deletedAt: null,
        }),
      });

      if (!project) {
        throw new Error("未找到当前 Workspace 下的项目，无法生成策略推荐。");
      }

      updatedStrategy = await applyStrategyRecommendationOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        project,
        strategy: updatedStrategy,
        operations: strategyRecommendationOperations,
      });
    }

    if (projectOperations.length > 0) {
      const project = await tx.project.findFirst({
        where: scopedWhere(input.workspaceId, {
          id: operation.projectId,
          deletedAt: null,
        }),
      });

      if (!project) {
        throw new Error("未找到当前 Workspace 下的项目，无法应用项目状态变更。");
      }

      const updatedProject = await tx.project.update({
        where: {
          id: project.id,
        },
        data: applyOperationsToProject(project, projectOperations),
      });

      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: operation.projectId,
          entityType: "Project",
          entityId: operation.projectId,
          action: "agent_project_confirmed",
          summary: `确认项目变更：${operation.summary}`,
          before: projectToJson(project),
          after: projectToJson(updatedProject),
          actorUserId: input.userId,
        },
      });
    }

    await applyReminderOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reminderOperations,
    });

    const projectForHealthReminders =
      projectHealthReminderOperations.length > 0
        ? await tx.project.findFirst({
            where: scopedWhere(input.workspaceId, {
              id: operation.projectId,
              deletedAt: null,
            }),
          })
        : null;

    if (projectHealthReminderOperations.length > 0) {
      if (!projectForHealthReminders) {
        throw new Error("未找到当前 Workspace 下的项目，无法生成体检缺口提醒。");
      }

      await applyProjectHealthReminderOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        project: projectForHealthReminders,
        operations: projectHealthReminderOperations,
      });
    }

    await applyProductFactOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: productFactOperations,
    });

    await applyProductFactConfirmationOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: productFactConfirmationOperations,
    });

    await applyMetricsOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: metricsOperations,
    });

    await applyMetricsRiskReminderOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: metricsRiskReminderOperations,
    });

    await applyPlanItemOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      strategyId: updatedStrategy.id,
      operations: planItemOperations,
    });

    await applyPlanItemDueDateOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: planItemDueDateOperations,
    });

    await applyPlanItemStatusOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: planItemStatusOperations,
    });

    await applyCalendarGapReminderOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      strategy: updatedStrategy,
      operations: calendarGapReminderOperations,
    });

    await applyContentPackageOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      strategyId: updatedStrategy.id,
      operations: contentPackageOperations,
    });

    await applyPackageReadinessReminderOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: packageReadinessReminderOperations,
    });

    await applyPackageFilesStatusOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: packageFilesStatusOperations,
    });

    await applyPosterPackageAttachmentOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: posterPackageAttachmentOperations,
    });

    await applyPackageReviewOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: packageReviewOperations,
    });

    await applyPackageReviewDecisionOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: packageReviewDecisionOperations,
    });

    await applyReviewTaskDecisionOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reviewTaskDecisionOperations,
    });

    await applyReviewTaskCancellationOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reviewTaskCancellationOperations,
    });

    await applyMissingReviewTaskOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: missingReviewTaskOperations,
    });

    await applyReminderDueDateOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reminderDueDateOperations,
    });

    await applyReminderCompletionOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reminderCompletionOperations,
    });

    await applyReminderDismissalOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reminderDismissalOperations,
    });

    await applyPlanItemCompletionOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: planItemCompletionOperations,
    });

    if (starterPlanOperations.length > 0) {
      await createStarterPlanIfMissing(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: operation.projectId,
        strategy: updatedStrategy,
      });
    }

    await tx.agentOperation.update({
      where: {
        id: operation.id,
      },
      data: {
        status: AgentOperationStatus.APPLIED,
        conflictCheck: "已由人工确认并应用到项目工作台。",
      },
    });

    if (operation.conversationId) {
      const content = buildConfirmedAssistantReply({
        operationSummary: operation.summary,
        strategyWasConfirmed: strategy.status === StrategyStatus.CONFIRMED,
        strategyVersion: updatedStrategy.version,
        strategyChanged: strategyOperations.length > 0,
        projectChanged: projectOperations.length > 0,
        strategyRecommended: strategyRecommendationOperations.length > 0,
        reminderChanged: reminderOperations.length > 0,
        healthReminderChanged: projectHealthReminderOperations.length > 0,
        productFactChanged: productFactOperations.length > 0,
        productFactsConfirmed: productFactConfirmationOperations.length > 0,
        starterPlanChanged: starterPlanOperations.length > 0,
        metricsChanged: metricsOperations.length > 0,
        metricsRiskReminderChanged: metricsRiskReminderOperations.length > 0,
        planItemChanged: planItemOperations.length > 0,
        planItemDueDateChanged: planItemDueDateOperations.length > 0,
        planItemStatusChanged: planItemStatusOperations.length > 0,
        calendarGapReminderChanged: calendarGapReminderOperations.length > 0,
        contentPackageChanged: contentPackageOperations.length > 0,
        packageReadinessReminderChanged: packageReadinessReminderOperations.length > 0,
        packageFilesStatusChanged: packageFilesStatusOperations.length > 0,
        posterPackageAttachmentChanged: posterPackageAttachmentOperations.length > 0,
        packageReviewSubmitted: packageReviewOperations.length > 0,
        packageReviewDecided: packageReviewDecisionOperations.length > 0,
        reviewTaskDecided: reviewTaskDecisionOperations.length > 0,
        reviewTaskCanceled: reviewTaskCancellationOperations.length > 0,
        missingReviewTasksCreated: missingReviewTaskOperations.length > 0,
        reminderDueDateChanged: reminderDueDateOperations.length > 0,
        reminderCompleted: reminderCompletionOperations.length > 0,
        reminderDismissed: reminderDismissalOperations.length > 0,
        planItemCompleted: planItemCompletionOperations.length > 0,
      });

      await tx.agentMessage.create({
        data: {
          workspaceId: input.workspaceId,
          conversationId: operation.conversationId,
          role: AgentMessageRole.ASSISTANT,
          content,
        },
      });
    }

    return updatedStrategy;
  });
}

export async function rejectPendingAgentOperation(input: {
  workspaceId: string;
  userId: string;
  operationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const operation = await tx.agentOperation.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.operationId,
        status: AgentOperationStatus.PENDING_CONFIRMATION,
      }) as Prisma.AgentOperationWhereInput,
    });

    if (!operation || !operation.projectId) {
      throw new Error("未找到需要拒绝的 Agent 操作。");
    }

    const updatedOperation = await tx.agentOperation.update({
      where: {
        id: operation.id,
      },
      data: {
        status: AgentOperationStatus.REJECTED,
        conflictCheck: "已由人工拒绝，未修改正式策略。",
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: operation.projectId,
        entityType: "AgentOperation",
        entityId: operation.id,
        action: "agent_command_rejected",
        summary: `拒绝 Agent 变更：${operation.summary}`,
        before: operationToJson(operation),
        after: operationToJson(updatedOperation),
        actorUserId: input.userId,
      },
    });

    if (operation.conversationId) {
      await tx.agentMessage.create({
        data: {
          workspaceId: input.workspaceId,
          conversationId: operation.conversationId,
          role: AgentMessageRole.ASSISTANT,
          content: `已拒绝本次变更，正式策略保持不变：${operation.summary}`,
        },
      });
    }

    return updatedOperation;
  });
}

async function findActivePlanChannelUsage(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
): Promise<ActivePlanChannelUsage[]> {
  const removedChannels = unique(
    input.operations.flatMap((operation) =>
      operation.type === "remove_channel" ? [operation.value] : [],
    ),
  );

  if (removedChannels.length === 0) {
    return [];
  }

  return tx.contentPlanItem.findMany({
    where: scopedWhere(input.workspaceId, {
      projectId: input.projectId,
      channel: {
        in: removedChannels,
      },
      status: {
        not: PlanItemStatus.DONE,
      },
    }) as Prisma.ContentPlanItemWhereInput,
    select: {
      channel: true,
      title: true,
      week: true,
    },
    orderBy: [
      {
        week: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    take: 5,
  });
}

async function findCompletionTargetWarnings(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  const warnings: string[] = [];

  for (const operation of input.operations) {
    if (operation.type === "complete_reminder") {
      const matchCount = await tx.reminder.count({
        where: buildReminderCompletionWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          keyword: operation.value.keyword,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到标题或说明包含「${operation.value.keyword}」的开放提醒`);
      }
    }

    if (operation.type === "dismiss_reminder") {
      const matchCount = await tx.reminder.count({
        where: buildReminderCompletionWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          keyword: operation.value.keyword,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到标题或说明包含「${operation.value.keyword}」的开放提醒`);
      }
    }

    if (operation.type === "update_reminder_due_date") {
      const matchCount = await tx.reminder.count({
        where: buildReminderCompletionWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          keyword: operation.value.keyword,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到标题或说明包含「${operation.value.keyword}」的开放提醒`);
      }
    }

    if (operation.type === "complete_plan_item") {
      const matchCount = await tx.contentPlanItem.count({
        where: buildPlanItemCompletionWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${describePlanItemCompletionValue(operation.value)}」的未完成内容计划`);
      }
    }

    if (operation.type === "update_plan_item_status") {
      const matchCount = await tx.contentPlanItem.count({
        where: buildPlanItemStatusWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${describePlanItemStatusValue(operation.value)}」的内容计划`);
      }
    }

    if (operation.type === "update_plan_item_due_date") {
      const matchCount = await tx.contentPlanItem.count({
        where: buildPlanItemDueDateWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${describePlanItemDueDateValue(operation.value)}」的内容计划`);
      }
    }

    if (operation.type === "submit_content_package_review") {
      const matchCount = await tx.contentPackage.count({
        where: buildContentPackageReviewWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${operation.value.keyword ?? "最新素材包"}」的可提交素材包`);
      }
    }

    if (operation.type === "decide_content_package_review") {
      const matchCount = await tx.reviewTask.count({
        where: buildContentPackageReviewDecisionWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${operation.value.keyword ?? "最新素材包"}」的待审核素材包任务`);
      }
    }

    if (operation.type === "decide_review_task") {
      const matchCount = await tx.reviewTask.count({
        where: await buildReviewTaskDecisionWhere(tx, {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(
          `未找到匹配「${describeReviewTaskDecisionValue(operation.value)}」的待审核任务`,
        );
      }
    }

    if (operation.type === "cancel_review_task") {
      const matchCount = await tx.reviewTask.count({
        where: await buildReviewTaskDecisionWhere(tx, {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(
          `未找到匹配「${describeReviewTaskSelectionValue(operation.value)}」的待审核任务`,
        );
      }
    }

    if (operation.type === "create_product_fact") {
      const linkedProductCount = await tx.projectProduct.count({
        where: buildProjectProductWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        }),
      });

      if (linkedProductCount === 0) {
        warnings.push("当前项目还没有关联产品，无法写入产品事实");
      }
    }

    if (operation.type === "infer_product_facts_from_text") {
      const linkedProductCount = await tx.projectProduct.count({
        where: buildProjectProductWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        }),
      });

      if (linkedProductCount === 0) {
        warnings.push("当前项目还没有关联产品，无法从产品资料提取事实");
      }
    }

    if (operation.type === "confirm_product_facts") {
      const unconfirmedFactCount = await countUnconfirmedLinkedProductFacts(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      });

      if (unconfirmedFactCount === 0) {
        warnings.push("当前项目没有待确认或待复核产品事实");
      }
    }

    if (operation.type === "recommend_strategy") {
      const projectProduct = await tx.projectProduct.findFirst({
        where: buildProjectProductWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        }),
        include: {
          product: {
            include: {
              facts: {
                where: {
                  workspaceId: input.workspaceId,
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!projectProduct || projectProduct.product.facts.length === 0) {
        warnings.push("当前项目还没有可用于推荐策略的产品事实，请先录入或提取产品事实");
      }
    }

    if (operation.type === "create_metrics_risk_reminders") {
      const metricsCount = await tx.metricsSnapshot.count({
        where: scopedWhere(input.workspaceId, {
          projectId: input.projectId,
        }) as Prisma.MetricsSnapshotWhereInput,
      });

      if (metricsCount === 0) {
        warnings.push("当前项目还没有复盘指标，无法生成数据风险提醒");
      }
    }

    if (operation.type === "create_calendar_gap_reminders") {
      const latestStrategy = await tx.projectStrategy.findFirst({
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

      if (!latestStrategy || latestStrategy.channels.length === 0) {
        warnings.push("当前项目还没有可用于检查内容日历缺口的策略渠道");
      }
    }

    if (operation.type === "create_content_package_readiness_reminders") {
      const matchCount = await tx.contentPackage.count({
        where: buildContentPackageReadinessReminderWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${operation.value.keyword ?? "最新素材包"}」的素材包`);
      }
    }

    if (operation.type === "update_content_package_files_status") {
      const matchCount = await tx.contentPackage.count({
        where: buildContentPackageFilesStatusWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (matchCount === 0) {
        warnings.push(`未找到匹配「${operation.value.keyword ?? "最新素材包"}」的素材包`);
      }
    }

    if (operation.type === "attach_latest_poster_to_content_package") {
      const contentPackage = await tx.contentPackage.findFirst({
        where: buildPosterAttachmentPackageWhere({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
        include: {
          files: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (!contentPackage) {
        warnings.push(
          `未找到匹配「${operation.value.packageKeyword ?? "最新素材包"}」的素材包`,
        );
      } else if (!findPosterPackageFile(contentPackage.files)) {
        warnings.push(`素材包「${contentPackage.name}」中没有模板化海报图片文件项`);
      }

      const assetCount = await tx.asset.count({
        where: await buildPosterAttachmentAssetWhere(tx, {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          value: operation.value,
        }),
      });

      if (assetCount === 0) {
        warnings.push("当前项目没有可关联的已审核模板海报 Asset");
      }
    }
  }

  return warnings;
}

function buildAgentConflictCheck(input: {
  noSafeOperation: boolean;
  requiresConfirmation: boolean;
  hasConfirmationSensitiveOperation: boolean;
  strategy: ProjectStrategyRecord;
  operations: ParsedAgentOperation[];
  activePlanChannelUsage: ActivePlanChannelUsage[];
  completionTargetWarnings: string[];
}) {
  const base = input.noSafeOperation
    ? "未识别到足够明确的市场、渠道、频率、项目状态、产品事实、提醒、内容计划、素材包、审核或复盘动作，未写入数据库。"
    : input.completionTargetWarnings.length > 0
      ? `已识别到任务类指令，但${input.completionTargetWarnings.join("；")}，未写入数据库。`
    : input.requiresConfirmation
      ? "当前策略已被人工确认为正式版本，需要二次确认后才能修改核心项目配置。"
      : input.hasConfirmationSensitiveOperation
        ? "当前策略仍为草案，可直接应用。"
        : "该操作不改动正式策略，已直接写入项目工作台。";
  const risks = input.noSafeOperation ? [] : buildAgentRiskMessages(input);

  if (risks.length === 0) {
    return base;
  }

  return `${base} 风险提示：${risks.join("；")}。`;
}

function buildAgentRiskMessages(input: {
  strategy: ProjectStrategyRecord;
  operations: ParsedAgentOperation[];
  activePlanChannelUsage: ActivePlanChannelUsage[];
}) {
  const strategyOperations = input.operations.filter(isStrategyOperation);
  const projectOperations = input.operations.filter(isProjectOperation);
  const nextStrategy =
    strategyOperations.length > 0
      ? applyOperationsToStrategy(input.strategy, strategyOperations)
      : strategyToJson(input.strategy);
  const risks: string[] = [];

  if (strategyOperations.length > 0 && nextStrategy.channels.length === 0) {
    risks.push("应用后策略将没有任何投放渠道，请先新增至少一个渠道");
  }

  if (strategyOperations.length > 0 && nextStrategy.contentDirections.length === 0) {
    risks.push("应用后内容方向为空，后续素材包会缺少主题主线");
  }

  if (input.activePlanChannelUsage.length > 0) {
    const channelText = unique(input.activePlanChannelUsage.map((item) => item.channel)).join("、");
    const example = input.activePlanChannelUsage[0];
    risks.push(
      `内容日历仍有 ${input.activePlanChannelUsage.length} 个未完成计划使用 ${channelText}，例如第${example.week}周「${example.title}」`,
    );
  }

  if (
    strategyOperations.some(
      (operation) =>
        operation.type === "set_package_frequency" &&
        operation.value === ContentFrequency.MONTHLY &&
        input.strategy.packageFrequency !== ContentFrequency.MONTHLY,
    )
  ) {
    risks.push("素材包频率将降为每月一次，首月验证节奏可能变慢");
  }

  if (
    projectOperations.some(
      (operation) =>
        operation.type === "set_project_status" &&
        (operation.value === ProjectStatus.PAUSED || operation.value === ProjectStatus.ARCHIVED),
    )
  ) {
    risks.push("暂停或归档项目会影响后续计划推进、素材包审核和提醒处理");
  }

  return risks;
}

export async function confirmProjectStrategy(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  strategyId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const strategy = await tx.projectStrategy.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.strategyId,
        projectId: input.projectId,
        status: StrategyStatus.DRAFT,
      }) as Prisma.ProjectStrategyWhereInput,
    });

    if (!strategy) {
      throw new Error("未找到可确认的策略草案。");
    }

    const updatedStrategy = await tx.projectStrategy.update({
      where: {
        id: strategy.id,
      },
      data: {
        status: StrategyStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ProjectStrategy",
        entityId: strategy.id,
        action: "strategy_confirmed",
        summary: `确认正式策略 v${strategy.version}。`,
        before: strategyToJson(strategy),
        after: strategyToJson(updatedStrategy),
        actorUserId: input.userId,
      },
    });

    const conversation = await ensureConversation(tx, input.workspaceId, input.projectId);

    await tx.agentMessage.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        role: AgentMessageRole.ASSISTANT,
        content: `正式策略 v${strategy.version} 已确认。后续中文修改会先做冲突检查，需要确认后才会改动正式策略。`,
      },
    });

    return updatedStrategy;
  });
}

export async function generateStarterPlan(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const strategy = await ensureProjectStrategy(tx, input.workspaceId, input.projectId);

    return createStarterPlanIfMissing(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: input.projectId,
      strategy,
    });
  });
}

async function createStarterPlanIfMissing(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    strategy: ProjectStrategyRecord;
  },
) {
  const existingPlanCount = await tx.contentPlanItem.count({
    where: scopedWhere(input.workspaceId, {
      projectId: input.projectId,
    }),
  });

  if (existingPlanCount > 0) {
    return {
      created: false,
      message: "该项目已经有首月计划，本次没有重复生成。",
    };
  }

  const channels =
    input.strategy.channels.length > 0 ? input.strategy.channels : ["TikTok", "Instagram"];
  const themes = ["新品认知", "场景种草", "礼品转化", "复盘加码"];
  const today = new Date();

  await Promise.all(
    themes.map((theme, index) =>
      tx.contentPlanItem.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          strategyId: input.strategy.id,
          week: index + 1,
          channel: channels[index % channels.length],
          theme,
          title: `${theme}内容任务`,
          deliverable: "平台文案、发布配文、模板化海报和审核清单",
          dueDate: addDays(today, (index + 1) * 7),
          status: PlanItemStatus.READY,
        },
      }),
    ),
  );

  const contentPackage = await tx.contentPackage.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      strategyId: input.strategy.id,
      name: "首月第一份素材包",
      period: "首月第 1 周",
      frequency: input.strategy.packageFrequency,
      status: ContentPackageStatus.DRAFT,
      summary: "本地生成素材包结构清单，后续阶段接入真实文件导出。",
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

  await tx.reminder.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      title: "检查首月素材包中的活动规则",
      description: "如果素材包包含抽奖或促销活动，请在发布前确认奖品、规则和合规免责声明。",
      severity: ReminderSeverity.WARNING,
      status: ReminderStatus.OPEN,
    },
  });

  await tx.changeLog.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      entityType: "ContentPlanItem",
      entityId: input.projectId,
      action: "starter_plan_generated",
      summary: "生成首月计划和第一份素材包结构。",
      actorUserId: input.userId,
    },
  });

  return {
    created: true,
    message: "已生成首月计划和第一份素材包结构。",
  };
}

async function ensureConversation(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectId: string,
) {
  const existingConversation = await tx.agentConversation.findFirst({
    where: scopedWhere(workspaceId, {
      projectId,
    }) as Prisma.AgentConversationWhereInput,
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingConversation) {
    return existingConversation;
  }

  return tx.agentConversation.create({
    data: {
      workspaceId,
      projectId,
      title: "项目增长顾问对话",
    },
  });
}

async function ensureProjectStrategy(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectId: string,
) {
  const existingStrategy = await tx.projectStrategy.findFirst({
    where: scopedWhere(workspaceId, {
      projectId,
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

  if (existingStrategy) {
    return existingStrategy;
  }

  await tx.project.update({
    where: {
      id: projectId,
    },
    data: {
      status: ProjectStatus.ACTIVE,
    },
  });

  return tx.projectStrategy.create({
    data: {
      workspaceId,
      projectId,
      version: 1,
      status: StrategyStatus.DRAFT,
      targetMarkets: [],
      audiences: ["待 AI 顾问根据产品事实细化"],
      channels: [],
      contentDirections: [],
      packageFrequency: ContentFrequency.MONTHLY,
      positioning: "等待用户输入产品、市场和渠道信息。",
      rationale: "由本地规则型 Agent 先保存结构化草案，后续可替换为真实 AI 推荐。",
    },
  });
}

function applyOperationsToStrategy(
  strategy: ProjectStrategyRecord,
  operations: ParsedAgentOperation[],
): StrategyMutableFields {
  let targetMarkets = [...strategy.targetMarkets];
  let audiences = [...strategy.audiences];
  let channels = [...strategy.channels];
  let contentDirections = [...strategy.contentDirections];
  let packageFrequency = strategy.packageFrequency;

  for (const operation of operations) {
    if (operation.type === "set_market") {
      targetMarkets = unique([operation.value, ...targetMarkets]);
    }

    if (operation.type === "add_channel") {
      channels = unique([...channels, operation.value]);
    }

    if (operation.type === "add_audience") {
      audiences = unique([...audiences, operation.value]);
    }

    if (operation.type === "remove_audience") {
      audiences = audiences.filter(
        (audience) => audience.toLowerCase() !== operation.value.toLowerCase(),
      );
    }

    if (operation.type === "remove_channel") {
      channels = channels.filter(
        (channel) => channel.toLowerCase() !== operation.value.toLowerCase(),
      );
    }

    if (operation.type === "set_package_frequency") {
      packageFrequency = operation.value;
    }

    if (operation.type === "add_content_direction") {
      contentDirections = unique([...contentDirections, operation.value]);
    }

    if (operation.type === "remove_content_direction") {
      contentDirections = contentDirections.filter(
        (direction) => direction.toLowerCase() !== operation.value.toLowerCase(),
      );
    }
  }

  return {
    targetMarkets,
    audiences,
    channels,
    contentDirections,
    packageFrequency,
  };
}

function applyOperationsToProject(
  project: {
    status: ProjectStatus;
  },
  operations: ParsedAgentOperation[],
) {
  let status = project.status;

  for (const operation of operations) {
    if (operation.type === "set_project_status") {
      status = operation.value;
    }
  }

  return {
    status,
  };
}

async function applyReminderOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_reminder") {
      continue;
    }

    const reminder = await tx.reminder.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        title: operation.value,
        description: "由 B 组 Agent 中文指令创建。",
        severity: operation.severity,
        status: ReminderStatus.OPEN,
        dueAt: operation.dueAt ? new Date(`${operation.dueAt}T00:00:00`) : null,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: "agent_reminder_created",
        summary: operation.label,
        after: reminderToJson(reminder),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyProjectHealthReminderOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    project: {
      id: string;
      name: string;
      status: ProjectStatus;
    };
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_project_health_reminders") {
      continue;
    }

    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.project.id,
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
      continue;
    }

    const health = buildProjectHealthSummary(
      await collectProjectHealthInput(tx, input.workspaceId, project),
    );
    const drafts = buildProjectHealthReminderDrafts(health, operation.value.limit);
    let createdCount = 0;
    let skippedCount = 0;

    for (const draft of drafts) {
      const existingReminder = await tx.reminder.findFirst({
        where: scopedWhere(input.workspaceId, {
          projectId: input.project.id,
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
          projectId: input.project.id,
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
          projectId: input.project.id,
          entityType: "Reminder",
          entityId: reminder.id,
          action: "agent_project_health_reminder_created",
          summary: `Agent 体检缺口生成提醒：${draft.title}`,
          after: reminderToJson(reminder),
          actorUserId: input.userId,
        },
      });

      createdCount += 1;
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        entityType: "Project",
        entityId: input.project.id,
        action: "agent_project_health_reminders_generated",
        summary: `${operation.label}：新增 ${createdCount} 条，跳过重复 ${skippedCount} 条。`,
        after: {
          projectHealthScore: health.score,
          projectHealthRating: health.rating,
          createdCount,
          skippedCount,
          totalCandidates: drafts.length,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyProductFactOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  if (input.operations.length === 0) {
    return;
  }

  const projectProduct = await tx.projectProduct.findFirst({
    where: buildProjectProductWhere({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    }),
    include: {
      product: {
        include: {
          facts: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!projectProduct) {
    return;
  }

  for (const operation of input.operations) {
    if (operation.type !== "create_product_fact") {
      continue;
    }

    const productFact = await tx.productFact.create({
      data: {
        workspaceId: input.workspaceId,
        productId: projectProduct.productId,
        label: operation.value.label,
        value: operation.value.value,
        source: operation.value.source,
        confidence: 90,
        status: ProductFactStatus.NEEDS_REVIEW,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ProductFact",
        entityId: productFact.id,
        action: "agent_product_fact_created",
        summary: operation.label,
        after: productFactToJson(productFact),
        actorUserId: input.userId,
      },
    });
  }

  for (const operation of input.operations) {
    if (operation.type !== "infer_product_facts_from_text") {
      continue;
    }

    const inferredFacts = inferProductFactsFromText({
      productName: projectProduct.product.name,
      description: projectProduct.product.description,
      sourceText: operation.value.sourceText,
    });
    const existingFactsByLabel = new Map(
      projectProduct.product.facts.map((fact) => [fact.label, fact]),
    );
    const result = {
      created: 0,
      updated: 0,
      skippedConfirmed: 0,
    };

    for (const fact of inferredFacts) {
      const existingFact = existingFactsByLabel.get(fact.label);

      if (!existingFact) {
        const createdFact = await tx.productFact.create({
          data: {
            workspaceId: input.workspaceId,
            productId: projectProduct.productId,
            label: fact.label,
            value: fact.value,
            source: operation.value.source,
            confidence: fact.confidence,
            status: ProductFactStatus.NEEDS_REVIEW,
          },
        });

        existingFactsByLabel.set(createdFact.label, createdFact);
        result.created += 1;
        continue;
      }

      if (existingFact.status === ProductFactStatus.CONFIRMED) {
        result.skippedConfirmed += 1;
        continue;
      }

      const updatedFact = await tx.productFact.update({
        where: {
          id: existingFact.id,
        },
        data: {
          value: fact.value,
          source: operation.value.source,
          confidence: fact.confidence,
          status: ProductFactStatus.NEEDS_REVIEW,
        },
      });

      existingFactsByLabel.set(updatedFact.label, updatedFact);
      result.updated += 1;
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ProductFact",
        entityId: projectProduct.productId,
        action: "agent_product_facts_inferred",
        summary: `${operation.label} · 新增 ${result.created} 条，更新 ${result.updated} 条，跳过已确认 ${result.skippedConfirmed} 条`,
        after: {
          source: operation.value.source,
          sourceTextPreview: operation.value.sourceText.slice(0, 160),
          ...result,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyProductFactConfirmationOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "confirm_product_facts") {
      continue;
    }

    const productIds = await findProjectLinkedProductIds(tx, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });

    if (productIds.length === 0) {
      continue;
    }

    const facts = await tx.productFact.findMany({
      where: scopedWhere(input.workspaceId, {
        productId: {
          in: productIds,
        },
        status: {
          in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
        },
      }) as Prisma.ProductFactWhereInput,
      orderBy: {
        createdAt: "asc",
      },
    });

    if (facts.length === 0) {
      continue;
    }

    const result = await tx.productFact.updateMany({
      where: scopedWhere(input.workspaceId, {
        id: {
          in: facts.map((fact) => fact.id),
        },
      }) as Prisma.ProductFactWhereInput,
      data: {
        status: ProductFactStatus.CONFIRMED,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ProductFact",
        entityId: input.projectId,
        action: "agent_product_facts_confirmed",
        summary: `${operation.label}：确认 ${result.count} 条。`,
        before: {
          factIds: facts.map((fact) => fact.id),
          statuses: facts.map((fact) => fact.status),
        },
        after: {
          status: ProductFactStatus.CONFIRMED,
          count: result.count,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyStrategyRecommendationOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    project: {
      id: string;
      name: string;
      description: string | null;
    };
    strategy: ProjectStrategyRecord;
    operations: ParsedAgentOperation[];
  },
) {
  let latestStrategy = input.strategy;

  for (const operation of input.operations) {
    if (operation.type !== "recommend_strategy") {
      continue;
    }

    const linkedProducts = await tx.projectProduct.findMany({
      where: buildProjectProductWhere({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      include: {
        product: {
          include: {
            facts: {
              where: {
                workspaceId: input.workspaceId,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (linkedProducts.length === 0) {
      continue;
    }

    const recommendation = buildStrategyRecommendation({
      projectName: input.project.name,
      products: linkedProducts.map(({ product }) => ({
        name: product.name,
        description: product.description,
        facts: product.facts.map((fact) => ({
          label: fact.label,
          value: fact.value,
          status: fact.status,
        })),
      })),
      contextText: operation.value.contextText,
    });
    const before = strategyToJson(latestStrategy);

    if (latestStrategy.status === StrategyStatus.CONFIRMED) {
      latestStrategy = await tx.projectStrategy.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          version: latestStrategy.version + 1,
          status: StrategyStatus.DRAFT,
          targetMarkets: recommendation.targetMarkets,
          audiences: recommendation.audiences,
          channels: recommendation.channels,
          contentDirections: recommendation.contentDirections,
          packageFrequency: recommendation.packageFrequency,
          positioning: recommendation.positioning,
          rationale: recommendation.rationale,
        },
      });
    } else {
      latestStrategy = await tx.projectStrategy.update({
        where: {
          id: latestStrategy.id,
        },
        data: {
          status: StrategyStatus.DRAFT,
          targetMarkets: recommendation.targetMarkets,
          audiences: recommendation.audiences,
          channels: recommendation.channels,
          contentDirections: recommendation.contentDirections,
          packageFrequency: recommendation.packageFrequency,
          positioning: recommendation.positioning,
          rationale: recommendation.rationale,
          confirmedAt: null,
        },
      });
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        entityType: "ProjectStrategy",
        entityId: latestStrategy.id,
        action: "agent_strategy_recommended",
        summary: operation.label,
        before,
        after: strategyToJson(latestStrategy),
        actorUserId: input.userId,
      },
    });
  }

  return latestStrategy;
}

async function applyMetricsOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_metrics_snapshot") {
      continue;
    }

    const metricsSnapshot = await tx.metricsSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        period: operation.value.period,
        channel: operation.value.channel,
        impressions: operation.value.impressions,
        clicks: operation.value.clicks,
        conversions: operation.value.conversions,
        spendCents: operation.value.spendCents,
        notes: operation.value.notes,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "MetricsSnapshot",
        entityId: metricsSnapshot.id,
        action: "agent_metrics_snapshot_created",
        summary: operation.label,
        after: {
          id: metricsSnapshot.id,
          period: metricsSnapshot.period,
          channel: metricsSnapshot.channel,
          impressions: metricsSnapshot.impressions,
          clicks: metricsSnapshot.clicks,
          conversions: metricsSnapshot.conversions,
          spendCents: metricsSnapshot.spendCents,
          notes: metricsSnapshot.notes,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyMetricsRiskReminderOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_metrics_risk_reminders") {
      continue;
    }

    const metricsSnapshots = await tx.metricsSnapshot.findMany({
      where: scopedWhere(input.workspaceId, {
        projectId: input.projectId,
      }) as Prisma.MetricsSnapshotWhereInput,
      include: {
        project: true,
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 12,
    });
    const candidates = buildMetricsReminderCandidates(metricsSnapshots).slice(
      0,
      operation.value.limit,
    );
    let createdCount = 0;

    for (const candidate of candidates) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: candidate.projectId,
        title: candidate.title,
        description: candidate.description,
        severity: candidate.severity,
      });
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "MetricsSnapshot",
        entityId: input.projectId,
        action: "agent_metrics_risk_reminders_generated",
        summary: `${operation.label}：新增 ${createdCount} 条。`,
        after: {
          inspectedSnapshots: metricsSnapshots.length,
          riskCandidates: candidates.length,
          createdCount,
        },
        actorUserId: input.userId,
      },
    });
  }
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

async function applyPlanItemOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    strategyId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_plan_item") {
      continue;
    }

    const planItem = await tx.contentPlanItem.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        strategyId: input.strategyId,
        week: operation.value.week,
        channel: operation.value.channel,
        theme: operation.value.theme,
        title: operation.value.title,
        deliverable: operation.value.deliverable,
        dueDate: operation.value.dueDate ? new Date(`${operation.value.dueDate}T00:00:00`) : null,
        status: operation.value.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "agent_plan_item_created",
        summary: operation.label,
        after: {
          id: planItem.id,
          week: planItem.week,
          channel: planItem.channel,
          theme: planItem.theme,
          title: planItem.title,
          deliverable: planItem.deliverable,
          dueDate: planItem.dueDate,
          status: planItem.status,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPlanItemStatusOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "update_plan_item_status") {
      continue;
    }

    const planItem = await tx.contentPlanItem.findFirst({
      where: buildPlanItemStatusWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          week: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!planItem) {
      continue;
    }

    const updatedPlanItem = await tx.contentPlanItem.update({
      where: {
        id: planItem.id,
      },
      data: {
        status: operation.value.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "agent_plan_item_status_updated",
        summary: operation.label,
        before: planItemToJson(planItem),
        after: planItemToJson(updatedPlanItem),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPlanItemDueDateOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "update_plan_item_due_date") {
      continue;
    }

    const planItem = await tx.contentPlanItem.findFirst({
      where: buildPlanItemDueDateWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          week: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!planItem) {
      continue;
    }

    const updatedPlanItem = await tx.contentPlanItem.update({
      where: {
        id: planItem.id,
      },
      data: {
        dueDate: new Date(`${operation.value.dueDate}T00:00:00`),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "agent_plan_item_due_date_updated",
        summary: operation.label,
        before: planItemToJson(planItem),
        after: planItemToJson(updatedPlanItem),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyCalendarGapReminderOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    strategy: ProjectStrategyRecord;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_calendar_gap_reminders") {
      continue;
    }

    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
      select: {
        id: true,
        name: true,
      },
    });

    if (!project) {
      continue;
    }

    const planItems = await tx.contentPlanItem.findMany({
      where: scopedWhere(input.workspaceId, {
        projectId: input.projectId,
        status: {
          not: PlanItemStatus.DONE,
        },
      }) as Prisma.ContentPlanItemWhereInput,
      select: {
        week: true,
        channel: true,
      },
    });
    const reminderDrafts = buildCalendarGapReminderDrafts({
      projectName: project.name,
      channels: input.strategy.channels,
      planItems,
      limit: operation.value.limit,
    });
    let createdCount = 0;

    for (const draft of reminderDrafts) {
      createdCount += await createReminderIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
      });
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPlanItem",
        entityId: input.projectId,
        action: "agent_calendar_gap_reminders_generated",
        summary: `${operation.label}：新增 ${createdCount} 条。`,
        after: {
          strategyChannels: input.strategy.channels,
          activePlanItems: planItems.length,
          gapCandidates: reminderDrafts.length,
          createdCount,
        },
        actorUserId: input.userId,
      },
    });
  }
}

function buildCalendarGapReminderDrafts(input: {
  projectName: string;
  channels: string[];
  planItems: Array<{
    week: number;
    channel: string;
  }>;
  limit: number;
}) {
  const plannedChannels = new Set(input.planItems.map((item) => item.channel));
  const plannedWeeks = new Set(input.planItems.map((item) => item.week));
  const drafts: Array<{
    title: string;
    description: string;
    severity: ReminderSeverity;
  }> = [];

  for (const channel of input.channels) {
    if (!plannedChannels.has(channel)) {
      drafts.push({
        title: `${input.projectName}：${channel} 尚未排入内容日历`,
        description:
          "该渠道已在当前策略中，但内容日历还没有对应未完成计划。建议补充主题、交付物和截止日期。",
        severity: ReminderSeverity.WARNING,
      });
    }
  }

  for (const week of [1, 2, 3, 4]) {
    if (!plannedWeeks.has(week)) {
      drafts.push({
        title: `${input.projectName}：第${week}周缺少内容计划`,
        description:
          "首月计划应覆盖至少 4 周，避免素材包生成时缺少明确主题和交付物。",
        severity: ReminderSeverity.INFO,
      });
    }
  }

  return drafts.slice(0, input.limit);
}

async function applyContentPackageOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    strategyId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_content_package") {
      continue;
    }

    const contentPackage = await tx.contentPackage.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        strategyId: input.strategyId,
        name: operation.value.name,
        period: operation.value.period,
        frequency: operation.value.frequency,
        status: ContentPackageStatus.DRAFT,
        summary: operation.value.summary,
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
        projectId: input.projectId,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "agent_content_package_created",
        summary: operation.label,
        after: {
          id: contentPackage.id,
          name: contentPackage.name,
          period: contentPackage.period,
          frequency: contentPackage.frequency,
          status: contentPackage.status,
          fileCount: DEFAULT_CONTENT_PACKAGE_FILES.length,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPackageReadinessReminderOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_content_package_readiness_reminders") {
      continue;
    }

    const contentPackage = await tx.contentPackage.findFirst({
      where: buildContentPackageReadinessReminderWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
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

    if (!contentPackage) {
      continue;
    }

    const productIds = contentPackage.project.projectProducts.map(
      (projectProduct) => projectProduct.productId,
    );
    const sourceAssets = await tx.asset.findMany({
      where: scopedWhere(input.workspaceId, {
        status: AssetStatus.APPROVED,
        kind: {
          in: [AssetKind.PRODUCT_IMAGE, AssetKind.LOGO],
        },
        OR: [
          {
            projectId: contentPackage.projectId,
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
        ],
      }) as Prisma.AssetWhereInput,
      select: {
        kind: true,
        status: true,
      },
    });
    const readiness = buildContentPackageReadiness({
      id: contentPackage.id,
      name: contentPackage.name,
      status: contentPackage.status,
      sourceAssets,
      files: contentPackage.files.map((file) => ({
        status: file.status,
        asset: file.asset
          ? {
              kind: file.asset.kind,
              status: file.asset.status,
            }
          : null,
      })),
    });
    let createdCount = 0;
    let skippedCount = 0;

    for (const signal of readiness.blockingSignals.slice(0, operation.value.limit)) {
      const title = `${contentPackage.name}：${signal.action}`;
      const existingReminder = await tx.reminder.findFirst({
        where: scopedWhere(input.workspaceId, {
          projectId: input.projectId,
          title,
          status: ReminderStatus.OPEN,
        }) as Prisma.ReminderWhereInput,
      });

      if (existingReminder) {
        skippedCount += 1;
        continue;
      }

      const reminder = await tx.reminder.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          title,
          description: `${signal.summary} 来源：素材包可交付性检查。`,
          severity: signal.blocking ? ReminderSeverity.WARNING : ReminderSeverity.INFO,
          status: ReminderStatus.OPEN,
        },
      });

      await tx.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          entityType: "Reminder",
          entityId: reminder.id,
          action: "agent_package_readiness_reminder_created",
          summary: `素材包缺口生成提醒：${title}`,
          after: reminderToJson(reminder),
          actorUserId: input.userId,
        },
      });

      createdCount += 1;
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "agent_package_readiness_reminders_generated",
        summary: `${operation.label}：新增 ${createdCount} 条，跳过重复 ${skippedCount} 条。`,
        after: {
          readinessRating: readiness.rating,
          readinessScore: readiness.score,
          blockingSignals: readiness.blockingSignals.map((signal) => signal.key),
          createdCount,
          skippedCount,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPackageFilesStatusOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "update_content_package_files_status") {
      continue;
    }

    const contentPackage = await tx.contentPackage.findFirst({
      where: buildContentPackageFilesStatusWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      include: {
        files: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!contentPackage) {
      continue;
    }

    const fileIds = contentPackage.files.map((file) => file.id);

    if (fileIds.length === 0) {
      continue;
    }

    const result = await tx.contentPackageFile.updateMany({
      where: {
        id: {
          in: fileIds,
        },
        contentPackageId: contentPackage.id,
      },
      data: {
        status: operation.value.status,
      },
    });
    const nextPackageStatus =
      operation.value.status === PackageFileStatus.APPROVED
        ? ContentPackageStatus.APPROVED
        : ContentPackageStatus.GENERATED;
    const updatedContentPackage = await tx.contentPackage.update({
      where: {
        id: contentPackage.id,
      },
      data: {
        status: nextPackageStatus,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "agent_package_files_status_updated",
        summary: `${operation.label}：更新 ${result.count} 个文件项。`,
        before: {
          packageStatus: contentPackage.status,
          fileStatuses: contentPackage.files.map((file) => ({
            id: file.id,
            status: file.status,
          })),
        },
        after: {
          packageStatus: updatedContentPackage.status,
          fileStatus: operation.value.status,
          updatedFileCount: result.count,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPosterPackageAttachmentOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "attach_latest_poster_to_content_package") {
      continue;
    }

    const contentPackage = await tx.contentPackage.findFirst({
      where: buildPosterAttachmentPackageWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      include: {
        files: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    const posterAsset = await tx.asset.findFirst({
      where: await buildPosterAttachmentAssetWhere(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!contentPackage || !posterAsset) {
      continue;
    }

    const posterFile = findPosterPackageFile(contentPackage.files);

    if (!posterFile) {
      continue;
    }

    const updatedFile = await tx.contentPackageFile.update({
      where: {
        id: posterFile.id,
      },
      data: {
        assetId: posterAsset.id,
        status: PackageFileStatus.GENERATED,
        notes: `已关联素材：${posterAsset.name}`,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPackageFile",
        entityId: posterFile.id,
        action: "agent_poster_asset_attached_to_package",
        summary: operation.label,
        before: {
          assetId: posterFile.assetId,
          status: posterFile.status,
          notes: posterFile.notes,
        },
        after: {
          assetId: updatedFile.assetId,
          status: updatedFile.status,
          notes: updatedFile.notes,
          assetName: posterAsset.name,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPackageReviewOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "submit_content_package_review") {
      continue;
    }

    const contentPackage = await tx.contentPackage.findFirst({
      where: buildContentPackageReviewWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      include: {
        project: true,
        files: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!contentPackage) {
      continue;
    }

    const updatedContentPackage = await tx.contentPackage.update({
      where: {
        id: contentPackage.id,
      },
      data: {
        status: ContentPackageStatus.REVIEW_NEEDED,
      },
    });

    const taskCreated = await createReviewTaskIfMissing(tx, {
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
        projectId: input.projectId,
        entityType: "ContentPackage",
        entityId: contentPackage.id,
        action: "agent_content_package_submitted_for_review",
        summary: operation.label,
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
  }
}

async function applyPackageReviewDecisionOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "decide_content_package_review") {
      continue;
    }

    const reviewTask = await tx.reviewTask.findFirst({
      where: buildContentPackageReviewDecisionWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!reviewTask) {
      continue;
    }

    await tx.contentPackage.updateMany({
      where: {
        id: reviewTask.subjectId,
        workspaceId: input.workspaceId,
      },
      data: {
        status:
          operation.value.decision === ReviewTaskStatus.APPROVED
            ? ContentPackageStatus.APPROVED
            : ContentPackageStatus.REVIEW_NEEDED,
      },
    });

    const updatedTask = await tx.reviewTask.update({
      where: {
        id: reviewTask.id,
      },
      data: {
        status: operation.value.decision,
        reviewerUserId: input.userId,
        decisionNote: operation.value.decisionNote,
        decidedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ReviewTask",
        entityId: reviewTask.id,
        action:
          operation.value.decision === ReviewTaskStatus.APPROVED
            ? "agent_content_package_review_approved"
            : "agent_content_package_review_changes_requested",
        summary: operation.label,
        before: reviewTaskToJson(reviewTask),
        after: reviewTaskToJson(updatedTask),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyReviewTaskDecisionOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "decide_review_task") {
      continue;
    }

    const reviewTask = await tx.reviewTask.findFirst({
      where: await buildReviewTaskDecisionWhere(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!reviewTask) {
      continue;
    }

    await applyReviewTaskDecisionToSubject(tx, {
      workspaceId: input.workspaceId,
      reviewTask,
      decision: operation.value.decision,
    });

    const updatedTask = await tx.reviewTask.update({
      where: {
        id: reviewTask.id,
      },
      data: {
        status: operation.value.decision,
        reviewerUserId: input.userId,
        decisionNote: operation.value.decisionNote,
        decidedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: reviewTask.projectId ?? input.projectId,
        entityType: "ReviewTask",
        entityId: reviewTask.id,
        action:
          operation.value.decision === ReviewTaskStatus.APPROVED
            ? "agent_review_task_approved"
            : "agent_review_task_changes_requested",
        summary: operation.label,
        before: reviewTaskToJson(reviewTask),
        after: reviewTaskToJson(updatedTask),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyReviewTaskCancellationOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "cancel_review_task") {
      continue;
    }

    const reviewTask = await tx.reviewTask.findFirst({
      where: await buildReviewTaskDecisionWhere(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!reviewTask) {
      continue;
    }

    const updatedTask = await tx.reviewTask.update({
      where: {
        id: reviewTask.id,
      },
      data: {
        status: ReviewTaskStatus.CANCELED,
        reviewerUserId: input.userId,
        decisionNote: operation.value.decisionNote,
        decidedAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: reviewTask.projectId ?? input.projectId,
        entityType: "ReviewTask",
        entityId: reviewTask.id,
        action: "agent_review_task_canceled",
        summary: operation.label,
        before: reviewTaskToJson(reviewTask),
        after: reviewTaskToJson(updatedTask),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyMissingReviewTaskOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "create_missing_review_tasks") {
      continue;
    }

    const project = await tx.project.findFirst({
      where: scopedWhere(input.workspaceId, {
        id: input.projectId,
        deletedAt: null,
      }),
      select: {
        id: true,
        name: true,
        projectProducts: {
          select: {
            productId: true,
          },
        },
      },
    });

    if (!project) {
      continue;
    }

    const productIds = project.projectProducts.map((projectProduct) => projectProduct.productId);
    const [strategyDrafts, packageReviews, assetReviews, factReviews] = await Promise.all([
      tx.projectStrategy.findMany({
        where: scopedWhere(input.workspaceId, {
          projectId: input.projectId,
          status: StrategyStatus.DRAFT,
        }) as Prisma.ProjectStrategyWhereInput,
        orderBy: {
          updatedAt: "desc",
        },
      }),
      tx.contentPackage.findMany({
        where: scopedWhere(input.workspaceId, {
          projectId: input.projectId,
          status: {
            in: [ContentPackageStatus.DRAFT, ContentPackageStatus.REVIEW_NEEDED],
          },
        }) as Prisma.ContentPackageWhereInput,
        include: {
          files: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      tx.asset.findMany({
        where: scopedWhere(input.workspaceId, {
          status: AssetStatus.UPLOADED,
          OR: [
            {
              projectId: input.projectId,
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
          ],
        }) as Prisma.AssetWhereInput,
        orderBy: {
          createdAt: "desc",
        },
      }),
      productIds.length > 0
        ? tx.productFact.findMany({
            where: scopedWhere(input.workspaceId, {
              productId: {
                in: productIds,
              },
              status: {
                in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
              },
            }) as Prisma.ProductFactWhereInput,
            orderBy: {
              updatedAt: "desc",
            },
          })
        : Promise.resolve([]),
    ]);

    let createdCount = 0;

    for (const strategy of strategyDrafts) {
      createdCount += await createReviewTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        subjectType: ReviewSubjectType.PROJECT_STRATEGY,
        subjectId: strategy.id,
        title: `确认策略草案：${project.name} v${strategy.version}`,
        description: "策略草案需要人工确认后才能作为正式素材包生成依据。",
      });
    }

    for (const contentPackage of packageReviews) {
      createdCount += await createReviewTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        subjectType: ReviewSubjectType.CONTENT_PACKAGE,
        subjectId: contentPackage.id,
        title: `审核素材包：${contentPackage.name}`,
        description: `${project.name} · ${contentPackage.files.length} 个文件项 · ${contentPackage.summary ?? "待补充素材包说明"}`,
      });
    }

    for (const asset of assetReviews) {
      createdCount += await createReviewTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: asset.projectId ?? input.projectId,
        subjectType: ReviewSubjectType.ASSET,
        subjectId: asset.id,
        title: `审核素材：${asset.name}`,
        description: "请确认素材来源、产品主体、Logo 和文件格式是否符合 V1 发布要求。",
      });
    }

    for (const fact of factReviews) {
      createdCount += await createReviewTaskIfMissing(tx, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        subjectType: ReviewSubjectType.PRODUCT_FACT,
        subjectId: fact.id,
        title: `确认产品事实：${fact.label}`,
        description: fact.value,
      });
    }

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ReviewTask",
        entityId: input.projectId,
        action: "agent_missing_review_tasks_created",
        summary: `${operation.label}：新增 ${createdCount} 条。`,
        after: {
          strategyDrafts: strategyDrafts.length,
          packages: packageReviews.length,
          assets: assetReviews.length,
          productFacts: factReviews.length,
          createdCount,
        },
        actorUserId: input.userId,
      },
    });
  }
}

async function createReviewTaskIfMissing(
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

async function applyReminderCompletionOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "complete_reminder") {
      continue;
    }

    const reminder = await tx.reminder.findFirst({
      where: buildReminderCompletionWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        keyword: operation.value.keyword,
      }),
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!reminder) {
      continue;
    }

    const updatedReminder = await tx.reminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        status: ReminderStatus.DONE,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: "agent_reminder_completed",
        summary: operation.label,
        before: reminderToJson(reminder),
        after: reminderToJson(updatedReminder),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyReminderDismissalOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "dismiss_reminder") {
      continue;
    }

    const reminder = await tx.reminder.findFirst({
      where: buildReminderCompletionWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        keyword: operation.value.keyword,
      }),
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!reminder) {
      continue;
    }

    const updatedReminder = await tx.reminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        status: ReminderStatus.DISMISSED,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: "agent_reminder_dismissed",
        summary: operation.label,
        before: reminderToJson(reminder),
        after: reminderToJson(updatedReminder),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyReminderDueDateOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "update_reminder_due_date") {
      continue;
    }

    const reminder = await tx.reminder.findFirst({
      where: buildReminderCompletionWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        keyword: operation.value.keyword,
      }),
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!reminder) {
      continue;
    }

    const updatedReminder = await tx.reminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        dueAt: new Date(`${operation.value.dueAt}T00:00:00`),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "Reminder",
        entityId: reminder.id,
        action: "agent_reminder_due_date_updated",
        summary: operation.label,
        before: reminderToJson(reminder),
        after: reminderToJson(updatedReminder),
        actorUserId: input.userId,
      },
    });
  }
}

async function applyPlanItemCompletionOperations(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    userId: string;
    projectId: string;
    operations: ParsedAgentOperation[];
  },
) {
  for (const operation of input.operations) {
    if (operation.type !== "complete_plan_item") {
      continue;
    }

    const planItem = await tx.contentPlanItem.findFirst({
      where: buildPlanItemCompletionWhere({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        value: operation.value,
      }),
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          week: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (!planItem) {
      continue;
    }

    const updatedPlanItem = await tx.contentPlanItem.update({
      where: {
        id: planItem.id,
      },
      data: {
        status: PlanItemStatus.DONE,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "ContentPlanItem",
        entityId: planItem.id,
        action: "agent_plan_item_completed",
        summary: operation.label,
        before: planItemToJson(planItem),
        after: planItemToJson(updatedPlanItem),
        actorUserId: input.userId,
      },
    });
  }
}

function buildReminderCompletionWhere(input: {
  workspaceId: string;
  projectId: string;
  keyword: string;
}) {
  return scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: ReminderStatus.OPEN,
    OR: [
      {
        title: {
          contains: input.keyword,
        },
      },
      {
        description: {
          contains: input.keyword,
        },
      },
    ],
  }) as Prisma.ReminderWhereInput;
}

function buildPlanItemCompletionWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<ParsedAgentOperation, { type: "complete_plan_item" }>["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: {
      not: PlanItemStatus.DONE,
    },
  }) as Prisma.ContentPlanItemWhereInput;

  if (input.value.week) {
    where.week = input.value.week;
  }

  if (input.value.channel) {
    where.channel = input.value.channel;
  }

  if (input.value.keyword) {
    where.OR = [
      {
        title: {
          contains: input.value.keyword,
        },
      },
      {
        theme: {
          contains: input.value.keyword,
        },
      },
      {
        deliverable: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildPlanItemStatusWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<ParsedAgentOperation, { type: "update_plan_item_status" }>["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
  }) as Prisma.ContentPlanItemWhereInput;

  if (input.value.week) {
    where.week = input.value.week;
  }

  if (input.value.channel) {
    where.channel = input.value.channel;
  }

  if (input.value.keyword) {
    where.OR = [
      {
        title: {
          contains: input.value.keyword,
        },
      },
      {
        theme: {
          contains: input.value.keyword,
        },
      },
      {
        deliverable: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildPlanItemDueDateWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<ParsedAgentOperation, { type: "update_plan_item_due_date" }>["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
  }) as Prisma.ContentPlanItemWhereInput;

  if (input.value.week) {
    where.week = input.value.week;
  }

  if (input.value.channel) {
    where.channel = input.value.channel;
  }

  if (input.value.keyword) {
    where.OR = [
      {
        title: {
          contains: input.value.keyword,
        },
      },
      {
        theme: {
          contains: input.value.keyword,
        },
      },
      {
        deliverable: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildContentPackageReviewWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<ParsedAgentOperation, { type: "submit_content_package_review" }>["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: {
      in: [
        ContentPackageStatus.DRAFT,
        ContentPackageStatus.GENERATED,
        ContentPackageStatus.REVIEW_NEEDED,
      ],
    },
  }) as Prisma.ContentPackageWhereInput;

  if (input.value.keyword) {
    where.OR = [
      {
        name: {
          contains: input.value.keyword,
        },
      },
      {
        period: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildContentPackageReviewDecisionWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<ParsedAgentOperation, { type: "decide_content_package_review" }>["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: ReviewTaskStatus.PENDING,
    subjectType: ReviewSubjectType.CONTENT_PACKAGE,
  }) as Prisma.ReviewTaskWhereInput;

  if (input.value.keyword) {
    where.OR = [
      {
        title: {
          contains: input.value.keyword,
        },
      },
      {
        description: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

async function buildReviewTaskDecisionWhere(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    projectId: string;
    value: {
      subjectType?: ReviewSubjectType;
      keyword?: string;
    };
  },
) {
  const scopeOr: Prisma.ReviewTaskWhereInput[] = [
    {
      projectId: input.projectId,
    },
  ];

  if (
    !input.value.subjectType ||
    input.value.subjectType === ReviewSubjectType.PRODUCT_FACT
  ) {
    const factIds = await findLinkedProductFactIds(tx, input);

    if (factIds.length > 0) {
      scopeOr.push({
        subjectType: ReviewSubjectType.PRODUCT_FACT,
        subjectId: {
          in: factIds,
        },
      });
    }
  }

  if (!input.value.subjectType || input.value.subjectType === ReviewSubjectType.ASSET) {
    const assetIds = await findLinkedAssetIds(tx, input);

    if (assetIds.length > 0) {
      scopeOr.push({
        subjectType: ReviewSubjectType.ASSET,
        subjectId: {
          in: assetIds,
        },
      });
    }
  }

  const andConditions: Prisma.ReviewTaskWhereInput[] = [
    {
      OR: scopeOr,
    },
  ];

  if (input.value.keyword) {
    andConditions.push({
      OR: [
        {
          title: {
            contains: input.value.keyword,
          },
        },
        {
          description: {
            contains: input.value.keyword,
          },
        },
      ],
    });
  }

  return scopedWhere(input.workspaceId, {
    status: ReviewTaskStatus.PENDING,
    ...(input.value.subjectType ? { subjectType: input.value.subjectType } : {}),
    AND: andConditions,
  }) as Prisma.ReviewTaskWhereInput;
}

function buildContentPackageReadinessReminderWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<
    ParsedAgentOperation,
    { type: "create_content_package_readiness_reminders" }
  >["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: {
      not: ContentPackageStatus.ARCHIVED,
    },
  }) as Prisma.ContentPackageWhereInput;

  if (input.value.keyword) {
    where.OR = [
      {
        name: {
          contains: input.value.keyword,
        },
      },
      {
        period: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildContentPackageFilesStatusWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<
    ParsedAgentOperation,
    { type: "update_content_package_files_status" }
  >["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: {
      not: ContentPackageStatus.ARCHIVED,
    },
  }) as Prisma.ContentPackageWhereInput;

  if (input.value.keyword) {
    where.OR = [
      {
        name: {
          contains: input.value.keyword,
        },
      },
      {
        period: {
          contains: input.value.keyword,
        },
      },
    ];
  }

  return where;
}

function buildPosterAttachmentPackageWhere(input: {
  workspaceId: string;
  projectId: string;
  value: Extract<
    ParsedAgentOperation,
    { type: "attach_latest_poster_to_content_package" }
  >["value"];
}) {
  const where = scopedWhere(input.workspaceId, {
    projectId: input.projectId,
    status: {
      not: ContentPackageStatus.ARCHIVED,
    },
  }) as Prisma.ContentPackageWhereInput;

  if (input.value.packageKeyword) {
    where.OR = [
      {
        name: {
          contains: input.value.packageKeyword,
        },
      },
      {
        period: {
          contains: input.value.packageKeyword,
        },
      },
    ];
  }

  return where;
}

async function buildPosterAttachmentAssetWhere(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    projectId: string;
    value: Extract<
      ParsedAgentOperation,
      { type: "attach_latest_poster_to_content_package" }
    >["value"];
  },
) {
  const productIds = await findProjectLinkedProductIds(tx, input);
  const scopeFilters: Prisma.AssetWhereInput[] = [
    {
      projectId: input.projectId,
    },
  ];

  if (productIds.length > 0) {
    scopeFilters.push({
      productId: {
        in: productIds,
      },
    });
  }

  const where = scopedWhere(input.workspaceId, {
    kind: AssetKind.GENERATED_IMAGE,
    status: AssetStatus.APPROVED,
    OR: scopeFilters,
  }) as Prisma.AssetWhereInput;

  if (input.value.assetKeyword) {
    where.AND = [
      {
        OR: [
          {
            name: {
              contains: input.value.assetKeyword,
            },
          },
          {
            originalFilename: {
              contains: input.value.assetKeyword,
            },
          },
        ],
      },
    ];
  }

  return where;
}

function findPosterPackageFile(
  files: Array<{
    id: string;
    name: string;
    assetId: string | null;
    status: PackageFileStatus;
    notes: string | null;
  }>,
) {
  return (
    files.find((file) => /模板化海报|海报图片|海报图/.test(file.name)) ??
    files.find((file) => /海报/.test(file.name))
  );
}

function buildProjectProductWhere(input: { workspaceId: string; projectId: string }) {
  return {
    projectId: input.projectId,
    project: {
      workspaceId: input.workspaceId,
      deletedAt: null,
    },
    product: {
      workspaceId: input.workspaceId,
      deletedAt: null,
    },
  } satisfies Prisma.ProjectProductWhereInput;
}

async function findProjectLinkedProductIds(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; projectId: string },
) {
  const projectProducts = await tx.projectProduct.findMany({
    where: buildProjectProductWhere(input),
    select: {
      productId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return projectProducts.map((projectProduct) => projectProduct.productId);
}

async function findLinkedProductFactIds(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; projectId: string },
) {
  const productIds = await findProjectLinkedProductIds(tx, input);

  if (productIds.length === 0) {
    return [];
  }

  const facts = await tx.productFact.findMany({
    where: scopedWhere(input.workspaceId, {
      productId: {
        in: productIds,
      },
    }) as Prisma.ProductFactWhereInput,
    select: {
      id: true,
    },
  });

  return facts.map((fact) => fact.id);
}

async function findLinkedAssetIds(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; projectId: string },
) {
  const productIds = await findProjectLinkedProductIds(tx, input);
  const scopedAssetFilters: Prisma.AssetWhereInput[] = [
    {
      projectId: input.projectId,
    },
  ];

  if (productIds.length > 0) {
    scopedAssetFilters.push({
      productId: {
        in: productIds,
      },
    });
  }

  const assets = await tx.asset.findMany({
    where: scopedWhere(input.workspaceId, {
      OR: scopedAssetFilters,
    }) as Prisma.AssetWhereInput,
    select: {
      id: true,
    },
  });

  return assets.map((asset) => asset.id);
}

async function countUnconfirmedLinkedProductFacts(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; projectId: string },
) {
  const productIds = await findProjectLinkedProductIds(tx, input);

  if (productIds.length === 0) {
    return 0;
  }

  return tx.productFact.count({
    where: scopedWhere(input.workspaceId, {
      productId: {
        in: productIds,
      },
      status: {
        in: [ProductFactStatus.DRAFT, ProductFactStatus.NEEDS_REVIEW],
      },
    }) as Prisma.ProductFactWhereInput,
  });
}

function describePlanItemCompletionValue(
  value: Extract<ParsedAgentOperation, { type: "complete_plan_item" }>["value"],
) {
  return [value.week ? `第${value.week}周` : null, value.channel, value.keyword]
    .filter(Boolean)
    .join(" · ");
}

function describePlanItemStatusValue(
  value: Extract<ParsedAgentOperation, { type: "update_plan_item_status" }>["value"],
) {
  return [value.week ? `第${value.week}周` : null, value.channel, value.keyword]
    .filter(Boolean)
    .join(" · ");
}

function describePlanItemDueDateValue(
  value: Extract<ParsedAgentOperation, { type: "update_plan_item_due_date" }>["value"],
) {
  return `${[value.week ? `第${value.week}周` : null, value.channel, value.keyword]
    .filter(Boolean)
    .join(" · ")} → ${value.dueDate}`;
}

function planItemStatusText(status: PlanItemStatus) {
  const labels: Record<PlanItemStatus, string> = {
    DRAFT: "草稿",
    READY: "可执行",
    REVIEW_NEEDED: "需审核",
    DONE: "已完成",
  };

  return labels[status];
}

function describeReviewTaskDecisionValue(
  value: Extract<ParsedAgentOperation, { type: "decide_review_task" }>["value"],
) {
  return describeReviewTaskSelectionValue(value);
}

function describeReviewTaskSelectionValue(value: {
  subjectType?: ReviewSubjectType;
  keyword?: string;
}) {
  const subjectText =
    value.subjectType === ReviewSubjectType.PRODUCT_FACT
      ? "产品事实"
      : value.subjectType === ReviewSubjectType.PROJECT_STRATEGY
        ? "策略草案"
        : value.subjectType === ReviewSubjectType.ASSET
          ? "素材"
          : value.subjectType === ReviewSubjectType.CONTENT_PACKAGE
            ? "素材包"
          : "最新审核任务";

  return [subjectText, value.keyword].filter(Boolean).join(" · ");
}

async function applyReviewTaskDecisionToSubject(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    reviewTask: {
      subjectType: ReviewSubjectType;
      subjectId: string;
    };
    decision: typeof ReviewTaskStatus.APPROVED | typeof ReviewTaskStatus.CHANGES_REQUESTED;
  },
) {
  if (input.reviewTask.subjectType === ReviewSubjectType.PROJECT_STRATEGY) {
    await tx.projectStrategy.updateMany({
      where: {
        id: input.reviewTask.subjectId,
        workspaceId: input.workspaceId,
      },
      data:
        input.decision === ReviewTaskStatus.APPROVED
          ? {
              status: StrategyStatus.CONFIRMED,
              confirmedAt: new Date(),
            }
          : {
              status: StrategyStatus.DRAFT,
            },
    });
  }

  if (input.reviewTask.subjectType === ReviewSubjectType.CONTENT_PACKAGE) {
    await tx.contentPackage.updateMany({
      where: {
        id: input.reviewTask.subjectId,
        workspaceId: input.workspaceId,
      },
      data: {
        status:
          input.decision === ReviewTaskStatus.APPROVED
            ? ContentPackageStatus.APPROVED
            : ContentPackageStatus.REVIEW_NEEDED,
      },
    });
  }

  if (input.reviewTask.subjectType === ReviewSubjectType.ASSET) {
    await tx.asset.updateMany({
      where: {
        id: input.reviewTask.subjectId,
        workspaceId: input.workspaceId,
      },
      data: {
        status:
          input.decision === ReviewTaskStatus.APPROVED ? AssetStatus.APPROVED : AssetStatus.REJECTED,
      },
    });
  }

  if (input.reviewTask.subjectType === ReviewSubjectType.PRODUCT_FACT) {
    await tx.productFact.updateMany({
      where: {
        id: input.reviewTask.subjectId,
        workspaceId: input.workspaceId,
      },
      data: {
        status:
          input.decision === ReviewTaskStatus.APPROVED
            ? ProductFactStatus.CONFIRMED
            : ProductFactStatus.NEEDS_REVIEW,
      },
    });
  }
}

function isStrategyOperation(operation: ParsedAgentOperation) {
  return (
    operation.type === "add_channel" ||
    operation.type === "remove_channel" ||
    operation.type === "set_market" ||
    operation.type === "add_audience" ||
    operation.type === "remove_audience" ||
    operation.type === "add_content_direction" ||
    operation.type === "remove_content_direction" ||
    operation.type === "set_package_frequency"
  );
}

function isProjectOperation(operation: ParsedAgentOperation) {
  return operation.type === "set_project_status";
}

function isStrategyRecommendationOperation(operation: ParsedAgentOperation) {
  return operation.type === "recommend_strategy";
}

function isReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_reminder";
}

function isProjectHealthReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_project_health_reminders";
}

function isProductFactOperation(operation: ParsedAgentOperation) {
  return (
    operation.type === "create_product_fact" ||
    operation.type === "infer_product_facts_from_text"
  );
}

function isProductFactConfirmationOperation(operation: ParsedAgentOperation) {
  return operation.type === "confirm_product_facts";
}

function isStarterPlanOperation(operation: ParsedAgentOperation) {
  return operation.type === "generate_starter_plan";
}

function isMetricsOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_metrics_snapshot";
}

function isMetricsRiskReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_metrics_risk_reminders";
}

function isPlanItemOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_plan_item";
}

function isPlanItemDueDateOperation(operation: ParsedAgentOperation) {
  return operation.type === "update_plan_item_due_date";
}

function isPlanItemStatusOperation(operation: ParsedAgentOperation) {
  return operation.type === "update_plan_item_status";
}

function isCalendarGapReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_calendar_gap_reminders";
}

function isContentPackageOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_content_package";
}

function isPackageReadinessReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_content_package_readiness_reminders";
}

function isPackageFilesStatusOperation(operation: ParsedAgentOperation) {
  return operation.type === "update_content_package_files_status";
}

function isPosterPackageAttachmentOperation(operation: ParsedAgentOperation) {
  return operation.type === "attach_latest_poster_to_content_package";
}

function isPackageReviewOperation(operation: ParsedAgentOperation) {
  return operation.type === "submit_content_package_review";
}

function isPackageReviewDecisionOperation(operation: ParsedAgentOperation) {
  return operation.type === "decide_content_package_review";
}

function isReviewTaskDecisionOperation(operation: ParsedAgentOperation) {
  return operation.type === "decide_review_task";
}

function isReviewTaskCancellationOperation(operation: ParsedAgentOperation) {
  return operation.type === "cancel_review_task";
}

function isMissingReviewTaskOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_missing_review_tasks";
}

function isReminderCompletionOperation(operation: ParsedAgentOperation) {
  return operation.type === "complete_reminder";
}

function isReminderDismissalOperation(operation: ParsedAgentOperation) {
  return operation.type === "dismiss_reminder";
}

function isReminderDueDateOperation(operation: ParsedAgentOperation) {
  return operation.type === "update_reminder_due_date";
}

function isPlanItemCompletionOperation(operation: ParsedAgentOperation) {
  return operation.type === "complete_plan_item";
}

function isConfirmationSensitiveOperation(operation: ParsedAgentOperation) {
  return isStrategyOperation(operation) || isProjectOperation(operation);
}

function parseStoredOperations(value: Prisma.JsonValue): ParsedAgentOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const operations: ParsedAgentOperation[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const type = record.type;
    const label = typeof record.label === "string" ? record.label : "";
    const value = record.value;

    if (
      (type === "add_channel" ||
        type === "remove_channel" ||
        type === "set_market" ||
        type === "add_audience" ||
        type === "remove_audience" ||
        type === "add_content_direction" ||
        type === "remove_content_direction") &&
      typeof value === "string"
    ) {
      operations.push({ type, value, label: label || value });
      continue;
    }

    if (
      type === "set_project_status" &&
      (value === ProjectStatus.DRAFT ||
        value === ProjectStatus.ACTIVE ||
        value === ProjectStatus.PAUSED ||
        value === ProjectStatus.ARCHIVED)
    ) {
      operations.push({ type, value, label: label || value });
      continue;
    }

    if (type === "recommend_strategy" && isStrategyRecommendationValue(value)) {
      operations.push({
        type,
        value,
        label: label || "根据产品事实生成策略推荐草案",
      });
      continue;
    }

    const severity = record.severity;
    const dueAt = record.dueAt;
    if (
      type === "create_reminder" &&
      typeof value === "string" &&
      (dueAt === undefined || typeof dueAt === "string") &&
      (severity === ReminderSeverity.INFO ||
        severity === ReminderSeverity.WARNING ||
        severity === ReminderSeverity.CRITICAL)
    ) {
      operations.push({
        type,
        value,
        severity,
        ...(dueAt ? { dueAt } : {}),
        label: label || `创建提醒：${value}`,
      });
      continue;
    }

    if (type === "create_project_health_reminders" && isProjectHealthReminderValue(value)) {
      operations.push({
        type,
        value,
        label: label || "根据项目体检缺口生成提醒",
      });
      continue;
    }

    if (type === "create_product_fact" && isProductFactValue(value)) {
      operations.push({
        type,
        value,
        label: label || `新增产品事实：${value.label}=${value.value}`,
      });
      continue;
    }

    if (type === "infer_product_facts_from_text" && isProductFactSourceValue(value)) {
      operations.push({
        type,
        value,
        label: label || `从产品资料提取事实：${value.sourceText.slice(0, 42)}`,
      });
      continue;
    }

    if (type === "confirm_product_facts" && isProductFactConfirmationValue(value)) {
      operations.push({
        type,
        value,
        label: label || "确认当前项目待复核产品事实",
      });
      continue;
    }

    if (type === "complete_reminder" && isReminderCompletionValue(value)) {
      operations.push({
        type,
        value,
        label: label || `完成提醒：${value.keyword}`,
      });
      continue;
    }

    if (type === "dismiss_reminder" && isReminderCompletionValue(value)) {
      operations.push({
        type,
        value,
        label: label || `忽略提醒：${value.keyword}`,
      });
      continue;
    }

    if (type === "update_reminder_due_date" && isReminderDueDateValue(value)) {
      operations.push({
        type,
        value,
        label: label || `提醒截止日期改为 ${value.dueAt}：${value.keyword}`,
      });
      continue;
    }

    if (
      type === "set_package_frequency" &&
      (value === ContentFrequency.WEEKLY ||
        value === ContentFrequency.BIWEEKLY ||
        value === ContentFrequency.MONTHLY)
    ) {
      operations.push({ type, value, label: label || value });
      continue;
    }

    if (type === "generate_starter_plan" && value === "first_month") {
      operations.push({
        type,
        value,
        label: label || "生成首月计划和第一份素材包结构",
      });
      continue;
    }

    if (type === "create_metrics_snapshot" && isMetricsSnapshotValue(value)) {
      operations.push({
        type,
        value,
        label:
          label ||
          `录入指标：${value.period} · ${value.channel} · 曝光 ${value.impressions} / 点击 ${value.clicks} / 转化 ${value.conversions}`,
      });
      continue;
    }

    if (type === "create_metrics_risk_reminders" && isMetricsRiskReminderValue(value)) {
      operations.push({
        type,
        value,
        label: label || "根据数据复盘风险生成提醒",
      });
      continue;
    }

    if (type === "create_content_package" && isContentPackageValue(value)) {
      operations.push({
        type,
        value,
        label: label || `创建素材包结构：${value.name}`,
      });
      continue;
    }

    if (type === "create_calendar_gap_reminders" && isCalendarGapReminderValue(value)) {
      operations.push({
        type,
        value,
        label: label || "根据内容日历缺口生成提醒",
      });
      continue;
    }

    if (
      type === "create_content_package_readiness_reminders" &&
      isPackageReadinessReminderValue(value)
    ) {
      operations.push({
        type,
        value,
        label:
          label ||
          `根据素材包可交付性缺口生成提醒：${value.keyword ?? "最新素材包"}`,
      });
      continue;
    }

    if (type === "update_content_package_files_status" && isPackageFilesStatusValue(value)) {
      const statusText =
        value.status === PackageFileStatus.APPROVED ? "全部文件审核通过" : "全部文件标记为已生成";

      operations.push({
        type,
        value,
        label: label || `${statusText}：${value.keyword ?? "最新素材包"}`,
      });
      continue;
    }

    if (type === "attach_latest_poster_to_content_package" && isPosterPackageAttachmentValue(value)) {
      operations.push({
        type,
        value,
        label: label || `关联模板海报到素材包：${value.packageKeyword ?? "最新素材包"}`,
      });
      continue;
    }

    if (type === "submit_content_package_review" && isPackageReviewValue(value)) {
      operations.push({
        type,
        value,
        label: label || `提交素材包审核：${value.keyword ?? "最新素材包"}`,
      });
      continue;
    }

    if (type === "decide_content_package_review" && isPackageReviewDecisionValue(value)) {
      const decisionText =
        value.decision === ReviewTaskStatus.APPROVED ? "审核通过" : "要求修改";

      operations.push({
        type,
        value,
        label: label || `${decisionText}：${value.keyword ?? "最新素材包"}`,
      });
      continue;
    }

    if (type === "decide_review_task" && isReviewTaskDecisionValue(value)) {
      const decisionText =
        value.decision === ReviewTaskStatus.APPROVED ? "审核通过" : "要求修改";

      operations.push({
        type,
        value,
        label:
          label ||
          `${describeReviewTaskDecisionValue(value)}${decisionText}${
            value.keyword ? `：${value.keyword}` : ""
          }`,
      });
      continue;
    }

    if (type === "cancel_review_task" && isReviewTaskCancellationValue(value)) {
      operations.push({
        type,
        value,
        label: label || `取消${describeReviewTaskSelectionValue(value)}审核任务`,
      });
      continue;
    }

    if (type === "create_missing_review_tasks" && isMissingReviewTaskValue(value)) {
      operations.push({
        type,
        value,
        label: label || "补齐当前项目审核任务",
      });
      continue;
    }

    if (type === "create_plan_item" && isPlanItemValue(value)) {
      operations.push({
        type,
        value,
        label: label || `新增内容计划：第${value.week}周 · ${value.channel} · ${value.title}`,
      });
      continue;
    }

    if (type === "update_plan_item_status" && isPlanItemStatusValue(value)) {
      operations.push({
        type,
        value,
        label: label || `内容计划改为${planItemStatusText(value.status)}：${describePlanItemStatusValue(value)}`,
      });
      continue;
    }

    if (type === "update_plan_item_due_date" && isPlanItemDueDateValue(value)) {
      operations.push({
        type,
        value,
        label: label || `内容计划截止日期改为 ${value.dueDate}：${describePlanItemDueDateValue(value)}`,
      });
      continue;
    }

    if (type === "complete_plan_item" && isPlanItemCompletionValue(value)) {
      operations.push({
        type,
        value,
        label: label || `完成内容计划：${describePlanItemCompletionValue(value)}`,
      });
    }
  }

  return operations;
}

function isMetricsSnapshotValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_metrics_snapshot" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.period === "string" &&
    typeof record.channel === "string" &&
    isNonNegativeNumber(record.impressions) &&
    isNonNegativeNumber(record.clicks) &&
    isNonNegativeNumber(record.conversions) &&
    isNonNegativeNumber(record.spendCents) &&
    (record.notes === undefined || typeof record.notes === "string") &&
    record.clicks <= record.impressions &&
    record.conversions <= record.clicks
  );
}

function isMetricsRiskReminderValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_metrics_risk_reminders" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Number.isInteger(record.limit) && Number(record.limit) >= 1 && Number(record.limit) <= 8;
}

function isContentPackageValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_content_package" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.name === "string" &&
    record.name.trim().length > 0 &&
    typeof record.period === "string" &&
    record.period.trim().length > 0 &&
    (record.frequency === ContentFrequency.WEEKLY ||
      record.frequency === ContentFrequency.BIWEEKLY ||
      record.frequency === ContentFrequency.MONTHLY) &&
    (record.summary === undefined || typeof record.summary === "string")
  );
}

function isCalendarGapReminderValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_calendar_gap_reminders" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Number.isInteger(record.limit) && Number(record.limit) >= 1 && Number(record.limit) <= 8;
}

function isPackageReadinessReminderValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_content_package_readiness_reminders" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Number.isInteger(record.limit) &&
    Number(record.limit) >= 1 &&
    Number(record.limit) <= 8 &&
    (record.keyword === undefined || typeof record.keyword === "string")
  );
}

function isPackageFilesStatusValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "update_content_package_files_status" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.status === PackageFileStatus.GENERATED ||
      record.status === PackageFileStatus.APPROVED) &&
    (record.keyword === undefined || typeof record.keyword === "string")
  );
}

function isPosterPackageAttachmentValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "attach_latest_poster_to_content_package" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.packageKeyword === undefined || typeof record.packageKeyword === "string") &&
    (record.assetKeyword === undefined || typeof record.assetKeyword === "string")
  );
}

function isPackageReviewValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "submit_content_package_review" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.keyword === undefined || typeof record.keyword === "string";
}

function isPackageReviewDecisionValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "decide_content_package_review" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.decision === ReviewTaskStatus.APPROVED ||
      record.decision === ReviewTaskStatus.CHANGES_REQUESTED) &&
    (record.keyword === undefined || typeof record.keyword === "string") &&
    typeof record.decisionNote === "string"
  );
}

function isReviewTaskDecisionValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "decide_review_task" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.subjectType === undefined ||
      record.subjectType === ReviewSubjectType.PRODUCT_FACT ||
      record.subjectType === ReviewSubjectType.PROJECT_STRATEGY ||
      record.subjectType === ReviewSubjectType.CONTENT_PACKAGE ||
      record.subjectType === ReviewSubjectType.ASSET) &&
    (record.decision === ReviewTaskStatus.APPROVED ||
      record.decision === ReviewTaskStatus.CHANGES_REQUESTED) &&
    (record.keyword === undefined || typeof record.keyword === "string") &&
    typeof record.decisionNote === "string"
  );
}

function isReviewTaskCancellationValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "cancel_review_task" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.subjectType === undefined ||
      record.subjectType === ReviewSubjectType.PRODUCT_FACT ||
      record.subjectType === ReviewSubjectType.PROJECT_STRATEGY ||
      record.subjectType === ReviewSubjectType.CONTENT_PACKAGE ||
      record.subjectType === ReviewSubjectType.ASSET) &&
    (record.keyword === undefined || typeof record.keyword === "string") &&
    typeof record.decisionNote === "string"
  );
}

function isMissingReviewTaskValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_missing_review_tasks" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.scope === "current_project";
}

function isProductFactValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_product_fact" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.label === "string" &&
    record.label.trim().length > 0 &&
    typeof record.value === "string" &&
    record.value.trim().length > 0 &&
    typeof record.source === "string"
  );
}

function isProjectHealthReminderValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_project_health_reminders" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Number.isInteger(record.limit) && Number(record.limit) >= 1 && Number(record.limit) <= 8;
}

function isProductFactSourceValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "infer_product_facts_from_text" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.sourceText === "string" &&
    record.sourceText.trim().length >= 8 &&
    typeof record.source === "string"
  );
}

function isProductFactConfirmationValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "confirm_product_facts" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.scope === "current_project";
}

function isStrategyRecommendationValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "recommend_strategy" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.basis === "product_facts" &&
    (record.contextText === undefined || typeof record.contextText === "string")
  );
}

function isReminderCompletionValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "complete_reminder" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.keyword === "string" && record.keyword.trim().length >= 2;
}

function isReminderDueDateValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "update_reminder_due_date" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.keyword === "string" &&
    record.keyword.trim().length >= 2 &&
    typeof record.dueAt === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.dueAt)
  );
}

function isPlanItemValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "create_plan_item" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Number.isInteger(record.week) &&
    Number(record.week) >= 1 &&
    Number(record.week) <= 12 &&
    typeof record.channel === "string" &&
    typeof record.theme === "string" &&
    typeof record.title === "string" &&
    typeof record.deliverable === "string" &&
    (record.dueDate === undefined || typeof record.dueDate === "string") &&
    (record.status === PlanItemStatus.DRAFT ||
      record.status === PlanItemStatus.READY ||
      record.status === PlanItemStatus.REVIEW_NEEDED ||
      record.status === PlanItemStatus.DONE)
  );
}

function isPlanItemStatusValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "update_plan_item_status" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const hasWeek =
    record.week === undefined ||
    (Number.isInteger(record.week) && Number(record.week) >= 1 && Number(record.week) <= 12);
  const hasChannel = record.channel === undefined || typeof record.channel === "string";
  const hasKeyword = record.keyword === undefined || typeof record.keyword === "string";
  const hasValidStatus =
    record.status === PlanItemStatus.DRAFT ||
    record.status === PlanItemStatus.READY ||
    record.status === PlanItemStatus.REVIEW_NEEDED ||
    record.status === PlanItemStatus.DONE;

  return (
    hasValidStatus &&
    hasWeek &&
    hasChannel &&
    hasKeyword &&
    Boolean(record.week || record.channel || record.keyword)
  );
}

function isPlanItemDueDateValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "update_plan_item_due_date" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const hasWeek =
    record.week === undefined ||
    (Number.isInteger(record.week) && Number(record.week) >= 1 && Number(record.week) <= 12);
  const hasChannel = record.channel === undefined || typeof record.channel === "string";
  const hasKeyword = record.keyword === undefined || typeof record.keyword === "string";

  return (
    typeof record.dueDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate) &&
    hasWeek &&
    hasChannel &&
    hasKeyword &&
    Boolean(record.week || record.channel || record.keyword)
  );
}

function isPlanItemCompletionValue(value: unknown): value is Extract<
  ParsedAgentOperation,
  { type: "complete_plan_item" }
>["value"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const hasWeek =
    record.week === undefined ||
    (Number.isInteger(record.week) && Number(record.week) >= 1 && Number(record.week) <= 12);
  const hasChannel = record.channel === undefined || typeof record.channel === "string";
  const hasKeyword = record.keyword === undefined || typeof record.keyword === "string";

  return hasWeek && hasChannel && hasKeyword && Boolean(record.week || record.channel || record.keyword);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function buildAssistantReply(
  summary: string,
  status: AgentOperationStatus,
  conflictCheck: string,
) {
  if (status === AgentOperationStatus.FAILED) {
    return `${conflictCheck} 你可以尝试说：“巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。”`;
  }

  if (status === AgentOperationStatus.PENDING_CONFIRMATION) {
    return `我识别到：${summary}。${conflictCheck}`;
  }

  return `已写入项目工作台：${summary}。${conflictCheck}`;
}

function buildConfirmedAssistantReply(input: {
  operationSummary: string;
  strategyWasConfirmed: boolean;
  strategyVersion: number;
  strategyChanged: boolean;
  strategyRecommended: boolean;
  projectChanged: boolean;
  reminderChanged: boolean;
  healthReminderChanged: boolean;
  productFactChanged: boolean;
  productFactsConfirmed: boolean;
  starterPlanChanged: boolean;
  metricsChanged: boolean;
  metricsRiskReminderChanged: boolean;
  planItemChanged: boolean;
  planItemDueDateChanged: boolean;
  planItemStatusChanged: boolean;
  calendarGapReminderChanged: boolean;
  contentPackageChanged: boolean;
  packageReadinessReminderChanged: boolean;
  packageFilesStatusChanged: boolean;
  posterPackageAttachmentChanged: boolean;
  packageReviewSubmitted: boolean;
  packageReviewDecided: boolean;
  reviewTaskDecided: boolean;
  reviewTaskCanceled: boolean;
  missingReviewTasksCreated: boolean;
  reminderDueDateChanged: boolean;
  reminderCompleted: boolean;
  reminderDismissed: boolean;
  planItemCompleted: boolean;
}) {
  const starterPlanText = input.starterPlanChanged ? "，并生成首月计划和第一份素材包结构" : "";
  const strategyRecommendationText = input.strategyRecommended ? "，并生成新的策略推荐草案" : "";
  const healthReminderText = input.healthReminderChanged ? "，并生成项目体检缺口提醒" : "";
  const productFactText = input.productFactChanged ? "，并新增待复核产品事实" : "";
  const productFactsConfirmedText = input.productFactsConfirmed ? "，并确认产品事实" : "";
  const metricsText = input.metricsChanged ? "，并录入渠道表现指标" : "";
  const metricsRiskReminderText = input.metricsRiskReminderChanged
    ? "，并生成数据复盘风险提醒"
    : "";
  const planItemText = input.planItemChanged ? "，并新增内容计划" : "";
  const planItemDueDateText = input.planItemDueDateChanged ? "，并更新内容计划截止日期" : "";
  const planItemStatusText = input.planItemStatusChanged ? "，并更新内容计划状态" : "";
  const calendarGapReminderText = input.calendarGapReminderChanged
    ? "，并生成内容日历缺口提醒"
    : "";
  const contentPackageText = input.contentPackageChanged ? "，并创建素材包结构" : "";
  const packageReadinessReminderText = input.packageReadinessReminderChanged
    ? "，并生成素材包可交付性缺口提醒"
    : "";
  const packageFilesStatusText = input.packageFilesStatusChanged ? "，并推进素材包文件状态" : "";
  const posterPackageAttachmentText = input.posterPackageAttachmentChanged
    ? "，并关联模板海报到素材包"
    : "";
  const packageReviewText = input.packageReviewSubmitted ? "，并提交素材包审核" : "";
  const packageReviewDecisionText = input.packageReviewDecided ? "，并处理素材包审核" : "";
  const reviewTaskDecisionText = input.reviewTaskDecided ? "，并处理审核任务" : "";
  const reviewTaskCancellationText = input.reviewTaskCanceled ? "，并取消审核任务" : "";
  const missingReviewTaskText = input.missingReviewTasksCreated ? "，并补齐审核任务" : "";
  const reminderDueDateText = input.reminderDueDateChanged ? "，并更新提醒截止日期" : "";
  const completedReminderText = input.reminderCompleted ? "，并完成项目提醒" : "";
  const dismissedReminderText = input.reminderDismissed ? "，并忽略项目提醒" : "";
  const completedPlanItemText = input.planItemCompleted ? "，并完成内容计划" : "";

  if (input.strategyChanged && input.strategyWasConfirmed) {
    const projectText = input.projectChanged ? "，同步更新项目基础信息" : "";
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认创建正式策略 v${input.strategyVersion}${strategyRecommendationText}${projectText}${reminderText}${healthReminderText}${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.strategyChanged) {
    const projectText = input.projectChanged ? "，同步更新项目基础信息" : "";
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认写入策略草案${strategyRecommendationText}${projectText}${reminderText}${healthReminderText}${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.strategyRecommended) {
    return `已按你的确认生成策略推荐草案${projectTextForRecommendation(input.projectChanged)}${healthReminderText}${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.projectChanged) {
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认更新项目基础信息${reminderText}${healthReminderText}${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderChanged) {
    return `已按你的确认创建提醒${healthReminderText}${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.healthReminderChanged) {
    return `已按你的确认生成项目体检缺口提醒${productFactText}${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.productFactChanged) {
    return `已按你的确认新增待复核产品事实${productFactsConfirmedText}${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.productFactsConfirmed) {
    return `已按你的确认完成产品事实确认${starterPlanText}${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.starterPlanChanged) {
    return `已按你的确认生成首月计划和第一份素材包结构${metricsText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.metricsChanged) {
    return `已按你的确认录入渠道表现指标${metricsRiskReminderText}${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.metricsRiskReminderChanged) {
    return `已按你的确认生成数据复盘风险提醒${planItemText}${planItemDueDateText}${planItemStatusText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemChanged) {
    return `已按你的确认新增内容计划${planItemDueDateText}${planItemStatusText}${calendarGapReminderText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemDueDateChanged) {
    return `已按你的确认更新内容计划截止日期${planItemStatusText}${calendarGapReminderText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemStatusChanged) {
    return `已按你的确认更新内容计划状态${calendarGapReminderText}${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.calendarGapReminderChanged) {
    return `已按你的确认生成内容日历缺口提醒${contentPackageText}${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.contentPackageChanged) {
    return `已按你的确认创建素材包结构${packageReadinessReminderText}${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageReadinessReminderChanged) {
    return `已按你的确认生成素材包可交付性缺口提醒${packageFilesStatusText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageFilesStatusChanged) {
    return `已按你的确认推进素材包文件状态${posterPackageAttachmentText}${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.posterPackageAttachmentChanged) {
    return `已按你的确认关联模板海报到素材包${packageReviewText}${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageReviewSubmitted) {
    return `已按你的确认提交素材包审核${packageReviewDecisionText}${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageReviewDecided) {
    return `已按你的确认处理素材包审核${reviewTaskDecisionText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reviewTaskDecided) {
    return `已按你的确认处理审核任务${reviewTaskCancellationText}${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reviewTaskCanceled) {
    return `已按你的确认取消审核任务${missingReviewTaskText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.missingReviewTasksCreated) {
    return `已按你的确认补齐审核任务${reminderDueDateText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderDueDateChanged) {
    return `已按你的确认更新提醒截止日期${completedReminderText}${dismissedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderCompleted) {
    return `已按你的确认完成项目提醒${dismissedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderDismissed) {
    return `已按你的确认忽略项目提醒${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemCompleted) {
    return `已按你的确认完成内容计划：${input.operationSummary}`;
  }

  return `已按你的确认处理：${input.operationSummary}`;
}

function projectTextForRecommendation(projectChanged: boolean) {
  return projectChanged ? "，同步更新项目基础信息" : "";
}

function strategyToJson(strategy: ProjectStrategyRecord) {
  return {
    id: strategy.id,
    version: strategy.version,
    status: strategy.status,
    targetMarkets: strategy.targetMarkets,
    audiences: strategy.audiences,
    channels: strategy.channels,
    contentDirections: strategy.contentDirections,
    packageFrequency: strategy.packageFrequency,
    positioning: strategy.positioning,
    rationale: strategy.rationale,
  };
}

function projectToJson(project: {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
}) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
  };
}

function operationToJson(operation: {
  id: string;
  rawText: string;
  summary: string;
  operations: Prisma.JsonValue;
  conflictCheck: string | null;
  status: AgentOperationStatus;
}) {
  return {
    id: operation.id,
    rawText: operation.rawText,
    summary: operation.summary,
    operations: operation.operations,
    conflictCheck: operation.conflictCheck,
    status: operation.status,
  };
}

function reviewTaskToJson(reviewTask: {
  id: string;
  projectId: string | null;
  subjectType: ReviewSubjectType;
  subjectId: string;
  title: string;
  description: string | null;
  status: ReviewTaskStatus;
  decisionNote: string | null;
}) {
  return {
    id: reviewTask.id,
    projectId: reviewTask.projectId,
    subjectType: reviewTask.subjectType,
    subjectId: reviewTask.subjectId,
    title: reviewTask.title,
    description: reviewTask.description,
    status: reviewTask.status,
    decisionNote: reviewTask.decisionNote,
  };
}

function productFactToJson(fact: {
  id: string;
  productId: string;
  label: string;
  value: string;
  source: string | null;
  confidence: number;
  status: ProductFactStatus;
}) {
  return {
    id: fact.id,
    productId: fact.productId,
    label: fact.label,
    value: fact.value,
    source: fact.source,
    confidence: fact.confidence,
    status: fact.status,
  };
}

function reminderToJson(reminder: {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  severity: ReminderSeverity;
  status: ReminderStatus;
  dueAt?: Date | null;
}) {
  return {
    id: reminder.id,
    projectId: reminder.projectId,
    title: reminder.title,
    description: reminder.description,
    severity: reminder.severity,
    status: reminder.status,
    dueAt: reminder.dueAt ?? null,
  };
}

function planItemToJson(planItem: {
  id: string;
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
    week: planItem.week,
    channel: planItem.channel,
    theme: planItem.theme,
    title: planItem.title,
    deliverable: planItem.deliverable,
    dueDate: planItem.dueDate,
    status: planItem.status,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
