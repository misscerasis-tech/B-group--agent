"use server";

import { ReminderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProactiveReminders, resolveReminder } from "@/lib/data/content-workspace";
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
