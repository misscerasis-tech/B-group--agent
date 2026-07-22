import type { ProductFactStatus, ProductStatus } from "@prisma/client";
import { ProductFactStatus as ProductFactStatusValue } from "@prisma/client";
import { inferProductFactsFromText, type InferredProductFact } from "@/lib/product-facts/extractor";
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

type ProductWithFacts = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

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

export async function createProduct(
  workspaceId: string,
  input: ProductFormInput,
  actorUserId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
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
        entityType: "Product",
        entityId: product.id,
        action: "product_created",
        summary: `创建产品：${product.name}`,
        after: productToJson(product),
        actorUserId,
      },
    });

    return product;
  });
}

export async function createProductFact(
  workspaceId: string,
  productId: string,
  input: ProductFactFormInput,
  actorUserId?: string,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.$transaction(async (tx) => {
    const fact = await tx.productFact.create({
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

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "ProductFact",
        entityId: fact.id,
        action: "product_fact_created",
        summary: `新增产品事实：${product.name} · ${fact.label}`,
        after: productFactToJson(fact),
        actorUserId,
      },
    });

    return fact;
  });
}

export async function confirmAllProductFacts(
  workspaceId: string,
  productId: string,
  actorUserId?: string,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.productFact.updateMany({
      where: scopedWhere(workspaceId, {
        productId,
      }),
      data: {
        status: ProductFactStatusValue.CONFIRMED,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "ProductFact",
        entityId: productId,
        action: "product_facts_confirmed",
        summary: `确认产品事实：${product.name} · ${result.count} 条`,
        before: {
          factIds: product.facts.map((fact) => fact.id),
          statuses: product.facts.map((fact) => fact.status),
        },
        after: {
          status: ProductFactStatusValue.CONFIRMED,
          count: result.count,
        },
        actorUserId,
      },
    });

    return result;
  });
}

export async function generateInitialProductFacts(
  workspaceId: string,
  productId: string,
  actorUserId?: string,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return persistInferredProductFacts(
    workspaceId,
    product,
    inferProductFactsFromText({
      productName: product.name,
      description: product.description,
    }),
    "local-rule",
    actorUserId,
  );
}

export async function generateProductFactsFromText(
  workspaceId: string,
  productId: string,
  sourceText: string,
  actorUserId?: string,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return persistInferredProductFacts(
    workspaceId,
    product,
    inferProductFactsFromText({
      productName: product.name,
      description: product.description,
      sourceText,
    }),
    "local-rule:supplement",
    actorUserId,
  );
}

async function persistInferredProductFacts(
  workspaceId: string,
  product: ProductWithFacts,
  inferredFacts: InferredProductFact[],
  source: string,
  actorUserId?: string,
) {
  const existingFactsByLabel = new Map(product.facts.map((fact) => [fact.label, fact]));
  const result = {
    created: 0,
    updated: 0,
    skippedConfirmed: 0,
  };

  await prisma.$transaction(async (tx) => {
    for (const fact of inferredFacts) {
      const existingFact = existingFactsByLabel.get(fact.label);

      if (!existingFact) {
        await tx.productFact.create({
          data: {
            workspaceId,
            productId: product.id,
            label: fact.label,
            value: fact.value,
            confidence: fact.confidence,
            source,
            status: ProductFactStatusValue.DRAFT,
          },
        });
        result.created += 1;
        continue;
      }

      if (existingFact.status === ProductFactStatusValue.CONFIRMED) {
        result.skippedConfirmed += 1;
        continue;
      }

      await tx.productFact.update({
        where: {
          id: existingFact.id,
        },
        data: {
          value: fact.value,
          confidence: fact.confidence,
          source,
          status: ProductFactStatusValue.NEEDS_REVIEW,
        },
      });
      result.updated += 1;
    }

    if (result.created > 0 || result.updated > 0 || result.skippedConfirmed > 0) {
      await tx.changeLog.create({
        data: {
          workspaceId,
          entityType: "ProductFact",
          entityId: product.id,
          action: "product_facts_inferred",
          summary: `生成产品事实：${product.name} · 新增 ${result.created} 条，更新 ${result.updated} 条，跳过已确认 ${result.skippedConfirmed} 条`,
          after: {
            source,
            ...result,
          },
          actorUserId,
        },
      });
    }
  });

  return result;
}

export async function updateProduct(
  workspaceId: string,
  productId: string,
  input: ProductFormInput,
  actorUserId?: string,
) {
  const product = await getProduct(workspaceId, productId);

  if (!product) {
    throw new Error("未找到当前 Workspace 下的产品。");
  }

  return prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: {
        id: product.id,
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
        entityType: "Product",
        entityId: product.id,
        action: "product_updated",
        summary: `更新产品：${updatedProduct.name}`,
        before: productToJson(product),
        after: productToJson(updatedProduct),
        actorUserId,
      },
    });

    return updatedProduct;
  });
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

function productFactToJson(fact: {
  id: string;
  productId: string;
  label: string;
  value: string;
  source: string | null;
  status: ProductFactStatus;
  confidence: number;
}) {
  return {
    id: fact.id,
    productId: fact.productId,
    label: fact.label,
    value: fact.value,
    source: fact.source,
    status: fact.status,
    confidence: fact.confidence,
  };
}
