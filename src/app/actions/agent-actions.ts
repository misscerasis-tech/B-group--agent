"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyPendingAgentOperation,
  confirmProjectStrategy,
  generateStarterPlan,
  submitAgentCommand,
} from "@/lib/data/assistant";
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
  redirect(bAgentReturnPath(projectId));
}
