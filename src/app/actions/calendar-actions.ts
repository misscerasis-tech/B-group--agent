"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateContentPlanItemStatus } from "@/lib/data/content-workspace";
import { parsePlanItemStatus } from "@/lib/status";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

export async function updateContentPlanItemStatusAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await updateContentPlanItemStatus({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    planItemId: readRequiredText(formData, "planItemId", "内容计划"),
    status: parsePlanItemStatus(formData.get("status")),
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/recaps");
  redirect("/calendar");
}
