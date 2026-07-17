import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProductFormInput = {
  name: string;
  description?: string;
  status: ProductStatus;
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

