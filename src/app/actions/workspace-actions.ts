"use server";

import { redirect } from "next/navigation";
import { getWorkspaceContext, setCurrentWorkspace } from "@/lib/workspace-context";

export async function switchWorkspaceAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/dashboard");
  const context = await getWorkspaceContext();
  const canAccessWorkspace = context.workspaces.some((workspace) => workspace.slug === slug);

  if (canAccessWorkspace) {
    await setCurrentWorkspace(slug);
  }

  redirect(returnTo);
}

