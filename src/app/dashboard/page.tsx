import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardSummary } from "@/lib/data/dashboard";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { productStatusLabels, projectStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/dashboard" context={null} contextError={error} returnTo="/dashboard">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const summary = await getDashboardSummary(context.currentWorkspace.id);

    return (
      <AppShell activePath="/dashboard" context={context} returnTo="/dashboard">
        <section className="page-header">
          <div>
            <h2>今日工作台</h2>
            <p className="muted">
              当前 Workspace：{context.currentWorkspace.name}。这里先展示项目、产品和下一步事项。
            </p>
          </div>
          <Link className="button" href="/projects">
            进入项目中心
          </Link>
        </section>

        <section className="grid three">
          <div className="panel stat">
            <span className="muted">项目总数</span>
            <strong>{summary.projectCount}</strong>
          </div>
          <div className="panel stat">
            <span className="muted">进行中项目</span>
            <strong>{summary.activeProjectCount}</strong>
          </div>
          <div className="panel stat">
            <span className="muted">产品数量</span>
            <strong>{summary.productCount}</strong>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3>最近项目</h3>
            {summary.recentProjects.length > 0 ? (
              <div className="card-list">
                {summary.recentProjects.map((project) => (
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
              <EmptyState title="还没有项目" description="先在项目中心创建第一个增长项目。" />
            )}
          </div>

          <div className="panel">
            <h3>最近产品</h3>
            {summary.recentProducts.length > 0 ? (
              <div className="card-list">
                {summary.recentProducts.map((product) => (
                  <Link className="item-card" href={`/brain/products/${product.id}`} key={product.id}>
                    <header>
                      <h4>{product.name}</h4>
                      <StatusBadge
                        label={productStatusLabels[product.status]}
                        tone={product.status === "ACTIVE" ? "success" : "neutral"}
                      />
                    </header>
                    <p>{product.description ?? "暂无产品说明"}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有产品" description="先在产品大脑录入产品基础信息。" />
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (dashboardError) {
    return (
      <AppShell activePath="/dashboard" context={context} returnTo="/dashboard">
        <ErrorState
          message={
            dashboardError instanceof Error ? dashboardError.message : "无法加载今日工作台。"
          }
        />
      </AppShell>
    );
  }
}

