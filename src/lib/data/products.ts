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

  return persistInferredProductFacts(
    workspaceId,
    product,
    inferProductFactsFromText({
      productName: product.name,
      description: product.description,
    }),
    "local-rule",
  );
}

export async function generateProductFactsFromText(
  workspaceId: string,
  productId: string,
  sourceText: string,
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
  );
}

async function persistInferredProductFacts(
  workspaceId: string,
  product: ProductWithFacts,
  inferredFacts: InferredProductFact[],
  source: string,
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
  });

  return result;
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
