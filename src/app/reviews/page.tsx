import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileArchive, RefreshCw, Target, XCircle } from "lucide-react";
import {
  createMissingReviewTasksAction,
  decideReviewTaskAction,
} from "@/app/actions/review-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getWorkspaceReviewQueue } from "@/lib/data/content-workspace";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import {
  contentPackageStatusLabels,
  reviewSubjectTypeLabels,
  reviewTaskStatusLabels,
  strategyStatusLabels,
} from "@/lib/status";

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
      reviewQueue.reviewTasks.length === 0 &&
      reviewQueue.strategyDrafts.length === 0 &&
      reviewQueue.packageReviews.length === 0 &&
      reviewQueue.assetReviews.length === 0 &&
      reviewQueue.factReviews.length === 0;

    return (
      <AppShell activePath="/reviews" context={context} returnTo="/reviews">
        <section className="page-header">
          <div>
            <h2>审核中心</h2>
            <p className="muted">
              当前先承接策略确认和素材包结构审核；未来飞书只作为简单审核入口。
            </p>
          </div>
          <div className="hero-actions">
            <form action={createMissingReviewTasksAction} className="inline-form">
              <button className="button" type="submit">
                <RefreshCw size={16} aria-hidden="true" />
                生成审核任务
              </button>
            </form>
            <Link className="button secondary" href="/b-agent">
              进入 B组 Agent
            </Link>
          </div>
        </section>

        {reviewQueue.reviewTasks.length > 0 ? (
          <section className="panel">
            <div className="section-title-row">
              <h3>待处理审核任务</h3>
              <StatusBadge label={`${reviewQueue.reviewTasks.length} 条`} tone="warning" />
            </div>
            <div className="review-list">
              {reviewQueue.reviewTasks.map((task) => (
                <article className="review-item" key={task.id}>
                  <ClipboardCheck size={18} aria-hidden="true" />
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description ?? "暂无审核说明。"}</p>
                    <small>
                      {reviewSubjectTypeLabels[task.subjectType]} ·{" "}
                      {task.project ? task.project.name : "Workspace 级"} ·{" "}
                      {reviewTaskStatusLabels[task.status]}
                    </small>
                    <form action={decideReviewTaskAction} className="form compact">
                      <input name="taskId" type="hidden" value={task.id} />
                      <label className="form-row">
                        <span className="field-label">审核备注</span>
                        <input
                          name="decisionNote"
                          placeholder="可填写通过依据、修改意见或风险点"
                          type="text"
                        />
                      </label>
                      <div className="hero-actions">
                        <button className="button" name="decision" type="submit" value="APPROVED">
                          <CheckCircle2 size={16} aria-hidden="true" />
                          通过
                        </button>
                        <button
                          className="button secondary"
                          name="decision"
                          type="submit"
                          value="CHANGES_REQUESTED"
                        >
                          <XCircle size={16} aria-hidden="true" />
                          要求修改
                        </button>
                      </div>
                    </form>
                  </div>
                  <StatusBadge label={reviewTaskStatusLabels[task.status]} tone="warning" />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {empty ? (
          <section className="panel">
            <EmptyState
              title="暂无待审核事项"
              description="策略草案、素材包、素材或产品事实需要审核时会出现在这里。"
            />
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

            <div className="panel">
              <div className="section-title-row">
                <h3>素材来源审核</h3>
                <StatusBadge label={`${reviewQueue.assetReviews.length} 条`} tone="warning" />
              </div>
              <div className="review-list">
                {reviewQueue.assetReviews.length > 0 ? (
                  reviewQueue.assetReviews.map((asset) => (
                    <Link className="review-item" href="/assets" key={asset.id}>
                      <ClipboardCheck size={18} aria-hidden="true" />
                      <div>
                        <strong>{asset.name}</strong>
                        <p>
                          {asset.product?.name ?? "未关联产品"} ·{" "}
                          {asset.originalFilename ?? "无原始文件名"}
                        </p>
                      </div>
                      <StatusBadge label="待审核" tone="warning" />
                    </Link>
                  ))
                ) : (
                  <p className="muted">暂无待审核素材。</p>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="section-title-row">
                <h3>产品事实复核</h3>
                <StatusBadge label={`${reviewQueue.factReviews.length} 条`} tone="neutral" />
              </div>
              <div className="review-list">
                {reviewQueue.factReviews.length > 0 ? (
                  reviewQueue.factReviews.map((fact) => (
                    <Link
                      className="review-item"
                      href={`/brain/products/${fact.productId}`}
                      key={fact.id}
                    >
                      <Target size={18} aria-hidden="true" />
                      <div>
                        <strong>{fact.label}</strong>
                        <p>
                          {fact.product.name} · {fact.value}
                        </p>
                      </div>
                      <StatusBadge label="需复核" tone="warning" />
                    </Link>
                  ))
                ) : (
                  <p className="muted">暂无待复核事实。</p>
                )}
              </div>
            </div>
          </section>
        )}

        {reviewQueue.completedReviewTasks.length > 0 ? (
          <section className="panel" style={{ marginTop: 16 }}>
            <div className="section-title-row">
              <h3>最近审核记录</h3>
              <StatusBadge label={`${reviewQueue.completedReviewTasks.length} 条`} tone="success" />
            </div>
            <div className="review-list">
              {reviewQueue.completedReviewTasks.map((task) => (
                <article className="review-item" key={task.id}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.decisionNote ?? task.description ?? "暂无审核备注。"}</p>
                    <small>
                      {reviewSubjectTypeLabels[task.subjectType]} ·{" "}
                      {task.reviewer ? task.reviewer.name : "未记录审核人"}
                    </small>
                  </div>
                  <StatusBadge
                    label={reviewTaskStatusLabels[task.status]}
                    tone={task.status === "APPROVED" ? "success" : "warning"}
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
