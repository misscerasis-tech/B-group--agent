import Link from "next/link";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Download,
  Lightbulb,
  PlusCircle,
} from "lucide-react";
import {
  createMetricsSnapshotAction,
  importMetricsSnapshotsAction,
} from "@/app/actions/recap-actions";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/ui/error-state";
import { getWorkspaceRecapSummary } from "@/lib/data/recaps";
import { loadWorkspaceContextSafe } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function RecapsPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/recaps" context={null} contextError={error} returnTo="/recaps">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const recap = await getWorkspaceRecapSummary(context.currentWorkspace.id);

    return (
      <AppShell activePath="/recaps" context={context} returnTo="/recaps">
        <section className="page-header">
          <div>
            <h2>数据复盘</h2>
            <p className="muted">
              当前先基于系统内数据做运营复盘；外部平台效果数据后续再导入或接 API。
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <Link className="button secondary" href="/recaps/export">
              <Download size={16} aria-hidden="true" />
              导出复盘快照
            </Link>
            <Link className="button" href="/b-agent">
              回到 B组 Agent
            </Link>
          </div>
        </section>

        <section className="grid four">
          <MetricCard label="正式策略" value={recap.metrics.confirmedStrategies} />
          <MetricCard label="内容计划项" value={recap.metrics.planItems} />
          <MetricCard label="已审核素材" value={recap.metrics.approvedAssets} />
          <MetricCard label="待处理提醒" value={recap.metrics.openReminders} />
        </section>

        <section className="grid four" style={{ marginTop: 16 }}>
          <MetricCard label="曝光" value={recap.metrics.impressions} />
          <MetricCard label="点击" value={recap.metrics.clicks} />
          <MetricCard label="转化" value={recap.metrics.conversions} />
          <MetricCard label="花费" value={formatMoney(recap.metrics.spendCents)} />
        </section>

        <section className="grid three" style={{ marginTop: 16 }}>
          <MetricCard label="点击率 CTR" value={formatPercent(recap.metrics.clickRate)} />
          <MetricCard label="点击转化率" value={formatPercent(recap.metrics.conversionRate)} />
          <MetricCard
            label="单次转化成本"
            value={formatMoney(recap.metrics.costPerConversionCents)}
          />
        </section>

        <section className="grid four" style={{ marginTop: 16 }}>
          <MetricCard label="指标快照" value={recap.metrics.metricSnapshots} />
          <MetricCard label="素材包草稿" value={recap.metrics.draftPackages} />
          <MetricCard label="已应用指令" value={recap.metrics.appliedOperations} />
          <MetricCard label="待确认指令" value={recap.metrics.pendingOperations} />
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3>
              <PlusCircle size={18} aria-hidden="true" />
              录入渠道表现
            </h3>
            <form action={createMetricsSnapshotAction} className="form">
              <label className="form-row">
                <span className="field-label">项目</span>
                <select name="projectId" required>
                  {recap.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">周期</span>
                <input name="period" placeholder="例如：2026-07 第3周" required />
              </label>
              <label className="form-row">
                <span className="field-label">渠道</span>
                <input name="channel" placeholder="例如：TikTok" required />
              </label>
              <div className="grid two">
                <label className="form-row">
                  <span className="field-label">曝光</span>
                  <input min="0" name="impressions" required type="number" />
                </label>
                <label className="form-row">
                  <span className="field-label">点击</span>
                  <input min="0" name="clicks" required type="number" />
                </label>
                <label className="form-row">
                  <span className="field-label">转化</span>
                  <input min="0" name="conversions" required type="number" />
                </label>
                <label className="form-row">
                  <span className="field-label">花费（元）</span>
                  <input min="0" name="spend" required step="0.01" type="number" />
                </label>
              </div>
              <label className="form-row">
                <span className="field-label">备注</span>
                <textarea name="notes" placeholder="可记录素材包、活动、异常表现或下一步判断" />
              </label>
              <button className="button" type="submit">
                保存指标快照
              </button>
            </form>

            <div style={{ borderTop: "1px solid var(--line)", margin: "18px 0" }} />

            <h3>
              <PlusCircle size={18} aria-hidden="true" />
              批量导入指标
            </h3>
            <form action={importMetricsSnapshotsAction} className="form">
              <label className="form-row">
                <span className="field-label">项目</span>
                <select name="projectId" required>
                  {recap.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">表格文本</span>
                <textarea
                  name="rows"
                  placeholder={[
                    "周期,渠道,曝光,点击,转化,花费,备注",
                    "2026-07 第3周,TikTok,10000,600,24,1234.56,首轮数据",
                    "2026-07 第4周,Instagram,8000,240,8,560,素材包 A",
                  ].join("\n")}
                  required
                />
              </label>
              <button className="button secondary" type="submit">
                导入多条指标
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>
              <Lightbulb size={18} aria-hidden="true" />
              下一步建议
            </h3>
            <div className="card-list">
              {recap.suggestions.map((suggestion) => (
                <article className="item-card" key={suggestion}>
                  <p>{suggestion}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3>
              <ChartNoAxesCombined size={18} aria-hidden="true" />
              近期表现数据
            </h3>
            {recap.recentMetrics.length > 0 ? (
              <div className="change-log-list">
                {recap.recentMetrics.map((metric) => (
                  <article className="change-log-item" key={metric.id}>
                    <ChartNoAxesCombined size={16} aria-hidden="true" />
                    <div>
                      <strong>
                        {metric.project.name} · {metric.channel}
                      </strong>
                      <p>
                        {metric.period} · 曝光 {metric.impressions} · 点击 {metric.clicks} · 转化{" "}
                        {metric.conversions} · 花费 {formatMoney(metric.spendCents)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="state-box">
                <h2>暂无表现数据</h2>
                <p>先录入一个渠道周期数据，复盘建议会开始结合表现指标。</p>
              </div>
            )}
          </div>

          <div className="panel">
            <h3>
              <ClipboardCheck size={18} aria-hidden="true" />
              最近变更
            </h3>
            {recap.recentChangeLogs.length > 0 ? (
              <div className="change-log-list">
                {recap.recentChangeLogs.map((log) => (
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
              <div className="state-box">
                <h2>暂无变更</h2>
                <p>执行中文指令、确认策略、生成计划或上传素材后会进入复盘。</p>
              </div>
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (recapsError) {
    return (
      <AppShell activePath="/recaps" context={context} returnTo="/recaps">
        <ErrorState
          message={recapsError instanceof Error ? recapsError.message : "无法加载数据复盘。"}
        />
      </AppShell>
    );
  }
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <ChartNoAxesCombined size={18} aria-hidden="true" />
    </div>
  );
}

function formatMoney(spendCents: number) {
  return `¥${(spendCents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
