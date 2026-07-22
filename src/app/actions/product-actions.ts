"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmAllProductFacts,
  createProduct,
  createProductFact,
  generateInitialProductFacts,
  generateProductFactsFromText,
  updateProduct,
} from "@/lib/data/products";
import { parseProductFactStatus, parseProductStatus } from "@/lib/status";
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
  const product = await createProduct(
    context.currentWorkspace.id,
    {
      name: readRequiredText(formData, "name", "产品名称"),
      description: readOptionalText(formData, "description"),
      status: parseProductStatus(formData.get("status")),
    },
    context.user.id,
  );

  revalidatePath("/brain");
  redirect(`/brain/products/${product.id}`);
}

export async function updateProductAction(productId: string, formData: FormData) {
  const context = await getWorkspaceContext();

  await updateProduct(
    context.currentWorkspace.id,
    productId,
    {
      name: readRequiredText(formData, "name", "产品名称"),
      description: readOptionalText(formData, "description"),
      status: parseProductStatus(formData.get("status")),
    },
    context.user.id,
  );

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}

export async function createProductFactAction(productId: string, formData: FormData) {
  const context = await getWorkspaceContext();

  await createProductFact(
    context.currentWorkspace.id,
    productId,
    {
      label: readRequiredText(formData, "label", "事实名称"),
      value: readRequiredText(formData, "value", "事实内容"),
      status: parseProductFactStatus(formData.get("status")),
    },
    context.user.id,
  );

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}

export async function generateInitialProductFactsAction(productId: string) {
  const context = await getWorkspaceContext();

  await generateInitialProductFacts(context.currentWorkspace.id, productId, context.user.id);

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}

export async function generateProductFactsFromTextAction(productId: string, formData: FormData) {
  const context = await getWorkspaceContext();

  await generateProductFactsFromText(
    context.currentWorkspace.id,
    productId,
    readRequiredText(formData, "sourceText", "产品资料"),
    context.user.id,
  );

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}

export async function confirmAllProductFactsAction(productId: string) {
  const context = await getWorkspaceContext();

  await confirmAllProductFacts(context.currentWorkspace.id, productId, context.user.id);

  revalidatePath("/brain");
  revalidatePath(`/brain/products/${productId}`);
  redirect(`/brain/products/${productId}`);
}
