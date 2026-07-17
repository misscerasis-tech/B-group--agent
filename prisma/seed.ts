import { PrismaClient, ProductStatus, ProjectStatus, WorkspaceRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      name: "演示用户",
    },
    create: {
      name: "演示用户",
      email: "demo@example.com",
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-growth-team" },
    update: {
      name: "演示增长团队",
      deletedAt: null,
    },
    create: {
      name: "演示增长团队",
      slug: "demo-growth-team",
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: WorkspaceRole.OWNER,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "demo-product-aurora-cup" },
    update: {
      workspaceId: workspace.id,
      name: "Aurora Cup 智能保温杯",
      description: "面向年轻通勤人群的智能温显保温杯，强调轻量、长效保温与礼品属性。",
      status: ProductStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      id: "demo-product-aurora-cup",
      workspaceId: workspace.id,
      name: "Aurora Cup 智能保温杯",
      description: "面向年轻通勤人群的智能温显保温杯，强调轻量、长效保温与礼品属性。",
      status: ProductStatus.ACTIVE,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project-brazil-launch" },
    update: {
      workspaceId: workspace.id,
      name: "巴西新品上市首月增长",
      description: "围绕 TikTok 与 Instagram 的新品上市内容测试项目。",
      status: ProjectStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      id: "demo-project-brazil-launch",
      workspaceId: workspace.id,
      name: "巴西新品上市首月增长",
      description: "围绕 TikTok 与 Instagram 的新品上市内容测试项目。",
      status: ProjectStatus.ACTIVE,
    },
  });

  await prisma.projectProduct.upsert({
    where: {
      projectId_productId: {
        projectId: project.id,
        productId: product.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      productId: product.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

