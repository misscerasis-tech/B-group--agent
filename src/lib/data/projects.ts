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
