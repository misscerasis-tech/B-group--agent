import Link from "next/link";
import { ChartNoAxesCombined, ClipboardCheck, Lightbulb } from "lucide-react";
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
          <Link className="button" href="/b-agent">
            回到 B组 Agent
          </Link>
        </section>

        <section className="grid four">
          <MetricCard label="正式策略" value={recap.metrics.confirmedStrategies} />
          <MetricCard label="内容计划项" value={recap.metrics.planItems} />
          <MetricCard label="已审核素材" value={recap.metrics.approvedAssets} />
          <MetricCard label="待处理提醒" value={recap.metrics.openReminders} />
        </section>

        <section className="grid four" style={{ marginTop: 16 }}>
          <MetricCard label="策略草案" value={recap.metrics.draftStrategies} />
          <MetricCard label="素材包草稿" value={recap.metrics.draftPackages} />
          <MetricCard label="已应用指令" value={recap.metrics.appliedOperations} />
          <MetricCard label="待确认指令" value={recap.metrics.pendingOperations} />
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <ChartNoAxesCombined size={18} aria-hidden="true" />
    </div>
  );
}
