import Link from "next/link";
import { ClipboardCheck, FileArchive, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getWorkspaceReviewQueue } from "@/lib/data/content-workspace";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { contentPackageStatusLabels, strategyStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/reviews" context={null} contextError={error} returnTo="/reviews">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const reviewQueue = await getWorkspaceReviewQueue(context.currentWorkspace.id);
    const empty =
      reviewQueue.strategyDrafts.length === 0 && reviewQueue.packageReviews.length === 0;

    return (
      <AppShell activePath="/reviews" context={context} returnTo="/reviews">
        <section className="page-header">
          <div>
            <h2>审核中心</h2>
            <p className="muted">
              当前先承接策略确认和素材包结构审核；未来飞书只作为简单审核入口。
            </p>
          </div>
          <Link className="button" href="/b-agent">
            进入 B组 Agent
          </Link>
        </section>

        {empty ? (
          <section className="panel">
            <EmptyState title="暂无待审核事项" description="策略草案或素材包生成后会出现在这里。" />
          </section>
        ) : (
          <section className="review-board">
            <div className="panel">
              <div className="section-title-row">
                <h3>策略草案</h3>
                <StatusBadge label={`${reviewQueue.strategyDrafts.length} 条`} tone="warning" />
              </div>
              <div className="review-list">
                {reviewQueue.strategyDrafts.map((strategy) => (
                  <Link
                    className="review-item"
                    href={`/b-agent?projectId=${strategy.projectId}`}
                    key={strategy.id}
                  >
                    <Target size={18} aria-hidden="true" />
                    <div>
                      <strong>{strategy.project.name}</strong>
                      <p>
                        {strategy.targetMarkets.join("、") || "待补充市场"} ·{" "}
                        {strategy.channels.join(" + ") || "待补充渠道"}
                      </p>
                    </div>
                    <StatusBadge label={strategyStatusLabels[strategy.status]} tone="warning" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="section-title-row">
                <h3>素材包审核</h3>
                <StatusBadge label={`${reviewQueue.packageReviews.length} 条`} tone="neutral" />
              </div>
              <div className="review-list">
                {reviewQueue.packageReviews.map((contentPackage) => (
                  <Link
                    className="review-item"
                    href={`/b-agent?projectId=${contentPackage.projectId}`}
                    key={contentPackage.id}
                  >
                    <FileArchive size={18} aria-hidden="true" />
                    <div>
                      <strong>{contentPackage.name}</strong>
                      <p>
                        {contentPackage.project.name} · {contentPackage.files.length} 个文件项
                      </p>
                    </div>
                    <StatusBadge
                      label={contentPackageStatusLabels[contentPackage.status]}
                      tone={contentPackage.status === "REVIEW_NEEDED" ? "warning" : "neutral"}
                    />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="demo-footer-panel" style={{ marginTop: 16 }}>
          <ClipboardCheck size={20} aria-hidden="true" />
          <p>正式发布前必须经过产品素材来源检查、Logo 检查、产品名称和参数检查、人工审核。</p>
        </section>
      </AppShell>
    );
  } catch (reviewsError) {
    return (
      <AppShell activePath="/reviews" context={context} returnTo="/reviews">
        <ErrorState
          message={reviewsError instanceof Error ? reviewsError.message : "无法加载审核中心。"}
        />
      </AppShell>
    );
  }
}
