import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileArchive,
  FileText,
  Layers,
  MessageSquareText,
  PencilLine,
  Target,
  XCircle,
} from "lucide-react";
import {
  applyPendingAgentOperationAction,
  confirmProjectStrategyAction,
  generateStarterPlanAction,
  rejectPendingAgentOperationAction,
  resolveBAgentReminderAction,
  submitAgentCommandAction,
} from "@/app/actions/agent-actions";
import { submitContentPackageForReviewAction } from "@/app/actions/package-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { agentCommandCapabilities } from "@/lib/agent/capabilities";
import { getAssistantState } from "@/lib/data/assistant";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import {
  agentOperationStatusLabels,
  contentFrequencyLabels,
  contentPackageStatusLabels,
  packageFileStatusLabels,
  planItemStatusLabels,
  productFactStatusLabels,
  projectStatusLabels,
  reminderSeverityLabels,
  strategyStatusLabels,
} from "@/lib/status";

export const dynamic = "force-dynamic";

const quickAgentCommands = [
  {
    label: "推荐策略",
    command: "请根据产品事实推荐一版巴西首月增长策略。",
  },
  {
    label: "生成首月计划",
    command: "请生成首月计划和第一份素材包结构。",
  },
  {
    label: "项目体检提醒",
    command: "把项目体检缺口生成提醒。",
  },
  {
    label: "日历缺口提醒",
    command: "把内容日历缺口生成提醒。",
  },
  {
    label: "补齐审核任务",
    command: "补齐当前项目审核中心任务。",
  },
  {
    label: "素材包缺口提醒",
    command: "把最新素材包可交付性缺口生成提醒。",
  },
];

type BAgentPageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

