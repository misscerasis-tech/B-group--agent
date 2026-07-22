import {
  AgentMessageRole,
  ContentFrequency,
  ProductFactStatus,
  ProductStatus,
  ProjectStatus,
  StrategyStatus,
  type Prisma,
} from "@prisma/client";
import { parseAgentCommand, type ParsedAgentOperation } from "@/lib/agent/command-parser";
import { inferProductFactsFromText } from "@/lib/product-facts/extractor";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProjectFormInput = {
  name: string;
  description?: string;
  status: ProjectStatus;
};

export type ProjectKickoffInput = {
  projectName: string;
  productName: string;
  brief: string;
};

export async function listProjects(workspaceId: string) {
  return prisma.project.findMany({
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
}

export async function getProject(workspaceId: string, projectId: string) {
  return prisma.project.findFirst({
    where: scopedWhere(workspaceId, {
      id: projectId,
      deletedAt: null,
    }),
    include: {
      projectProducts: {
        include: {
          product: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function createProject(
  workspaceId: string,
  input: ProjectFormInput,
  actorUserId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description || null,
        status: input.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        projectId: project.id,
        entityType: "Project",
        entityId: project.id,
        action: "project_created",
        summary: `创建项目：${project.name}`,
        after: projectToJson(project),
        actorUserId,
      },
    });

    return project;
  });
}

export async function kickoffProjectFromBrief(
  workspaceId: string,
  input: ProjectKickoffInput,
  actorUserId?: string,
) {
  const brief = input.brief.trim();
  const parsed = parseAgentCommand(brief);
  const facts = inferProductFactsFromText({
    productName: input.productName,
    description: brief,
  });
  const strategySeed = buildKickoffStrategySeed(parsed.operations);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId,
        name: input.projectName,
        description: brief,
        status: ProjectStatus.ACTIVE,
      },
    });
    const product = await tx.product.create({
      data: {
        workspaceId,
        name: input.productName,
        description: brief,
        status: ProductStatus.ACTIVE,
      },
    });

    await tx.projectProduct.create({
      data: {
        projectId: project.id,
        productId: product.id,
      },
    });
    await tx.productFact.createMany({
      data: facts.map((fact) => ({
        workspaceId,
        productId: product.id,
        label: fact.label,
        value: fact.value,
        confidence: fact.confidence,
        source: "local-rule:kickoff",
        status: ProductFactStatus.DRAFT,
      })),
    });

    const strategy = await tx.projectStrategy.create({
      data: {
        workspaceId,
        projectId: project.id,
        version: 1,
        status: StrategyStatus.DRAFT,
        targetMarkets: strategySeed.targetMarkets,
        audiences: strategySeed.audiences,
        channels: strategySeed.channels,
        contentDirections: strategySeed.contentDirections,
        packageFrequency: strategySeed.packageFrequency,
        positioning: `${input.productName} 面向 ${strategySeed.audiences.join("、")}，以 ${strategySeed.contentDirections
          .slice(0, 2)
          .join("、")} 切入 ${strategySeed.targetMarkets.join("、")}。`,
        rationale: `根据中文启动 Brief 由本地规则生成，正式使用前需要人工确认。识别结果：${parsed.summary}`,
      },
    });
    const conversation = await tx.agentConversation.create({
      data: {
        workspaceId,
        projectId: project.id,
        title: "项目启动顾问对话",
      },
    });

    await tx.agentMessage.createMany({
      data: [
        {
          workspaceId,
          conversationId: conversation.id,
          role: AgentMessageRole.USER,
          content: brief,
        },
        {
          workspaceId,
          conversationId: conversation.id,
          role: AgentMessageRole.ASSISTANT,
          content: `已根据中文 Brief 创建项目、产品、待确认事实和策略草案。请先确认产品事实，再确认正式策略。`,
        },
      ],
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        projectId: project.id,
        entityType: "Project",
        entityId: project.id,
        action: "project_kickoff_created",
        summary: `中文 Brief 启动项目：${project.name}`,
        after: {
          project: projectToJson(project),
          product: productToJson(product),
          strategyId: strategy.id,
          factCount: facts.length,
          parsedSummary: parsed.summary,
        },
        actorUserId,
      },
    });

    return {
      project,
      product,
      strategy,
      factCount: facts.length,
    };
  });
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: ProjectFormInput,
  actorUserId?: string,
) {
  const project = await getProject(workspaceId, projectId);

  if (!project) {
    throw new Error("未找到当前 Workspace 下的项目。");
  }

  return prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: {
        id: project.id,
      },
      data: {
        name: input.name,
        description: input.description || null,
        status: input.status,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        projectId: project.id,
        entityType: "Project",
        entityId: project.id,
        action: "project_updated",
        summary: `更新项目：${updatedProject.name}`,
        before: projectToJson(project),
        after: projectToJson(updatedProject),
        actorUserId,
      },
    });

    return updatedProject;
  });
}

