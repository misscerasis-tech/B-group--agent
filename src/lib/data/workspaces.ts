import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createWorkspaceForUser(input: { userId: string; name: string }) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Workspace 名称不能为空。");
  }

  const slug = await buildUniqueWorkspaceSlug(name);

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        slug,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: input.userId,
        role: WorkspaceRole.OWNER,
      },
    });

    return workspace;
  });
}

async function buildUniqueWorkspaceSlug(name: string) {
  const baseSlug = slugify(name) || `workspace-${Date.now()}`;

  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existingWorkspace = await prisma.workspace.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (!existingWorkspace) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
