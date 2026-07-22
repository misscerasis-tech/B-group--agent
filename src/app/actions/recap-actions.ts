"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMetricsSnapshot, createMetricsSnapshots } from "@/lib/data/recaps";
import { parseMetricsImportRows } from "@/lib/metrics/importer";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function readNonNegativeInteger(formData: FormData, key: string, label: string) {
  const rawValue = readRequiredText(formData, key, label);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label}必须是大于或等于 0 的整数。`);
  }

  return value;
}

function readSpendCents(formData: FormData) {
  const rawValue = readRequiredText(formData, "spend", "花费");
  const value = Number.parseFloat(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("花费必须是大于或等于 0 的数字。");
  }

  return Math.round(value * 100);
}

export async function createMetricsSnapshotAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const notes = String(formData.get("notes") ?? "").trim();
  const impressions = readNonNegativeInteger(formData, "impressions", "曝光");
  const clicks = readNonNegativeInteger(formData, "clicks", "点击");
  const conversions = readNonNegativeInteger(formData, "conversions", "转化");

  if (clicks > impressions) {
    throw new Error("点击不能大于曝光。");
  }

  if (conversions > clicks) {
    throw new Error("转化不能大于点击。");
  }

  await createMetricsSnapshot({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readRequiredText(formData, "projectId", "项目"),
    period: readRequiredText(formData, "period", "周期"),
    channel: readRequiredText(formData, "channel", "渠道"),
    impressions,
    clicks,
    conversions,
    spendCents: readSpendCents(formData),
    notes: notes.length > 0 ? notes : undefined,
  });

  revalidatePath("/recaps");
  revalidatePath("/dashboard");
  redirect("/recaps");
}

export async function importMetricsSnapshotsAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const rows = parseMetricsImportRows(readRequiredText(formData, "rows", "批量指标数据"));

  await createMetricsSnapshots({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readRequiredText(formData, "projectId", "项目"),
    rows,
  });

  revalidatePath("/recaps");
  revalidatePath("/dashboard");
  revalidatePath("/reminders");
  redirect("/recaps");
}
