"use server";

import { ReminderSeverity, ReminderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createManualReminder,
  createProactiveReminders,
  resolveReminder,
} from "@/lib/data/content-workspace";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function parseReminderStatus(value: FormDataEntryValue | null) {
  if (value === ReminderStatus.DISMISSED) {
    return ReminderStatus.DISMISSED;
  }

  return ReminderStatus.DONE;
}

function readOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function readOptionalDate(formData: FormData, key: string) {
  const value = readOptionalText(formData, key);
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function parseReminderSeverity(value: FormDataEntryValue | null) {
  if (value === ReminderSeverity.CRITICAL || value === ReminderSeverity.WARNING) {
    return value;
  }

  return ReminderSeverity.INFO;
}

export async function createManualReminderAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createManualReminder({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readOptionalText(formData, "projectId"),
    title: readRequiredText(formData, "title", "提醒标题"),
    description: readOptionalText(formData, "description"),
    severity: parseReminderSeverity(formData.get("severity")),
    dueAt: readOptionalDate(formData, "dueAt"),
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/recaps");
  redirect("/reminders");
}

export async function createProactiveRemindersAction() {
  const context = await getWorkspaceContext();

  await createProactiveReminders({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  redirect("/reminders");
}

export async function resolveReminderAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await resolveReminder({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    reminderId: readRequiredText(formData, "reminderId", "提醒"),
    status: parseReminderStatus(formData.get("status")),
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/recaps");
  redirect("/reminders");
}
