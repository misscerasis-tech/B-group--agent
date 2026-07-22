"use server";

import { ReminderStatus, ReviewTaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyPendingAgentOperation,
  confirmProjectStrategy,
  generateStarterPlan,
  rejectPendingAgentOperation,
  submitAgentCommand,
} from "@/lib/data/assistant";
import { cancelReviewTask, decideReviewTask, resolveReminder } from "@/lib/data/content-workspace";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function bAgentReturnPath(projectId: string) {
  return `/b-agent?projectId=${encodeURIComponent(projectId)}`;
}

function parseReminderResolution(value: FormDataEntryValue | null) {
  return value === ReminderStatus.DISMISSED ? ReminderStatus.DISMISSED : ReminderStatus.DONE;
}

function parseReviewDecision(value: FormDataEntryValue | null) {
  return value === ReviewTaskStatus.CHANGES_REQUESTED
    ? ReviewTaskStatus.CHANGES_REQUESTED
    : ReviewTaskStatus.APPROVED;
}

export async function submitAgentCommandAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const projectId = readRequiredText(formData, "projectId", "当前项目");
  const command = readRequiredText(formData, "command", "中文指令");

  await submitAgentCommand({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId,
    text: command,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/packages");
  revalidatePath("/reminders");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}

export async function resolveBAgentReminderAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const reminderId = readRequiredText(formData, "reminderId", "提醒");
  const projectId = readRequiredText(formData, "projectId", "当前项目");

  await resolveReminder({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    reminderId,
    status: parseReminderResolution(formData.get("status")),
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/reminders");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}

export async function decideBAgentReviewTaskAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const taskId = readRequiredText(formData, "taskId", "审核任务");
  const projectId = readRequiredText(formData, "projectId", "当前项目");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim();

  await decideReviewTask({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    taskId,
    projectId,
    decision: parseReviewDecision(formData.get("decision")),
    decisionNote: decisionNote.length > 0 ? decisionNote : undefined,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/assets");
  revalidatePath("/packages");
  revalidatePath("/brain");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}

export async function cancelBAgentReviewTaskAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const taskId = readRequiredText(formData, "taskId", "审核任务");
  const projectId = readRequiredText(formData, "projectId", "当前项目");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim();

  await cancelReviewTask({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    taskId,
    projectId,
    decisionNote: decisionNote.length > 0 ? decisionNote : "B 组 Agent 工作台取消审核任务。",
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/assets");
  revalidatePath("/packages");
  revalidatePath("/brain");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}

export async function applyPendingAgentOperationAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const operationId = readRequiredText(formData, "operationId", "待确认操作");
  const projectId = readRequiredText(formData, "projectId", "当前项目");

  await applyPendingAgentOperation({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    operationId,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/packages");
  revalidatePath("/reminders");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}

export async function rejectPendingAgentOperationAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const operationId = readRequiredText(formData, "operationId", "待拒绝操作");
  const projectId = readRequiredText(formData, "projectId", "当前项目");

  await rejectPendingAgentOperation({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    operationId,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  redirect(bAgentReturnPath(projectId));
}

export async function confirmProjectStrategyAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const projectId = readRequiredText(formData, "projectId", "当前项目");
  const strategyId = readRequiredText(formData, "strategyId", "策略草案");

  await confirmProjectStrategy({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId,
    strategyId,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  redirect(bAgentReturnPath(projectId));
}

export async function generateStarterPlanAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const projectId = readRequiredText(formData, "projectId", "当前项目");

  await generateStarterPlan({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId,
  });

  revalidatePath("/b-agent");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/packages");
  revalidatePath("/reminders");
  revalidatePath("/recaps");
  redirect(bAgentReturnPath(projectId));
}