export async function replaceProjectProducts(
  workspaceId: string,
  projectId: string,
  productIds: string[],
  actorUserId?: string,
) {
  const project = await getProject(workspaceId, projectId);

  if (!project) {
    throw new Error("未找到当前 Workspace 下的项目。");
  }

  const allowedProducts = await prisma.product.findMany({
    where: scopedWhere(workspaceId, {
      id: {
        in: productIds,
      },
      deletedAt: null,
    }) as Prisma.ProductWhereInput,
    select: {
      id: true,
    },
  });

  const allowedProductIds = allowedProducts.map((product) => product.id);

  return prisma.$transaction(async (tx) => {
    await tx.projectProduct.deleteMany({
      where: {
        projectId: project.id,
      },
    });

    await Promise.all(
      allowedProductIds.map((productId) =>
        tx.projectProduct.create({
          data: {
            projectId: project.id,
            productId,
          },
        }),
      ),
    );

    await tx.changeLog.create({
      data: {
        workspaceId,
        projectId: project.id,
        entityType: "Project",
        entityId: project.id,
        action: "project_products_replaced",
        summary: `更新项目关联产品：${project.name}`,
        before: {
          productIds: project.projectProducts.map((projectProduct) => projectProduct.productId),
        },
        after: {
          productIds: allowedProductIds,
        },
        actorUserId,
      },
    });

    return tx.projectProduct.findMany({
      where: {
        projectId: project.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  });
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

function productToJson(product: {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    status: product.status,
  };
}

function buildKickoffStrategySeed(operations: ParsedAgentOperation[]) {
  const kickoffOperation = operations.find((operation) => operation.type === "kickoff_project");

  if (kickoffOperation) {
    return {
      targetMarkets: kickoffOperation.value.targetMarkets,
      audiences: kickoffOperation.value.audiences,
      channels: kickoffOperation.value.channels,
      contentDirections: kickoffOperation.value.contentDirections,
      packageFrequency: kickoffOperation.value.packageFrequency,
    };
  }

  const addedChannels = valuesFor(operations, "add_channel");
  const removedChannels = valuesFor(operations, "remove_channel");
  const targetMarkets = valuesFor(operations, "set_market");
  const audiences = valuesFor(operations, "add_audience");
  const contentDirections = valuesFor(operations, "add_content_direction");
  const packageFrequency =
    operations.find((operation) => operation.type === "set_package_frequency")?.value ??
    ContentFrequency.MONTHLY;
  const recommendedChannels = recommendChannels(targetMarkets);

  return {
    targetMarkets: targetMarkets.length > 0 ? targetMarkets : ["待确认市场"],
    audiences: audiences.length > 0 ? audiences : ["目标客群待确认"],
    channels: unique([...recommendedChannels, ...addedChannels]).filter(
      (channel) => !removedChannels.includes(channel),
    ),
    contentDirections:
      contentDirections.length > 0 ? contentDirections : ["新品认知", "场景种草", "转化促销"],
    packageFrequency,
  };
}

function recommendChannels(targetMarkets: string[]) {
  if (targetMarkets.includes("巴西")) {
    return ["TikTok", "Instagram", "Facebook"];
  }

  if (targetMarkets.includes("蒙古")) {
    return ["Facebook", "Instagram"];
  }

  if (targetMarkets.includes("日本")) {
    return ["Instagram", "TikTok", "X"];
  }

  if (targetMarkets.includes("美国")) {
    return ["TikTok", "Instagram", "YouTube"];
  }

  return ["TikTok", "Instagram"];
}

function valuesFor<T extends ParsedAgentOperation["type"]>(
  operations: ParsedAgentOperation[],
  type: T,
) {
  return unique(
    operations.flatMap((operation) =>
      operation.type === type && typeof operation.value === "string" ? [operation.value] : [],
    ),
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
