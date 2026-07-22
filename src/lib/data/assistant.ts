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
  StrategyStatus,
} from "@prisma/client";
import { parseAgentCommand, type ParsedAgentOperation } from "@/lib/agent/command-parser";
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
    const parsed = parseAgentCommand(text);
    const noSafeOperation = parsed.operations.length === 0;
    const requiresConfirmation = strategy.status === StrategyStatus.CONFIRMED && !noSafeOperation;
    const operationStatus = noSafeOperation
      ? AgentOperationStatus.FAILED
      : requiresConfirmation
        ? AgentOperationStatus.PENDING_CONFIRMATION
        : AgentOperationStatus.APPLIED;
    const conflictCheck = noSafeOperation
      ? "未识别到足够明确的市场、渠道、频率或内容方向，未写入数据库。"
      : requiresConfirmation
        ? "当前策略已被人工确认为正式版本，需要二次确认后才能修改。"
        : "当前策略仍为草案，可直接应用。";

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

    const channels = strategy.channels.length > 0 ? strategy.channels : ["TikTok", "Instagram"];
    const themes = ["新品认知", "场景种草", "礼品转化", "复盘加码"];

    await Promise.all(
      themes.map((theme, index) =>
        tx.contentPlanItem.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            strategyId: strategy.id,
            week: index + 1,
            channel: channels[index % channels.length],
            theme,
            title: `${theme}内容任务`,
            deliverable: "平台文案、发布配文、模板化海报和审核清单",
            status: PlanItemStatus.READY,
          },
        }),
      ),
    );

    const contentPackage = await tx.contentPackage.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        strategyId: strategy.id,
        name: "首月第一份素材包",
        period: "首月第 1 周",
        frequency: strategy.packageFrequency,
        status: ContentPackageStatus.DRAFT,
        summary: "本地生成素材包结构清单，后续阶段接入真实文件导出。",
      },
    });

    await tx.contentPackageFile.createMany({
      data: [
        ["素材包说明 PDF", "PDF"],
        ["内容排期 XLSX", "XLSX"],
        ["平台文案 DOCX", "DOCX"],
        ["Hashtags TXT", "TXT"],
        ["TikTok 视频脚本 DOCX", "DOCX"],
        ["发布配文 TXT", "TXT"],
        ["模板化海报图片", "PNG"],
        ["设计 Brief PDF", "PDF"],
        ["最终 ZIP 打包下载", "ZIP"],
      ].map(([name, fileType]) => ({
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
  });
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

function isStrategyOperation(operation: ParsedAgentOperation) {
  return operation.type !== "set_project_status";
}

function isProjectOperation(operation: ParsedAgentOperation) {
  return operation.type === "set_project_status";
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

    if (
      type === "set_package_frequency" &&
      (value === ContentFrequency.WEEKLY ||
        value === ContentFrequency.BIWEEKLY ||
        value === ContentFrequency.MONTHLY)
    ) {
      operations.push({ type, value, label: label || value });
    }
  }

  return operations;
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
}) {
  if (input.strategyChanged && input.strategyWasConfirmed) {
    const projectText = input.projectChanged ? "，并同步更新项目基础信息" : "";
    return `已按你的确认创建正式策略 v${input.strategyVersion}${projectText}：${input.operationSummary}`;
  }

  if (input.strategyChanged) {
    const projectText = input.projectChanged ? "，并同步更新项目基础信息" : "";
    return `已按你的确认写入策略草案${projectText}：${input.operationSummary}`;
  }

  if (input.projectChanged) {
    return `已按你的确认更新项目基础信息：${input.operationSummary}`;
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

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
