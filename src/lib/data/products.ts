import type { ProductFactStatus, ProductStatus } from "@prisma/client";
import { ProductFactStatus as ProductFactStatusValue } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProductFormInput = {
  name: string;
  description?: string;
  status: ProductStatus;
};

export type ProductFactFormInput = {
  label: string;
  value: string;
  status: ProductFactStatus;
  confidence?: number;
};

export async function listProducts(workspaceId: string) {
  return prisma.product.findMany({
    where: scopedWhere(workspaceId, {
      deletedAt: null,
    }),
    include: {
      projectProducts: {
        include: {
          project: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getProduct(workspaceId: string, productId: string) {
  return prisma.product.findFirst({
    where: scopedWhere(workspaceId, {
      id: productId,
      deletedAt: null,
    }),
    include: {
      projectProducts: {
        include: {
          project: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      facts: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function createProduct(workspaceId: string, input: ProductFormInput) {
  return prisma.product.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description || null,
      status: input.status,
    },
  });
}

export async function createProductFact(
  workspaceId: string,
  productId: string,
  input: ProductFactFormInput,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.productFact.create({
    data: {
      workspaceId,
      productId,
      label: input.label,
      value: input.value,
      status: input.status,
      confidence: input.confidence ?? 80,
      source: "manual",
    },
  });
}

export async function confirmAllProductFacts(workspaceId: string, productId: string) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.productFact.updateMany({
    where: scopedWhere(workspaceId, {
      productId,
    }),
    data: {
      status: ProductFactStatusValue.CONFIRMED,
    },
  });
}

export async function generateInitialProductFacts(workspaceId: string, productId: string) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  const existingLabels = new Set(product.facts.map((fact) => fact.label));
  const description = product.description?.trim() || "暂无产品说明";
  const inferredFacts = [
    {
      label: "产品名称",
      value: product.name,
      confidence: 95,
    },
    {
      label: "产品说明",
      value: description,
      confidence: product.description ? 78 : 40,
    },
    {
      label: "目标场景",
      value: inferScenes(description),
      confidence: 62,
    },
    {
      label: "视觉限制",
      value: "正式素材必须使用已审核真实产品图和官方 Logo，禁止 AI 重绘产品结构。",
      confidence: 100,
    },
  ].filter((fact) => !existingLabels.has(fact.label));

  if (inferredFacts.length === 0) {
    return {
      created: 0,
    };
  }

  const result = await prisma.productFact.createMany({
    data: inferredFacts.map((fact) => ({
      workspaceId,
      productId,
      label: fact.label,
      value: fact.value,
      confidence: fact.confidence,
      source: "local-rule",
      status: ProductFactStatusValue.DRAFT,
    })),
  });

  return {
    created: result.count,
  };
}

function inferScenes(description: string) {
  const sceneRules: Array<[string, string[]]> = [
    ["通勤", ["通勤", "便携", "上班", "办公室"]],
    ["健身", ["健身", "运动", "户外"]],
    ["礼赠", ["礼品", "礼赠", "送礼", "节日"]],
    ["家庭", ["家庭", "亲子", "厨房"]],
  ];

  const scenes = sceneRules
    .filter(([, keywords]) => keywords.some((keyword) => description.includes(keyword)))
    .map(([scene]) => scene);

  return scenes.length > 0 ? scenes.join("、") : "待人工补充使用场景";
}

export async function updateProduct(
  workspaceId: string,
  productId: string,
  input: ProductFormInput,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.product.update({
    where: {
      id: product.id,
    },
    data: {
      name: input.name,
      description: input.description || null,
      status: input.status,
    },
  });
}
