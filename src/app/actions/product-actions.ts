"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/data/products";
import { parseProductStatus } from "@/lib/status";
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

export async function createProductAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const product = await createProduct(context.currentWorkspace.id, {
    name: readRequiredText(formData, "name", "产品名称"),
    description: readOptionalText(formData, "description"),
    status: parseProductStatus(formData.get("status")),
  });

  revalidatePath("/brain");
  redirect(`/brain/products/${product.id}`);
}

export async function updateProductAction(productId: string, formData: FormData) {
  const context = await getWorkspaceContext();

  await updateProduct(context.currentWorkspace.id, productId, {
    name: readRequiredText(formData, "name", "产品名称"),
    description: readOptionalText(formData, "description"),
    status: parseProductStatus(formData.get("status")),
  });

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}

