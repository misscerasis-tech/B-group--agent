import Link from "next/link";
import {
  updateProjectAction,
  updateProjectProductsAction,
} from "@/app/actions/project-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getProject } from "@/lib/data/projects";
import { listProducts } from "@/lib/data/products";
import { loadWorkspaceContextSafe } from "@/lib/page-context";

export const dynamic = "force-dynamic";

type ProjectDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/projects" context={null} contextError={error} returnTo="/projects">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const [project, products] = await Promise.all([
      getProject(context.currentWorkspace.id, id),
      listProducts(context.currentWorkspace.id),
    ]);

    if (!project) {
      return (
        <AppShell activePath="/projects" context={context} returnTo="/projects">
          <EmptyState title="未找到项目" description="该项目不存在，或不属于当前 Workspace。" />
        </AppShell>
      );
    }

    const linkedProductIds = new Set(
      project.projectProducts.map((projectProduct) => projectProduct.productId),
    );

    return (
      <AppShell activePath="/projects" context={context} returnTo={`/projects/${project.id}`}>
        <section className="page-header">
          <div>
            <h2>{project.name}</h2>
            <p className="muted">编辑项目基础信息，并管理它关联的产品。</p>
          </div>
          <Link className="button secondary" href="/projects">
            返回项目中心
          </Link>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>项目基础信息</h3>
            <form action={updateProjectAction.bind(null, project.id)} className="form">
              <label className="form-row">
                <span className="field-label">项目名称</span>
                <input defaultValue={project.name} name="name" required />
              </label>
              <label className="form-row">
                <span className="field-label">项目说明</span>
                <textarea defaultValue={project.description ?? ""} name="description" />
              </label>
              <label className="form-row">
                <span className="field-label">项目状态</span>
                <select defaultValue={project.status} name="status">
                  <option value="DRAFT">草稿</option>
                  <option value="ACTIVE">进行中</option>
                  <option value="PAUSED">暂停</option>
                  <option value="ARCHIVED">已归档</option>
                </select>
              </label>
              <button className="button" type="submit">
                保存项目
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>关联产品</h3>
            {products.length > 0 ? (
              <form action={updateProjectProductsAction.bind(null, project.id)} className="form">
                <div className="checkbox-list">
                  {products.map((product) => (
                    <label className="checkbox-item" key={product.id}>
                      <input
                        defaultChecked={linkedProductIds.has(product.id)}
                        name="productIds"
                        type="checkbox"
                        value={product.id}
                      />
                      <span>{product.name}</span>
                    </label>
                  ))}
                </div>
                <button className="button" type="submit">
                  保存关联
                </button>
              </form>
            ) : (
              <EmptyState
                title="还没有产品"
                description="先到产品大脑创建产品，再把产品关联到项目。"
              />
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (projectError) {
    return (
      <AppShell activePath="/projects" context={context} returnTo="/projects">
        <ErrorState
          message={projectError instanceof Error ? projectError.message : "无法加载项目详情。"}
        />
      </AppShell>
    );
  }
}

