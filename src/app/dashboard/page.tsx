import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardSummary } from "@/lib/data/dashboard";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { productStatusLabels, projectStatusLabels, reminderSeverityLabels } from "@/lib/status";

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
              当前 Workspace：{context.currentWorkspace.name}。每天从项目、计划、素材包和提醒开始。
            </p>
          </div>
          <Link className="button" href="/b-agent">
            打开 B组 Agent
          </Link>
        </section>

        <section className="grid four">
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
          <div className="panel stat">
            <span className="muted">待处理提醒</span>
            <strong>{summary.openReminderCount}</strong>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel stat">
            <span className="muted">内容计划项</span>
            <strong>{summary.planItemCount}</strong>
          </div>
          <div className="panel stat">
            <span className="muted">素材包结构</span>
            <strong>{summary.contentPackageCount}</strong>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <h3>今日行动队列</h3>
          <div className="card-list">
            {summary.actionItems.map((item) => (
              <Link className="item-card" href={item.href} key={item.id}>
                <header>
                  <h4>{item.title}</h4>
                  <StatusBadge
                    label={actionPriorityLabels[item.priority]}
                    tone={item.priority === "high" ? "warning" : "neutral"}
                  />
                </header>
                <p>{item.description}</p>
                <small className="muted" style={{ alignItems: "center", display: "inline-flex", gap: 6 }}>
                  去处理
                  <ArrowRight size={14} aria-hidden="true" />
                </small>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <h3>项目就绪度</h3>
          {summary.projectHealthSummaries.length > 0 ? (
            <div className="card-list">
              {summary.projectHealthSummaries.map((health) => (
                <article className="item-card" key={health.projectId}>
                  <header>
                    <h4>{health.projectName}</h4>
                    <StatusBadge
                      label={projectHealthRatingLabels[health.rating]}
                      tone={health.rating === "READY" ? "success" : "warning"}
                    />
                  </header>
                  <div
                    aria-label={`${health.projectName} 就绪度 ${health.score} 分`}
                    style={{
                      background: "#eef2f7",
                      borderRadius: 999,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: health.rating === "READY" ? "#1f9d72" : "#f2a900",
                        height: "100%",
                        width: `${health.score}%`,
                      }}
                    />
                  </div>
                  <p>{health.summary}</p>
                  {health.nextActions.length > 0 ? (
                    <div className="hero-actions" style={{ marginTop: 0 }}>
                      {health.nextActions.map((action) => (
                        <Link className="button secondary" href={action.href} key={action.key}>
                          {action.action}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link className="button secondary" href={`/b-agent?projectId=${health.projectId}`}>
                      进入项目工作台
                    </Link>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="还没有项目" description="创建项目后，这里会显示项目就绪度和下一步动作。" />
          )}
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

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3>今日提醒</h3>
            {summary.openReminders.length > 0 ? (
              <div className="reminder-list">
                {summary.openReminders.map((reminder) => (
                  <article className="reminder-item" key={reminder.id}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        {reminder.title} · {reminderSeverityLabels[reminder.severity]}
                      </strong>
                      <p>
                        {reminder.project?.name ?? "Workspace"} ·{" "}
                        {reminder.description ?? "暂无提醒说明。"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无提醒" description="生成计划或素材包后，这里会出现需要处理的事项。" />
            )}
          </div>

          <div className="panel">
            <h3>最近变更</h3>
            {summary.recentChangeLogs.length > 0 ? (
              <div className="change-log-list">
                {summary.recentChangeLogs.map((log) => (
                  <article className="change-log-item" key={log.id}>
                    <ClipboardCheck size={16} aria-hidden="true" />
                    <div>
                      <strong>{log.summary}</strong>
                      <p>{log.action}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无变更" description="执行中文指令或确认策略后会自动记录。" />
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

const actionPriorityLabels = {
  high: "优先处理",
  medium: "需要推进",
  low: "可安排",
};

const projectHealthRatingLabels = {
  READY: "可进入执行",
  NEEDS_ATTENTION: "需要补齐",
  BLOCKED: "存在阻塞",
};
