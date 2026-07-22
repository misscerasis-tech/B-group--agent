"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProjectHealthReminders } from "@/lib/data/project-health";
import { getWorkspaceContext } from "@/lib/workspace-context";

export async function createProjectHealthRemindersAction(projectId: string) {
  const context = await getWorkspaceContext();

  await createProjectHealthReminders({
    workspaceId: context.currentWorkspace.id,
    projectId,
    userId: context.user.id,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reminders");
  redirect(`/projects/${projectId}`);
}
