import type { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProjectFormInput = {
  name: string;
  description?: string;
  status: ProjectStatus;
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

export async function createProject(workspaceId: string, input: ProjectFormInput) {
  return prisma.project.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description || null,
      status: input.status,
    },
  });
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: ProjectFormInput,
) {
  const project = await getProject(workspaceId, projectId);

  if (!project) {
    throw new Error("未找到当前 Workspace 下的项目。");
  }

  return prisma.project.update({
    where: {
      id: project.id,
    },
    data: {
      name: input.name,
      description: input.description || null,
      status: input.status,
    },
  });
}

export async function replaceProjectProducts(
  workspaceId: string,
  projectId: string,
  productIds: string[],
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

  return prisma.$transaction([
    prisma.projectProduct.deleteMany({
      where: {
        projectId: project.id,
      },
    }),
    ...allowedProductIds.map((productId) =>
      prisma.projectProduct.create({
        data: {
          projectId: project.id,
          productId,
        },
      }),
    ),
  ]);
}

