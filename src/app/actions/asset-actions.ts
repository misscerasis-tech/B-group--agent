"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveAsset,
  createTemplateCompositionJob,
  createUploadedAsset,
  rejectAsset,
} from "@/lib/data/assets";
import { parseAssetKind } from "@/lib/status";
import { getWorkspaceContext } from "@/lib/workspace-context";

function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label}不能为空。`);
  }

  return value;
}

function readOptionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

export async function uploadAssetAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("请选择要上传的素材文件。");
  }

  await createUploadedAsset({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readOptionalId(formData, "projectId"),
    productId: readOptionalId(formData, "productId"),
    name: readRequiredText(formData, "name", "素材名称"),
    kind: parseAssetKind(formData.get("kind")),
    file,
  });

  revalidatePath("/assets");
  redirect("/assets");
}

export async function approveAssetAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const assetId = readRequiredText(formData, "assetId", "素材");

  await approveAsset(context.currentWorkspace.id, context.user.id, assetId);

  revalidatePath("/assets");
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  redirect("/assets");
}

export async function rejectAssetAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const assetId = readRequiredText(formData, "assetId", "素材");

  await rejectAsset(context.currentWorkspace.id, context.user.id, assetId);

  revalidatePath("/assets");
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  redirect("/assets");
}

export async function createTemplateCompositionJobAction(formData: FormData) {
  const context = await getWorkspaceContext();

  await createTemplateCompositionJob({
    workspaceId: context.currentWorkspace.id,
    userId: context.user.id,
    projectId: readOptionalId(formData, "projectId"),
    productImageAssetId: readRequiredText(formData, "productImageAssetId", "真实产品图"),
    logoAssetId: readRequiredText(formData, "logoAssetId", "官方 Logo"),
    aspectRatio: readRequiredText(formData, "aspectRatio", "画布比例"),
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  revalidatePath("/recaps");
  redirect("/assets");
}