export default async function BAgentPage({ searchParams }: BAgentPageProps) {
  const { projectId } = await searchParams;
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/b-agent" context={null} contextError={error} returnTo="/b-agent">
        <section className="page-header">
          <div>
            <h2>B组 Agent 工作台</h2>
            <p className="muted">
              当前页面已升级为数据库驱动。启动 PostgreSQL、运行 migration 和 seed 后即可保存真实项目数据。
            </p>
          </div>
        </section>
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const state = await getAssistantState(context.currentWorkspace.id, projectId);
    const selectedProject = state.selectedProject;

    return (
      <AppShell
        activePath="/b-agent"
        context={context}
        returnTo={selectedProject ? `/b-agent?projectId=${selectedProject.id}` : "/b-agent"}
      >
        <section className="page-header">
          <div>
            <p className="eyebrow">B组 · AI 内容增长 Agent</p>
            <h2>中文对话驱动的项目增长工作台</h2>
            <p className="muted">
              左侧输入中文需求，右侧沉淀产品事实、策略、首月计划、素材包、提醒和变更日志。
            </p>
          </div>

          {state.projects.length > 0 ? (
            <div className="hero-actions">
              {selectedProject ? (
                <Link className="button secondary" href={`/projects/${selectedProject.id}/export`}>
                  <Download size={16} aria-hidden="true" />
                  导出快照
                </Link>
              ) : null}
              <form action="/b-agent" className="project-switcher">
                <label className="field-label compact" htmlFor="projectId">
                  当前项目
                </label>
                <select defaultValue={selectedProject?.id} id="projectId" name="projectId">
                  {state.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button className="button secondary" type="submit">
                  切换
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {!selectedProject ? (
          <section className="panel">
            <EmptyState
              title="还没有可工作的项目"
              description="先到项目中心创建项目并关联产品，B 组 Agent 才能开始保存事实、策略和计划。"
            />
            <div className="hero-actions">
              <Link className="button" href="/projects">
                创建项目
              </Link>
              <Link className="button secondary" href="/brain">
                创建产品
              </Link>
            </div>
          </section>
        ) : (
          <section className="agent-demo-shell working" aria-label="B组 Agent 工作台">
            <aside className="conversation-pane">
              <div className="pane-heading">
                <MessageSquareText size={20} aria-hidden="true" />
                <div>
                  <h3>AI 顾问对话</h3>
                  <p>本阶段使用本地规则型 Agent，后续可替换真实 GPT。</p>
                </div>
              </div>

              <div className="project-mini-card">
                <strong>{selectedProject.name}</strong>
                <StatusBadge
                  label={projectStatusLabels[selectedProject.status]}
                  tone={selectedProject.status === "ACTIVE" ? "success" : "neutral"}
                />
                <p>{selectedProject.description ?? "暂无项目说明"}</p>
              </div>

              <div className="chat-thread">
                {(state.conversation?.messages ?? []).length > 0 ? (
                  state.conversation?.messages.map((message) => (
                    <div
                      className={`chat-bubble ${message.role === "USER" ? "user" : "agent"}`}
                      key={message.id}
                    >
                      <span>{message.role === "USER" ? "用户" : "B组 Agent"}</span>
                      <p>{message.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="chat-bubble agent">
                    <span>B组 Agent</span>
                    <p>
                      请用中文告诉我市场、渠道、生成频率或内容方向。我会先做结构化解析，再写入当前项目。
                    </p>
                  </div>
                )}
              </div>

              <form action={submitAgentCommandAction} className="assistant-command-form">
                <input name="projectId" type="hidden" value={selectedProject.id} />
                <label className="form-row">
                  <span className="field-label">给 B 组 Agent 的中文指令</span>
                  <textarea
                    name="command"
                    placeholder="例如：记录 2026-07 第3周 TikTok 曝光10000 点击600 转化24 花费1234.56 元。"
                    required
                  />
                </label>
                <button className="button" type="submit">
                  执行中文指令
                </button>
              </form>

              <div className="nl-command-box">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>常用流程按钮</strong>
                  <p>点击后会直接写入当前项目，所有结果仍会进入操作记录和变更日志。</p>
                  <div className="hero-actions">
                    {quickAgentCommands.map((item) => (
                      <form
                        action={submitAgentCommandAction}
                        className="inline-form"
                        key={item.command}
                      >
                        <input name="projectId" type="hidden" value={selectedProject.id} />
                        <input name="command" type="hidden" value={item.command} />
                        <button className="button secondary" title={item.command} type="submit">
                          {item.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>

              <div className="nl-command-box">
                <PencilLine size={18} aria-hidden="true" />
                <div>
                  <strong>当前可执行的本地指令</strong>
                  <ul>
                    {agentCommandCapabilities.map((capability) => (
                      <li key={capability.key}>
                        {capability.title}：{capability.example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>

            <section className="workbench-pane">
              <div className="pane-heading">
                <Target size={20} aria-hidden="true" />
                <div>
                  <h3>结构化项目工作台</h3>
                  <p>所有核心数据保存在独立 Web 系统，并带 Workspace 隔离。</p>
                </div>
              </div>

              <section className="workbench-grid">
                <div className="workbench-section facts">
                  <div className="section-title-row">
                    <h3>1. 产品事实</h3>
                    <StatusBadge
                      label={state.productFacts.length > 0 ? "已读取" : "待录入"}
                      tone={state.productFacts.length > 0 ? "success" : "warning"}
                    />
                  </div>
                  {state.linkedProducts.length > 0 ? (
                    <div className="fact-groups">
                      {state.linkedProducts.map((product) => {
                        const facts = state.productFacts.filter(
                          (fact) => fact.productId === product.id,
                        );

                        return (
                          <article className="fact-group" key={product.id}>
                            <header>
                              <strong>{product.name}</strong>
                              <Link href={`/brain/products/${product.id}`}>编辑产品</Link>
                            </header>
                            {facts.length > 0 ? (
                              <dl className="fact-list">
                                {facts.map((fact) => (
                                  <div key={fact.id}>
                                    <dt>{fact.label}</dt>
                                    <dd>
                                      {fact.value}
                                      <small>
                                        {productFactStatusLabels[fact.status]} · 置信度{" "}
                                        {fact.confidence}%
                                      </small>
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              <p className="muted">这个产品还没有结构化事实。</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="未关联产品" description="先在项目详情中关联产品。" />
                  )}
                </div>

                <div className="workbench-section strategy">
                  <div className="section-title-row">
                    <h3>2. 市场与内容策略</h3>
                    {state.strategy ? (
                      <StatusBadge
                        label={strategyStatusLabels[state.strategy.status]}
                        tone={state.strategy.status === "CONFIRMED" ? "success" : "warning"}
                      />
                    ) : (
                      <StatusBadge label="待生成" tone="warning" />
                    )}
                  </div>

                  {state.strategy ? (
                    <>
                      <div className="strategy-grid">
                        <StrategyField label="推荐市场" values={state.strategy.targetMarkets} />
                        <StrategyField label="核心客群" values={state.strategy.audiences} />
                        <StrategyField label="平台渠道" values={state.strategy.channels} />
                        <StrategyField label="内容方向" values={state.strategy.contentDirections} />
                        <article className="strategy-row">
                          <strong>素材包频率</strong>
                          <span>{contentFrequencyLabels[state.strategy.packageFrequency]}</span>
                          <p>{state.strategy.rationale ?? "暂无策略依据。"}</p>
                        </article>
                        <article className="strategy-row">
                          <strong>定位说明</strong>
                          <span>{state.strategy.positioning ?? "待补充"}</span>
                          <p>确认后成为正式策略；正式策略后续变更需要二次确认。</p>
                        </article>
                      </div>

                      {state.strategyHistory.length > 1 ? (
                        <div className="operation-list">
                          <h4>策略版本历史</h4>
                          {state.strategyHistory.map((strategyVersion) => (
                            <article className="operation-item" key={strategyVersion.id}>
                              <header>
                                <strong>v{strategyVersion.version}</strong>
                                <StatusBadge
                                  label={strategyStatusLabels[strategyVersion.status]}
                                  tone={
                                    strategyVersion.status === "CONFIRMED"
                                      ? "success"
                                      : "warning"
                                  }
                                />
                              </header>
                              <p>
                                {strategyVersion.targetMarkets.join("、") || "待补充市场"} ·{" "}
                                {strategyVersion.channels.join(" + ") || "待补充渠道"} ·{" "}
                                {contentFrequencyLabels[strategyVersion.packageFrequency]}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {state.strategy.status === "DRAFT" ? (
                        <form action={confirmProjectStrategyAction} className="inline-form">
                          <input name="projectId" type="hidden" value={selectedProject.id} />
                          <input name="strategyId" type="hidden" value={state.strategy.id} />
                          <button className="button" type="submit">
                            确认正式策略
                          </button>
                        </form>
                      ) : null}
                    </>
                  ) : (
                    <EmptyState
                      title="还没有策略草案"
                      description="在左侧输入中文指令后，系统会自动创建策略草案。"
                    />
                  )}
                </div>

                <div className="workbench-section approval">
                  <div className="section-title-row">
                    <h3>3. 待确认操作</h3>
                    <StatusBadge
                      label={`${state.recentOperations.filter((item) => item.status === "PENDING_CONFIRMATION").length} 条待确认`}
                      tone={
                        state.recentOperations.some(
                          (item) => item.status === "PENDING_CONFIRMATION",
                        )
                          ? "warning"
                          : "neutral"
                      }
                    />
                  </div>
                  <div className="operation-list">
                    {state.recentOperations.length > 0 ? (
                      state.recentOperations.map((operation) => (
                        <article className="operation-item" key={operation.id}>
                          <header>
                            <strong>{operation.summary}</strong>
                            <StatusBadge
                              label={agentOperationStatusLabels[operation.status]}
                              tone={
                                operation.status === "APPLIED"
                                  ? "success"
                                  : operation.status === "PENDING_CONFIRMATION"
                                    ? "warning"
                                    : "neutral"
                              }
                            />
                          </header>
                          <p>{operation.conflictCheck ?? operation.rawText}</p>
                          {operation.status === "PENDING_CONFIRMATION" ? (
                            <div className="hero-actions">
                              <form
                                action={applyPendingAgentOperationAction}
                                className="inline-form"
                              >
                                <input name="operationId" type="hidden" value={operation.id} />
                                <input name="projectId" type="hidden" value={selectedProject.id} />
                                <button className="button" type="submit">
                                  确认并应用
                                </button>
                              </form>
                              <form
                                action={rejectPendingAgentOperationAction}
                                className="inline-form"
                              >
                                <input name="operationId" type="hidden" value={operation.id} />
                                <input name="projectId" type="hidden" value={selectedProject.id} />
                                <button className="button secondary" type="submit">
                                  拒绝变更
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <EmptyState title="暂无操作记录" description="提交中文指令后会在这里留下记录。" />
                    )}
                  </div>
                </div>

                <div className="workbench-section plan">
                  <div className="section-title-row">
                    <h3>4. 首月计划</h3>
                    <StatusBadge
                      label={state.planItems.length > 0 ? "已生成" : "待生成"}
                      tone={state.planItems.length > 0 ? "success" : "warning"}
                    />
                  </div>
                  {state.planItems.length > 0 ? (
                    <div className="month-plan">
                      {state.planItems.map((item) => (
                        <article className="plan-row" key={item.id}>
                          <CalendarDays size={18} aria-hidden="true" />
                          <div>
                            <strong>
                              第{item.week}周 · {item.theme}
                            </strong>
                            <p>
                              {item.channel} · {item.title} · {item.deliverable}
                            </p>
                            <small>
                              {planItemStatusLabels[item.status]}
                              {item.dueDate ? ` · 截止：${formatShortDate(item.dueDate)}` : ""}
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <form action={generateStarterPlanAction} className="form">
                      <input name="projectId" type="hidden" value={selectedProject.id} />
                      <p className="muted">可基于当前策略生成首月计划和第一份素材包结构。</p>
                      <button className="button" type="submit">
                        生成首月计划
                      </button>
                    </form>
                  )}
                </div>

                <div className="workbench-section package">
                  <div className="section-title-row">
                    <h3>5. 素材包预览</h3>
                    <StatusBadge
                      label={state.contentPackages[0] ? "结构已保存" : "待生成"}
                      tone={state.contentPackages[0] ? "success" : "warning"}
                    />
                  </div>
                  {state.contentPackages[0] ? (
                    <>
                      <div className="package-summary">
                        <FileArchive size={20} aria-hidden="true" />
                        <div>
                          <strong>{state.contentPackages[0].name}</strong>
                          <p>
                            {state.contentPackages[0].period} ·{" "}
                            {contentFrequencyLabels[state.contentPackages[0].frequency]} ·{" "}
                            {contentPackageStatusLabels[state.contentPackages[0].status]}
                          </p>
                        </div>
                      </div>
                      <div className="pack-grid">
                        {state.contentPackages[0].files.map((file) => (
                          <div className="pack-file" key={file.id}>
                            <FileText size={18} aria-hidden="true" />
                            <span>
                              {file.name}
                              <small>{packageFileStatusLabels[file.status]}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="download-preview">
                        <Download size={18} aria-hidden="true" />
                        <span>当前可下载基础 PDF/XLSX/DOCX/TXT/ZIP 交付包，正式精排和平台规格继续迭代。</span>
                        {state.contentPackages[0].status !== "APPROVED" ? (
                          <form
                            action={submitContentPackageForReviewAction}
                            className="inline-form"
                          >
                            <input
                              name="contentPackageId"
                              type="hidden"
                              value={state.contentPackages[0].id}
                            />
                            <input
                              name="returnTo"
                              type="hidden"
                              value={`/b-agent?projectId=${selectedProject.id}`}
                            />
                            <button className="button" type="submit">
                              提交审核
                            </button>
                          </form>
                        ) : null}
                        <Link
                          className="button secondary"
                          href={`/packages/${state.contentPackages[0].id}/export`}
                        >
                          下载素材包
                        </Link>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="暂无素材包" description="生成首月计划后会创建素材包结构。" />
                  )}
                </div>

                <div className="workbench-section risks">
                  <div className="section-title-row">
                    <h3>6. 主动提醒</h3>
                    <StatusBadge
                      label={`${state.reminders.length} 条`}
                      tone={state.reminders.length > 0 ? "warning" : "neutral"}
                    />
                  </div>
                  {state.reminders.length > 0 ? (
                    <div className="reminder-list">
                      {state.reminders.map((reminder) => (
                        <article className="reminder-item" key={reminder.id}>
                          <AlertTriangle size={18} aria-hidden="true" />
                          <div>
                            <strong>
                              {reminder.title} · {reminderSeverityLabels[reminder.severity]}
                            </strong>
                            <p>{reminder.description ?? "暂无说明"}</p>
                            {reminder.dueAt ? (
                              <small>截止：{formatShortDate(reminder.dueAt)}</small>
                            ) : null}
                            <form action={resolveBAgentReminderAction} className="inline-form">
                              <input name="reminderId" type="hidden" value={reminder.id} />
                              <input name="projectId" type="hidden" value={selectedProject.id} />
                              <button
                                className="button secondary"
                                name="status"
                                type="submit"
                                value="DONE"
                              >
                                <CheckCircle2 size={16} aria-hidden="true" />
                                完成
                              </button>
                              <button
                                className="button secondary"
                                name="status"
                                type="submit"
                                value="DISMISSED"
                              >
                                <XCircle size={16} aria-hidden="true" />
                                忽略
                              </button>
                            </form>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无提醒" description="后续会基于时间、状态和风险主动生成提醒。" />
                  )}
                </div>

                <div className="workbench-section change-log">
                  <div className="section-title-row">
                    <h3>7. 变更日志</h3>
                    <ClipboardCheck size={18} aria-hidden="true" />
                  </div>
                  {state.changeLogs.length > 0 ? (
                    <div className="change-log-list">
                      {state.changeLogs.map((log) => (
                        <article className="change-log-item" key={log.id}>
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <div>
                            <strong>{log.summary}</strong>
                            <p>
                              {log.action} · {formatDate(log.createdAt)}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无变更日志" description="确认策略或执行指令后会自动记录。" />
                  )}
                </div>

                <div className="workbench-section visual-policy">
                  <div className="section-title-row">
                    <h3>8. 图片与海报原则</h3>
                    <Layers size={18} aria-hidden="true" />
                  </div>
                  <ul className="clean-list">
                    <li>V1 使用真实产品图和官方 Logo 做模板化合成。</li>
                    <li>产品层和 Logo 层必须引用已审核 Asset，禁止 AI 静默替换。</li>
                    <li>AI 图片供应商以后按 Workspace 配置，当前不绑定任何模型。</li>
                    <li>海报层级预留：背景层、产品层、文字层、Logo 层、装饰层。</li>
                  </ul>
                </div>
              </section>
            </section>
          </section>
        )}
      </AppShell>
    );
  } catch (assistantError) {
    return (
      <AppShell activePath="/b-agent" context={context} contextError={error} returnTo="/b-agent">
        <ErrorState
          message={assistantError instanceof Error ? assistantError.message : "无法加载 B 组 Agent。"}
        />
      </AppShell>
    );
  }
}

function StrategyField({ label, values }: { label: string; values: string[] }) {
  return (
    <article className="strategy-row">
      <strong>{label}</strong>
      <span>{values.length > 0 ? values.join(" + ") : "待补充"}</span>
      <p>{values.length > 0 ? "已进入结构化策略，可被中文指令继续调整。" : "等待输入。"}</p>
    </article>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
