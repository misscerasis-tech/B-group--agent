"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFeishuConnectionPlaceholder,
  createIntegrationMigrationRecord,
  disableIntegrationConnection,
} from "@/lib/data/integrations";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function readOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

export async function createFeishuPlaceholderAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createFeishuConnectionPlaceholder(context.currentWorkspace.id, {
    displayName: readRequiredText(formData, "displayName", "连接名称"),
    tenantDisplayName: readOptionalText(formData, "tenantDisplayName"),
    notificationTargetName: readOptionalText(formData, "notificationTargetName"),
    repositoryTargetName: readOptionalText(formData, "repositoryTargetName"),
    notes: readOptionalText(formData, "notes"),
  });

  revalidatePath("/integrations");
  redirect("/integrations");
}

export async function disableIntegrationConnectionAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const connectionId = readRequiredText(formData, "connectionId", "集成连接");

  await disableIntegrationConnection(context.currentWorkspace.id, connectionId);

  revalidatePath("/integrations");
  redirect("/integrations");
}

export async function createIntegrationMigrationRecordAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createIntegrationMigrationRecord(context.currentWorkspace.id, {
    connectionId: readOptionalText(formData, "connectionId"),
    fromTargetName: readOptionalText(formData, "fromTargetName"),
    toTargetName: readOptionalText(formData, "toTargetName"),
    summary: readRequiredText(formData, "summary", "迁移说明"),
  });

  revalidatePath("/integrations");
  redirect("/integrations");
}
