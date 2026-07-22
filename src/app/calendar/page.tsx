import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardCheck, PlayCircle } from "lucide-react";
import { updateContentPlanItemStatusAction } from "@/app/actions/calendar-actions";
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
                    <StatusBadge
                      label={planItemStatusLabels[item.status]}
                      tone={planStatusTone(item.status)}
                    />
                  </header>
                  <p>
                    {item.project.name} · {item.channel} · {item.title}
                  </p>
                  <small>
                    {item.deliverable}
                    {item.dueDate ? ` · 截止：${formatDate(item.dueDate)}` : ""}
                  </small>
                  <form action={updateContentPlanItemStatusAction} className="inline-form">
                    <input name="planItemId" type="hidden" value={item.id} />
                    {item.status !== "READY" ? (
                      <button className="button secondary" name="status" type="submit" value="READY">
                        <PlayCircle size={16} aria-hidden="true" />
                        设为可执行
                      </button>
                    ) : null}
                    {item.status !== "REVIEW_NEEDED" ? (
                      <button
                        className="button secondary"
                        name="status"
                        type="submit"
                        value="REVIEW_NEEDED"
                      >
                        <ClipboardCheck size={16} aria-hidden="true" />
                        需审核
                      </button>
                    ) : null}
                    {item.status !== "DONE" ? (
                      <button className="button" name="status" type="submit" value="DONE">
                        <CheckCircle2 size={16} aria-hidden="true" />
                        标记完成
                      </button>
                    ) : null}
                  </form>
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function planStatusTone(
  status: "DRAFT" | "READY" | "REVIEW_NEEDED" | "DONE",
): "neutral" | "success" | "warning" {
  if (status === "DONE") {
    return "success";
  }

  if (status === "REVIEW_NEEDED") {
    return "warning";
  }

  return "neutral";
}
