import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listWorkspacePlanItems } from "@/lib/data/content-workspace";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { planItemStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/calendar" context={null} contextError={error} returnTo="/calendar">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const planItems = await listWorkspacePlanItems(context.currentWorkspace.id);

    return (
      <AppShell activePath="/calendar" context={context} returnTo="/calendar">
        <section className="page-header">
          <div>
            <h2>内容日历</h2>
            <p className="muted">展示当前 Workspace 下已生成的项目内容计划。</p>
          </div>
          <Link className="button" href="/b-agent">
            找 B组 Agent 生成计划
          </Link>
        </section>

        {planItems.length > 0 ? (
          <section className="calendar-board">
            {planItems.map((item) => (
              <article className="calendar-card" key={item.id}>
                <CalendarDays size={18} aria-hidden="true" />
                <div>
                  <header>
                    <strong>
                      第{item.week}周 · {item.theme}
                    </strong>
                    <StatusBadge label={planItemStatusLabels[item.status]} tone="neutral" />
                  </header>
                  <p>
                    {item.project.name} · {item.channel} · {item.title}
                  </p>
                  <small>{item.deliverable}</small>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="panel">
            <EmptyState
              title="还没有内容计划"
              description="进入 B组 Agent 后，可以基于项目策略生成首月计划。"
            />
          </section>
        )}
      </AppShell>
    );
  } catch (calendarError) {
    return (
      <AppShell activePath="/calendar" context={context} returnTo="/calendar">
        <ErrorState
          message={calendarError instanceof Error ? calendarError.message : "无法加载内容日历。"}
        />
      </AppShell>
    );
  }
}
