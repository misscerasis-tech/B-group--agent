"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContentPlanItem,
  updateContentPlanItemStatus,
} from "@/lib/data/content-workspace";
import { parsePlanItemStatus } from "@/lib/status";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function readOptionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? new Date(`${value}T00:00:00`) : undefined;
}

function readWeek(formData: FormData) {
  const value = Number.parseInt(readRequiredText(formData, "week", "周次"), 10);

  if (!Number.isFinite(value) || value < 1 || value > 52) {
    throw new Error("周次必须是 1 到 52 之间的整数。");
  }

  return value;
}

export async function createContentPlanItemAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createContentPlanItem({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readRequiredText(formData, "projectId", "项目"),
    week: readWeek(formData),
    channel: readRequiredText(formData, "channel", "渠道"),
    theme: readRequiredText(formData, "theme", "主题"),
    title: readRequiredText(formData, "title", "标题"),
    deliverable: readRequiredText(formData, "deliverable", "交付物"),
    dueDate: readOptionalDate(formData, "dueDate"),
    status: parsePlanItemStatus(formData.get("status")),
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/b-agent");
  revalidatePath("/recaps");
  redirect("/calendar");
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
