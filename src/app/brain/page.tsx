import Link from "next/link";
import { createProductAction } from "@/app/actions/product-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listProducts } from "@/lib/data/products";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { productStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ProductBrainPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/brain" context={null} contextError={error} returnTo="/brain">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const products = await listProducts(context.currentWorkspace.id);

    return (
      <AppShell activePath="/brain" context={context} returnTo="/brain">
        <section className="page-header">
          <div>
            <h2>产品大脑</h2>
            <p className="muted">
              本阶段先保存产品事实。后续 AI 顾问会基于这些事实推荐市场、客群和渠道。
            </p>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>新建产品</h3>
            <form action={createProductAction} className="form">
              <label className="form-row">
                <span className="field-label">产品名称</span>
                <input name="name" placeholder="例如：Aurora Cup 智能保温杯" required />
              </label>
              <label className="form-row">
                <span className="field-label">产品说明</span>
                <textarea name="description" placeholder="描述产品用途、卖点、目标人群和限制。" />
              </label>
              <label className="form-row">
                <span className="field-label">产品状态</span>
                <select defaultValue="DRAFT" name="status">
                  <option value="DRAFT">草稿</option>
                  <option value="ACTIVE">启用</option>
                  <option value="ARCHIVED">已归档</option>
                </select>
              </label>
              <button className="button" type="submit">
                创建产品
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>产品列表</h3>
            {products.length > 0 ? (
              <div className="card-list">
                {products.map((product) => (
                  <Link className="item-card" href={`/brain/products/${product.id}`} key={product.id}>
                    <header>
                      <h4>{product.name}</h4>
                      <StatusBadge
                        label={productStatusLabels[product.status]}
                        tone={product.status === "ACTIVE" ? "success" : "neutral"}
                      />
                    </header>
                    <p>{product.description ?? "暂无产品说明"}</p>
                    <p>
                      已用于 {product.projectProducts.length} 个项目
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有产品" description="创建产品后，后续策略和素材会复用产品事实。" />
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (productsError) {
    return (
      <AppShell activePath="/brain" context={context} returnTo="/brain">
        <ErrorState
          message={productsError instanceof Error ? productsError.message : "无法加载产品大脑。"}
        />
      </AppShell>
    );
  }
}

