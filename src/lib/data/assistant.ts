import {
  AgentMessageRole,
  AgentOperationStatus,
  ContentFrequency,
  ContentPackageStatus,
  PackageFileStatus,
  PlanItemStatus,
  Prisma,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
  StrategyStatus,
} from "@prisma/client";
import type { ParsedAgentOperation } from "@/lib/agent/command-parser";
import { getConfiguredAgentTextProvider } from "@/lib/agent/provider";
import { prisma } from "@/lib/prisma";
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
      const projectOperations = parsed.operations.filter(isProjectOperation);
      const reminderOperations = parsed.operations.filter(isReminderOperation);
      const starterPlanOperations = parsed.operations.filter(isStarterPlanOperation);
      const metricsOperations = parsed.operations.filter(isMetricsOperation);
      const planItemOperations = parsed.operations.filter(isPlanItemOperation);
      const contentPackageOperations = parsed.operations.filter(isContentPackageOperation);
      const packageReviewOperations = parsed.operations.filter(isPackageReviewOperation);
      const packageReviewDecisionOperations = parsed.operations.filter(
        isPackageReviewDecisionOperation,
      );
      const reminderCompletionOperations = parsed.operations.filter(isReminderCompletionOperation);
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

      await applyMetricsOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: metricsOperations,
      });

      await applyPlanItemOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        strategyId: updatedStrategy.id,
        operations: planItemOperations,
      });

      await applyContentPackageOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        strategyId: updatedStrategy.id,
        operations: contentPackageOperations,
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

      await applyReminderCompletionOperations(tx, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        projectId: project.id,
        operations: reminderCompletionOperations,
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
    const projectOperations = parsedOperations.filter(isProjectOperation);
    const reminderOperations = parsedOperations.filter(isReminderOperation);
    const starterPlanOperations = parsedOperations.filter(isStarterPlanOperation);
    const metricsOperations = parsedOperations.filter(isMetricsOperation);
    const planItemOperations = parsedOperations.filter(isPlanItemOperation);
    const contentPackageOperations = parsedOperations.filter(isContentPackageOperation);
    const packageReviewOperations = parsedOperations.filter(isPackageReviewOperation);
    const packageReviewDecisionOperations = parsedOperations.filter(
      isPackageReviewDecisionOperation,
    );
    const reminderCompletionOperations = parsedOperations.filter(isReminderCompletionOperation);
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

    await applyMetricsOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: metricsOperations,
    });

    await applyPlanItemOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      strategyId: updatedStrategy.id,
      operations: planItemOperations,
    });

    await applyContentPackageOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      strategyId: updatedStrategy.id,
      operations: contentPackageOperations,
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

    await applyReminderCompletionOperations(tx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: operation.projectId,
      operations: reminderCompletionOperations,
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
        reminderChanged: reminderOperations.length > 0,
        starterPlanChanged: starterPlanOperations.length > 0,
        metricsChanged: metricsOperations.length > 0,
        planItemChanged: planItemOperations.length > 0,
        contentPackageChanged: contentPackageOperations.length > 0,
        packageReviewSubmitted: packageReviewOperations.length > 0,
        packageReviewDecided: packageReviewDecisionOperations.length > 0,
        reminderCompleted: reminderCompletionOperations.length > 0,
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
    ? "未识别到足够明确的市场、渠道、频率、项目状态、提醒、内容计划或内容方向，未写入数据库。"
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

function describePlanItemCompletionValue(
  value: Extract<ParsedAgentOperation, { type: "complete_plan_item" }>["value"],
) {
  return [value.week ? `第${value.week}周` : null, value.channel, value.keyword]
    .filter(Boolean)
    .join(" · ");
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

function isReminderOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_reminder";
}

function isStarterPlanOperation(operation: ParsedAgentOperation) {
  return operation.type === "generate_starter_plan";
}

function isMetricsOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_metrics_snapshot";
}

function isPlanItemOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_plan_item";
}

