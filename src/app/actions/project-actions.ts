"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  replaceProjectProducts,
  updateProject,
} from "@/lib/data/projects";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { parseProjectStatus } from "@/lib/status";

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

export async function createProjectAction(formData: FormData) {
  const context = await getWorkspaceContext();
  const project = await createProject(context.currentWorkspace.id, {
    name: readRequiredText(formData, "name", "项目名称"),
    description: readOptionalText(formData, "description"),
    status: parseProjectStatus(formData.get("status")),
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const context = await getWorkspaceContext();

  await updateProject(context.currentWorkspace.id, projectId, {
    name: readRequiredText(formData, "name", "项目名称"),
    description: readOptionalText(formData, "description"),
    status: parseProjectStatus(formData.get("status")),
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateProjectProductsAction(projectId: string, formData: FormData) {
  const context = await getWorkspaceContext();
  const productIds = formData.getAll("productIds").map((id) => String(id));

  await replaceProjectProducts(context.currentWorkspace.id, projectId, productIds);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

