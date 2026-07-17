import Link from "next/link";
import { updateProductAction } from "@/app/actions/product-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProduct } from "@/lib/data/products";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { projectStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/brain" context={null} contextError={error} returnTo="/brain">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const product = await getProduct(context.currentWorkspace.id, id);

    if (!product) {
      return (
        <AppShell activePath="/brain" context={context} returnTo="/brain">
          <EmptyState title="未找到产品" description="该产品不存在，或不属于当前 Workspace。" />
        </AppShell>
      );
    }

    return (
      <AppShell activePath="/brain" context={context} returnTo={`/brain/products/${product.id}`}>
        <section className="page-header">
          <div>
            <h2>{product.name}</h2>
            <p className="muted">维护产品事实，后续 AI 策略和素材生成会从这里读取。</p>
          </div>
          <Link className="button secondary" href="/brain">
            返回产品大脑
          </Link>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>产品基础信息</h3>
            <form action={updateProductAction.bind(null, product.id)} className="form">
              <label className="form-row">
                <span className="field-label">产品名称</span>
                <input defaultValue={product.name} name="name" required />
              </label>
              <label className="form-row">
                <span className="field-label">产品说明</span>
                <textarea defaultValue={product.description ?? ""} name="description" />
              </label>
              <label className="form-row">
                <span className="field-label">产品状态</span>
                <select defaultValue={product.status} name="status">
                  <option value="DRAFT">草稿</option>
                  <option value="ACTIVE">启用</option>
                  <option value="ARCHIVED">已归档</option>
                </select>
              </label>
              <button className="button" type="submit">
                保存产品
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>已关联项目</h3>
            {product.projectProducts.length > 0 ? (
              <div className="card-list">
                {product.projectProducts.map(({ project }) => (
                  <Link className="item-card" href={`/projects/${project.id}`} key={project.id}>
                    <header>
                      <h4>{project.name}</h4>
                      <StatusBadge
                        label={projectStatusLabels[project.status]}
                        tone={project.status === "ACTIVE" ? "success" : "neutral"}
                      />
                    </header>
                    <p>{project.description ?? "暂无项目说明"}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="暂未关联项目" description="可以在项目详情页把这个产品关联进去。" />
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (productError) {
    return (
      <AppShell activePath="/brain" context={context} returnTo="/brain">
        <ErrorState
          message={productError instanceof Error ? productError.message : "无法加载产品详情。"}
        />
      </AppShell>
    );
  }
}