function isContentPackageOperation(operation: ParsedAgentOperation) {
  return operation.type === "create_content_package";
}

function isPackageReviewOperation(operation: ParsedAgentOperation) {
  return operation.type === "submit_content_package_review";
}

function isPackageReviewDecisionOperation(operation: ParsedAgentOperation) {
  return operation.type === "decide_content_package_review";
}

function isReminderCompletionOperation(operation: ParsedAgentOperation) {
  return operation.type === "complete_reminder";
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

    const severity = record.severity;
    if (
      type === "create_reminder" &&
      typeof value === "string" &&
      (severity === ReminderSeverity.INFO ||
        severity === ReminderSeverity.WARNING ||
        severity === ReminderSeverity.CRITICAL)
    ) {
      operations.push({
        type,
        value,
        severity,
        label: label || `创建提醒：${value}`,
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

    if (type === "create_content_package" && isContentPackageValue(value)) {
      operations.push({
        type,
        value,
        label: label || `创建素材包结构：${value.name}`,
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

    if (type === "create_plan_item" && isPlanItemValue(value)) {
      operations.push({
        type,
        value,
        label: label || `新增内容计划：第${value.week}周 · ${value.channel} · ${value.title}`,
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
  projectChanged: boolean;
  reminderChanged: boolean;
  starterPlanChanged: boolean;
  metricsChanged: boolean;
  planItemChanged: boolean;
  contentPackageChanged: boolean;
  packageReviewSubmitted: boolean;
  packageReviewDecided: boolean;
  reminderCompleted: boolean;
  planItemCompleted: boolean;
}) {
  const starterPlanText = input.starterPlanChanged ? "，并生成首月计划和第一份素材包结构" : "";
  const metricsText = input.metricsChanged ? "，并录入渠道表现指标" : "";
  const planItemText = input.planItemChanged ? "，并新增内容计划" : "";
  const contentPackageText = input.contentPackageChanged ? "，并创建素材包结构" : "";
  const packageReviewText = input.packageReviewSubmitted ? "，并提交素材包审核" : "";
  const packageReviewDecisionText = input.packageReviewDecided ? "，并处理素材包审核" : "";
  const completedReminderText = input.reminderCompleted ? "，并完成项目提醒" : "";
  const completedPlanItemText = input.planItemCompleted ? "，并完成内容计划" : "";

  if (input.strategyChanged && input.strategyWasConfirmed) {
    const projectText = input.projectChanged ? "，同步更新项目基础信息" : "";
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认创建正式策略 v${input.strategyVersion}${projectText}${reminderText}${starterPlanText}${metricsText}${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.strategyChanged) {
    const projectText = input.projectChanged ? "，同步更新项目基础信息" : "";
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认写入策略草案${projectText}${reminderText}${starterPlanText}${metricsText}${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.projectChanged) {
    const reminderText = input.reminderChanged ? "，并创建提醒" : "";
    return `已按你的确认更新项目基础信息${reminderText}${starterPlanText}${metricsText}${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderChanged) {
    return `已按你的确认创建提醒${starterPlanText}${metricsText}${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.starterPlanChanged) {
    return `已按你的确认生成首月计划和第一份素材包结构${metricsText}${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.metricsChanged) {
    return `已按你的确认录入渠道表现指标${planItemText}${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemChanged) {
    return `已按你的确认新增内容计划${contentPackageText}${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.contentPackageChanged) {
    return `已按你的确认创建素材包结构${packageReviewText}${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageReviewSubmitted) {
    return `已按你的确认提交素材包审核${packageReviewDecisionText}${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.packageReviewDecided) {
    return `已按你的确认处理素材包审核${completedReminderText}${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.reminderCompleted) {
    return `已按你的确认完成项目提醒${completedPlanItemText}：${input.operationSummary}`;
  }

  if (input.planItemCompleted) {
    return `已按你的确认完成内容计划：${input.operationSummary}`;
  }

  return `已按你的确认处理：${input.operationSummary}`;
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
