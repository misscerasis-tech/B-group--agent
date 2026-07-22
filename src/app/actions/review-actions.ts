"use server";

import { ReviewTaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMissingReviewTasks, decideReviewTask } from "@/lib/data/content-workspace";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function parseDecision(value: FormDataEntryValue | null) {
  if (value === ReviewTaskStatus.CHANGES_REQUESTED) {
    return ReviewTaskStatus.CHANGES_REQUESTED;
  }

  return ReviewTaskStatus.APPROVED;
}

export async function createMissingReviewTasksAction() {
  const context = await getWorkspaceContext();

  await createMissingReviewTasks({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
  });

  revalidatePath("/reviews");
  redirect("/reviews");
}

export async function decideReviewTaskAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const taskId = readRequiredText(formData, "taskId", "审核任务");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim();

  await decideReviewTask({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    taskId,
    decision: parseDecision(formData.get("decision")),
    decisionNote: decisionNote.length > 0 ? decisionNote : undefined,
  });

  revalidatePath("/reviews");
  revalidatePath("/b-agent");
  revalidatePath("/assets");
  revalidatePath("/packages");
  revalidatePath("/brain");
  redirect("/reviews");
}
