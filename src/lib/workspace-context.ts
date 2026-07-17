import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@example.com";
const WORKSPACE_COOKIE = "ai_content_growth_workspace";

export type WorkspaceContext = Awaited<ReturnType<typeof getWorkspaceContext>>;

export const getWorkspaceContext = cache(async () => {
  const cookieStore = await cookies();
  const selectedSlug = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    include: {
      memberships: {
        where: {
          workspace: {
            deletedAt: null,
          },
        },
        include: {
          workspace: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!user) {
    throw new Error("未找到演示用户，请先运行数据库迁移和 seed。");
  }

  if (user.memberships.length === 0) {
    throw new Error("演示用户尚未加入任何 Workspace，请检查 seed 数据。");
  }

  const selectedMembership =
    user.memberships.find((membership) => membership.workspace.slug === selectedSlug) ??
    user.memberships[0];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    workspaces: user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
    currentWorkspace: {
      id: selectedMembership.workspace.id,
      name: selectedMembership.workspace.name,
      slug: selectedMembership.workspace.slug,
    },
    currentRole: selectedMembership.role,
  };
});

export async function setCurrentWorkspace(slug: string) {
  const cookieStore = await cookies();

  cookieStore.set(WORKSPACE_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

