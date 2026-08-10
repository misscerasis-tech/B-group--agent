import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileArchive,
  FileText,
  ImageIcon,
  Layers,
  MessageSquareText,
  PencilLine,
  Target,
  XCircle,
} from "lucide-react";
import {
  applyPendingAgentOperationAction,
  cancelBAgentReviewTaskAction,
  confirmProjectStrategyAction,
  decideBAgentReviewTaskAction,
  generateStarterPlanAction,
  rejectPendingAgentOperationAction,
  resolveBAgentReminderAction,
  submitAgentCommandAction,
} from "@/app/actions/agent-actions";
import { submitContentPackageForReviewAction } from "@/app/actions/package-actions";
import { kickoffProjectFromBriefAction } from "@/app/actions/project-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { agentCommandCapabilities } from "@/lib/agent/capabilities";
import { buildContentPackageReadiness } from "@/lib/content-package-readiness";
import { getAssistantState } from "@/lib/data/assistant";
import { getProjectHealthSummary } from "@/lib/data/project-health";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import {
  agentOperationStatusLabels,
  assetKindLabels,
  assetStatusLabels,
  contentFrequencyLabels,
  contentPackageStatusLabels,
  packageFileStatusLabels,
  planItemStatusLabels,
  productFactStatusLabels,
  projectStatusLabels,
  reminderSeverityLabels,
  reviewSubjectTypeLabels,
  reviewTaskStatusLabels,
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

const contentPackageReadinessLabels = {
  READY_TO_EXPORT: "可下载复核",
  NEEDS_WORK: "需要完善",
  BLOCKED: "存在阻塞",
};

const projectHealthRatingLabels = {
  READY: "可进入执行",
  NEEDS_ATTENTION: "需要补齐",
  BLOCKED: "存在阻塞",
};

const projectHealthSignalLabels = {
  complete: "已完成",
  warning: "需处理",
  missing: "缺失",
};

type BAgentPageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

export default async function BAgentPage({ searchParams }: BAgentPageProps) {
  const { projectId } = await searchParams;
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return <OfflineBAgentWorkbench reason={error ?? "无法加载演示 Workspace。"} />;
  }

  try {
    const state = await getAssistantState(context.currentWorkspace.id, projectId);
    const selectedProject = state.selectedProject;
    const projectHealth = selectedProject
      ? await getProjectHealthSummary(context.currentWorkspace.id, selectedProject.id)
      : null;
    const latestContentPackage = state.contentPackages[0] ?? null;
    const latestPackageReadiness = latestContentPackage
      ? buildContentPackageReadiness({
          ...latestContentPackage,
          sourceAssets: state.assets,
        })
      : null;

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
          <section className="grid two">
            <div className="panel">
              <EmptyState
                title="还没有可工作的项目"
                description="可以直接用中文 Brief 启动第一个项目，系统会同步创建项目、产品、待确认事实和策略草案。"
              />
              <div className="hero-actions">
                <Link className="button secondary" href="/projects">
                  项目中心
                </Link>
                <Link className="button secondary" href="/brain">
                  产品大脑
                </Link>
              </div>
            </div>

            <div className="panel">
              <h3>从中文 Brief 启动 B 组项目</h3>
              <form action={kickoffProjectFromBriefAction} className="form">
                <label className="form-row">
                  <span className="field-label">项目名称</span>
                  <input name="projectName" placeholder="例如：巴西新品首月内容增长" required />
                </label>
                <label className="form-row">
                  <span className="field-label">产品名称</span>
                  <input name="productName" placeholder="例如：Aurora Cup 智能保温杯" required />
                </label>
                <label className="form-row">
                  <span className="field-label">中文启动 Brief</span>
                  <textarea
                    name="brief"
                    placeholder="例如：这是一款 600ml 不锈钢保温杯，24 小时保温，主推巴西市场，新增 TikTok 和 Instagram，每周生成一次素材包。"
                    required
                  />
                </label>
                <button className="button" type="submit">
                  创建并进入工作台
                </button>
              </form>
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
                      <p style={{ whiteSpace: "pre-line" }}>{message.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="chat-bubble agent">
                    <span>B组 Agent</span>
                    <p style={{ whiteSpace: "pre-line" }}>
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
                <PencilLine size={18} aria-hidden="true" />
                <div>
                  <strong>启动新项目</strong>
                  <p>用中文 Brief 创建下一条增长工作线，提交后会自动切换到新项目。</p>
                  <form action={kickoffProjectFromBriefAction} className="form compact">
                    <label className="form-row">
                      <span className="field-label">项目名称</span>
                      <input name="projectName" placeholder="例如：日本母婴礼赠内容增长" required />
                    </label>
                    <label className="form-row">
                      <span className="field-label">产品名称</span>
                      <input name="productName" placeholder="例如：Aurora Cup 迷你保温杯" required />
                    </label>
                    <label className="form-row">
                      <span className="field-label">中文启动 Brief</span>
                      <textarea
                        name="brief"
                        placeholder="说明产品卖点、目标市场、客群、渠道、内容方向或素材包频率。"
                        required
                      />
                    </label>
                    <button className="button secondary" type="submit">
                      创建并切换到新项目
                    </button>
                  </form>
                </div>
              </div>

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
                {projectHealth ? (
                  <div className="workbench-section risks">
                    <div className="section-title-row">
                      <h3>0. 项目体检</h3>
                      <StatusBadge
                        label={projectHealthRatingLabels[projectHealth.rating]}
                        tone={projectHealth.rating === "READY" ? "success" : "warning"}
                      />
                    </div>
                    <div
                      aria-label={`${projectHealth.projectName} 就绪度 ${projectHealth.score} 分`}
                      style={{
                        background: "#eef2f7",
                        borderRadius: 999,
                        height: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          background: projectHealth.rating === "READY" ? "#1f9d72" : "#f2a900",
                          height: "100%",
                          width: `${projectHealth.score}%`,
                        }}
                      />
                    </div>
                    <p className="muted">{projectHealth.summary}</p>
                    {projectHealth.nextActions.length > 0 ? (
                      <div className="operation-list">
                        {projectHealth.nextActions.map((action) => (
                          <article className="operation-item" key={action.key}>
                            <header>
                              <strong>{action.label}</strong>
                              <StatusBadge
                                label={projectHealthSignalLabels[action.status]}
                                tone={action.status === "complete" ? "success" : "warning"}
                              />
                            </header>
                            <p>{action.summary}</p>
                            <Link className="button secondary" href={action.href}>
                              {action.action}
                            </Link>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">项目基础已具备，建议进入素材审核和复盘节奏。</p>
                    )}
                  </div>
                ) : null}

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
                      label={latestContentPackage ? "结构已保存" : "待生成"}
                      tone={latestContentPackage ? "success" : "warning"}
                    />
                  </div>
                  {latestContentPackage ? (
                    <>
                      <div className="package-summary">
                        <FileArchive size={20} aria-hidden="true" />
                        <div>
                          <strong>{latestContentPackage.name}</strong>
                          <p>
                            {latestContentPackage.period} ·{" "}
                            {contentFrequencyLabels[latestContentPackage.frequency]} ·{" "}
                            {contentPackageStatusLabels[latestContentPackage.status]}
                          </p>
                        </div>
                      </div>
                      {latestPackageReadiness ? (
                        <div
                          style={{
                            borderTop: "1px solid var(--line)",
                            display: "grid",
                            gap: 10,
                            paddingTop: 12,
                          }}
                        >
                          <header>
                            <strong>交付体检</strong>
                            <StatusBadge
                              label={contentPackageReadinessLabels[latestPackageReadiness.rating]}
                              tone={
                                latestPackageReadiness.rating === "READY_TO_EXPORT"
                                  ? "success"
                                  : "warning"
                              }
                            />
                          </header>
                          <div
                            aria-label={`${latestPackageReadiness.packageName} 可交付性 ${latestPackageReadiness.score} 分`}
                            style={{
                              background: "#eef2f7",
                              borderRadius: 999,
                              height: 8,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                background:
                                  latestPackageReadiness.rating === "READY_TO_EXPORT"
                                    ? "#1f9d72"
                                    : "#f2a900",
                                height: "100%",
                                width: `${latestPackageReadiness.score}%`,
                              }}
                            />
                          </div>
                          <p className="muted">{latestPackageReadiness.summary}</p>
                          <ul className="clean-list">
                            {latestPackageReadiness.signals.map((signal) => (
                              <li key={signal.key}>
                                {signal.label}：{signal.summary}
                                <small>
                                  {signal.blocking ? "阻塞" : "非阻塞"} · 下一步：{signal.action}
                                </small>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="pack-grid">
                        {latestContentPackage.files.map((file) => (
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
                        {latestContentPackage.status !== "APPROVED" ? (
                          <form
                            action={submitContentPackageForReviewAction}
                            className="inline-form"
                          >
                            <input
                              name="contentPackageId"
                              type="hidden"
                              value={latestContentPackage.id}
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
                          href={`/packages/${latestContentPackage.id}/export`}
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
                    <h3>6. 素材与审核状态</h3>
                    <StatusBadge
                      label={`${state.assets.filter((asset) => asset.status === "APPROVED").length}/${state.assets.length} 已审核`}
                      tone={
                        state.assets.length > 0 &&
                        state.assets.every((asset) => asset.status === "APPROVED")
                          ? "success"
                          : "warning"
                      }
                    />
                  </div>
                  {state.assets.length > 0 || state.reviewTasks.length > 0 ? (
                    <>
                      {state.assets.length > 0 ? (
                        <div className="pack-grid">
                          {state.assets.map((asset) => {
                            const product = state.linkedProducts.find(
                              (item) => item.id === asset.productId,
                            );

                            return (
                              <article className="pack-file" key={asset.id}>
                                <ImageIcon size={18} aria-hidden="true" />
                                <span>
                                  {asset.name}
                                  <small>
                                    {assetKindLabels[asset.kind]} · {assetStatusLabels[asset.status]}
                                    {product ? ` · ${product.name}` : " · 项目素材"}
                                  </small>
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          title="暂无项目素材"
                          description="真实产品图和官方 Logo 上传审核后会显示在这里。"
                        />
                      )}

                      <div className="operation-list">
                        {state.reviewTasks.length > 0 ? (
                          state.reviewTasks.map((task) => (
                            <article className="operation-item" key={task.id}>
                              <header>
                                <strong>{task.title}</strong>
                                <StatusBadge
                                  label={reviewTaskStatusLabels[task.status]}
                                  tone={
                                    task.status === "APPROVED"
                                      ? "success"
                                      : task.status === "PENDING"
                                        ? "warning"
                                        : "neutral"
                                  }
                                />
                              </header>
                              <p>
                                {reviewSubjectTypeLabels[task.subjectType]} ·{" "}
                                {task.description ?? "等待审核人处理。"}
                              </p>
                              {task.dueAt ? <small>截止：{formatShortDate(task.dueAt)}</small> : null}
                              {task.status === "PENDING" ? (
                                <>
                                  <form action={decideBAgentReviewTaskAction} className="form compact">
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <input
                                      name="projectId"
                                      type="hidden"
                                      value={selectedProject.id}
                                    />
                                    <label className="form-row">
                                      <span className="field-label">审核备注</span>
                                      <input
                                        name="decisionNote"
                                        placeholder="写通过依据、修改意见或风险点"
                                        type="text"
                                      />
                                    </label>
                                    <div className="hero-actions">
                                      <button
                                        className="button"
                                        name="decision"
                                        type="submit"
                                        value="APPROVED"
                                      >
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
                                  <form action={cancelBAgentReviewTaskAction} className="inline-form">
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <input
                                      name="projectId"
                                      type="hidden"
                                      value={selectedProject.id}
                                    />
                                    <input
                                      name="decisionNote"
                                      type="hidden"
                                      value="B 组 Agent 工作台取消审核任务。"
                                    />
                                    <button className="button secondary" type="submit">
                                      取消任务
                                    </button>
                                  </form>
                                </>
                              ) : null}
                            </article>
                          ))
                        ) : (
                          <EmptyState
                            title="暂无审核任务"
                            description="素材、策略或素材包进入审核后会显示在这里。"
                          />
                        )}
                      </div>

                      <div className="hero-actions">
                        <Link className="button secondary" href="/assets">
                          素材库
                        </Link>
                        <Link className="button secondary" href="/reviews">
                          审核中心
                        </Link>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="暂无素材和审核任务"
                      description="上传真实产品图、官方 Logo 或提交素材包审核后会显示在这里。"
                    />
                  )}
                </div>

                <div className="workbench-section risks">
                  <div className="section-title-row">
                    <h3>7. 主动提醒</h3>
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
                    <h3>8. 变更日志</h3>
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
                    <h3>9. 图片与海报原则</h3>
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
      <OfflineBAgentWorkbench
        reason={assistantError instanceof Error ? assistantError.message : "无法加载 B 组 Agent。"}
      />
    );
  }
}

function OfflineBAgentWorkbench({ reason }: { reason: string }) {
  const demoFacts = [
    ["产品名称", "Aurora Cup 智能保温杯"],
    ["核心卖点", "600ml、不锈钢、24小时保温、适合通勤和户外"],
    ["官方素材", "真实产品图和 Logo 必须走人工审核后进入素材库"],
    ["限制条件", "不得用图片模型重绘产品结构或替换 Logo"],
  ];
  const demoPlan = [
    ["第1周", "TikTok", "产品痛点短视频", "展示通勤场景与保温测试"],
    ["第2周", "Instagram", "生活方式海报", "真实产品图 + 模板化节日背景"],
    ["第3周", "Facebook", "互动抽奖内容", "提前准备奖品和活动规则"],
    ["第4周", "TikTok", "用户评价复用", "沉淀评论问题并反哺产品事实"],
  ];
  const demoPackageFiles = [
    "素材包说明 PDF",
    "内容排期 XLSX",
    "平台文案 DOCX",
    "Hashtags TXT",
    "TikTok 视频脚本 DOCX",
    "发布配文 TXT",
    "模板化海报图片",
    "海报文案 DOCX",
    "设计 Brief PDF",
    "品牌与合规检查 PDF",
    "最终 ZIP 打包下载",
  ];

  return (
    <AppShell activePath="/b-agent" context={null} contextError="离线演示模式" returnTo="/b-agent">
      <section className="page-header">
        <div>
          <p className="eyebrow">B组 · AI 内容增长 Agent</p>
          <h2>离线可打开的中文工作台</h2>
          <p className="muted">
            本机 PostgreSQL 尚未连接，当前先展示完整工作链路；连接数据库后会自动切回可保存的真实工作台。
          </p>
        </div>
      </section>

      <div className="setup-warning">
        数据库未就绪：{reason} 这不影响先验收 B 组入口、页面结构和业务链路。
      </div>

      <section className="agent-demo-shell working" aria-label="B组 Agent 离线工作台">
        <aside className="conversation-pane">
          <div className="pane-heading">
            <MessageSquareText size={20} aria-hidden="true" />
            <div>
              <h3>AI 顾问对话</h3>
              <p>当前是离线演示模式，真实保存需要 PostgreSQL。</p>
            </div>
          </div>

          <div className="project-mini-card">
            <strong>巴西新品首月内容增长</strong>
            <StatusBadge label="演示项目" tone="warning" />
            <p>目标是用中文自然语言把产品事实、渠道策略、内容计划和素材包交付串起来。</p>
          </div>

          <div className="chat-thread">
            <div className="chat-bubble user">
              <span>用户</span>
              <p>这是一款 600ml 智能保温杯，主推巴西市场，新增 TikTok 和 Instagram。</p>
            </div>
            <div className="chat-bubble agent">
              <span>B组 Agent</span>
              <p>
                已提取产品事实，并建议先聚焦 TikTok、Instagram 和 Facebook。LinkedIn
                暂不作为首月重点渠道。
              </p>
            </div>
            <div className="chat-bubble user">
              <span>用户</span>
              <p>下个月每周生成一次素材包，正式视觉只用真实产品图和官方 Logo。</p>
            </div>
            <div className="chat-bubble agent">
              <span>B组 Agent</span>
              <p>
                已形成待确认策略：巴西市场、年轻通勤与户外客群、每周素材包节奏、模板化海报合成。
              </p>
            </div>
          </div>

          <div className="nl-command-box">
            <PencilLine size={18} aria-hidden="true" />
            <div>
              <strong>可执行指令示例</strong>
              <ul>
                {agentCommandCapabilities.slice(0, 8).map((capability) => (
                  <li key={capability.key}>{capability.example}</li>
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
              <p>右侧展示 Agent 必须沉淀的数据对象，而不是只停留在聊天记录。</p>
            </div>
          </div>

          <section className="workbench-grid">
            <div className="workbench-section facts">
              <div className="section-title-row">
                <h3>1. 产品事实提取</h3>
                <StatusBadge label="待人工确认" tone="warning" />
              </div>
              <dl className="fact-list">
                {demoFacts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {value}
                      <small>来源：中文 Brief / 上传资料 · 待确认</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="workbench-section strategy">
              <div className="section-title-row">
                <h3>2. 策略推荐</h3>
                <StatusBadge label="草案" tone="warning" />
              </div>
              <div className="strategy-grid">
                <StrategyField label="推荐市场" values={["巴西"]} />
                <StrategyField label="核心客群" values={["年轻通勤人群", "户外轻运动人群"]} />
                <StrategyField label="平台渠道" values={["TikTok", "Instagram", "Facebook"]} />
                <StrategyField label="内容方向" values={["保温测试", "生活方式场景", "小抽奖互动"]} />
              </div>
              <div className="approval-line">
                <CheckCircle2 size={18} aria-hidden="true" />
                <p>人工确认后，这份策略会成为正式项目策略；后续中文指令若冲突，需要二次确认。</p>
              </div>
            </div>

            <div className="workbench-section plan">
              <div className="section-title-row">
                <h3>3. 首月计划</h3>
                <StatusBadge label="每周一次" tone="success" />
              </div>
              <div className="month-plan">
                {demoPlan.map(([week, channel, title, deliverable]) => (
                  <article className="plan-row" key={`${week}-${channel}`}>
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        {week} · {title}
                      </strong>
                      <p>
                        {channel} · {deliverable}
                      </p>
                      <small>待生成素材包内容</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="workbench-section package">
              <div className="section-title-row">
                <h3>4. 素材包预览</h3>
                <StatusBadge label="结构完整" tone="success" />
              </div>
              <div className="package-summary">
                <FileArchive size={20} aria-hidden="true" />
                <div>
                  <strong>巴西首月内容素材包</strong>
                  <p>PDF / XLSX / DOCX / TXT / 图片 / ZIP 下载结构已预留。</p>
                </div>
              </div>
              <div className="pack-grid">
                {demoPackageFiles.map((file) => (
                  <div className="pack-file" key={file}>
                    <FileText size={18} aria-hidden="true" />
                    <span>
                      {file}
                      <small>模板结构</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="workbench-section visual-policy">
              <div className="section-title-row">
                <h3>5. 图片与海报原则</h3>
                <Layers size={18} aria-hidden="true" />
              </div>
              <ul className="clean-list">
                <li>V1 使用真实产品图和官方 Logo 做模板化合成。</li>
                <li>产品层和 Logo 层必须引用已审核 Asset，禁止 AI 静默替换。</li>
                <li>AI 图片能力后续只用于背景、氛围、画布扩展和非产品装饰元素。</li>
                <li>海报层级固定预留：背景层、产品层、文字层、Logo层、装饰层。</li>
              </ul>
            </div>
          </section>
        </section>
      </section>
    </AppShell>
  );
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
