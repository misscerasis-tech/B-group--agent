"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateContentPackageFileStatus } from "@/lib/data/content-workspace";
import { parsePackageFileStatus } from "@/lib/status";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
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
