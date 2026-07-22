"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContentPackage,
  updateContentPackageFileStatus,
} from "@/lib/data/content-workspace";
import { parseContentFrequency, parsePackageFileStatus } from "@/lib/status";
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

export async function createContentPackageAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createContentPackage({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readRequiredText(formData, "projectId", "项目"),
    name: readRequiredText(formData, "name", "素材包名称"),
    period: readRequiredText(formData, "period", "周期"),
    frequency: parseContentFrequency(formData.get("frequency")),
    summary: readOptionalText(formData, "summary"),
  });

  revalidatePath("/packages");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/recaps");
  redirect("/packages");
}

export async function updateContentPackageFileStatusAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await updateContentPackageFileStatus({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    fileId: readRequiredText(formData, "fileId", "素材包文件项"),
    status: parsePackageFileStatus(formData.get("status")),
  });

  revalidatePath("/packages");
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  revalidatePath("/recaps");
  redirect("/packages");
}
