import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  MessageSquareText,
  PencilLine,
  Sparkles,
  Target,
} from "lucide-react";

const chatMessages = [
  {
    role: "user",
    text: "我们要给一款智能温显保温杯做巴西市场首月内容增长，产品图和官方 Logo 已经有了。",
  },
  {
    role: "agent",
    text: "我先提取产品事实：智能温显、长效保温、通勤和礼品场景。正式视觉将只使用你上传的真实产品图和官方 Logo。",
  },
  {
    role: "user",
    text: "巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。",
  },
  {
    role: "agent",
    text: "已转换为结构化操作：删除 LinkedIn，新增 TikTok，素材包频率改为每周一次。该修改与正式策略不冲突，等待你确认。",
  },
];

const productFacts = [
  ["产品名称", "Aurora Cup 智能温显保温杯"],
  ["核心卖点", "温度显示、24 小时保温、防漏便携、礼品属性"],
  ["目标场景", "通勤、健身、办公桌、节日礼赠"],
  ["视觉限制", "产品图和 Logo 必须来自已审核真实素材，禁止 AI 重绘产品"],
];

const strategyItems = [
  {
    title: "推荐市场",
    value: "巴西一线与新一线城市",
    reason: "礼品、通勤和短视频种草场景更容易形成首月声量。",
  },
  {
    title: "核心客群",
    value: "20-35 岁通勤人群、健身用户、礼品购买者",
    reason: "产品卖点可以同时覆盖自用和送礼两种转化路径。",
  },
  {
    title: "平台组合",
    value: "TikTok + Instagram + Facebook",
    reason: "TikTok 做发现，Instagram 做视觉背书，Facebook 做活动扩散。",
  },
  {
    title: "内容方向",
    value: "温度可视化、通勤效率、节日礼赠、小抽奖活动",
    reason: "把技术点翻译成生活场景，降低新品理解成本。",
  },
];

const operations = [
  "删除渠道：LinkedIn",
  "新增渠道：TikTok",
  "素材包频率：下个月每周一次",
  "冲突检查：不冲突，等待人工确认",
];

const monthlyPlan = [
  ["第1周", "新品认知", "温显功能短视频、产品首图海报、Instagram Reels"],
  ["第2周", "场景种草", "通勤/健身场景内容、Facebook 互动贴"],
  ["第3周", "礼品转化", "节日礼赠文案、套装优惠海报、小抽奖规则草案"],
  ["第4周", "复盘加码", "高表现内容二创、FAQ 内容、下月优化建议"],
];

const contentPackFiles = [
  { name: "素材包说明 PDF", icon: FileText },
  { name: "内容排期 XLSX", icon: FileSpreadsheet },
  { name: "平台文案 DOCX", icon: FileText },
  { name: "Hashtags TXT", icon: FileText },
  { name: "TikTok 视频脚本 DOCX", icon: FileText },
  { name: "模板化海报图片", icon: ImageIcon },
  { name: "设计 Brief PDF", icon: Layers },
  { name: "最终 ZIP 打包下载", icon: FileArchive },
];

export default function BAgentPage() {
  return (
    <main className="b-agent-page">
      <section className="b-agent-demo-hero">
        <div>
          <p className="eyebrow">B组 · AI 内容增长 Agent</p>
          <h1>左侧中文对话，右侧结构化项目工作台</h1>
          <p>
            这不是聊天页，而是能把中文需求转成项目事实、策略、计划和素材包任务的增长负责人演示台。
            当前使用模拟数据，后续再接真实 AI、文件生成和飞书通知。
          </p>
        </div>
        <div className="demo-status-panel">
          <Sparkles size={22} aria-hidden="true" />
          <strong>演示链路已拆清</strong>
          <span>产品事实 → 策略推荐 → 人工确认 → 首月计划 → 素材包预览</span>
        </div>
      </section>

      <section className="agent-demo-shell" aria-label="B组 Agent 演示工作台">
        <aside className="conversation-pane">
          <div className="pane-heading">
            <MessageSquareText size={20} aria-hidden="true" />
            <div>
              <h2>AI 顾问对话</h2>
              <p>中文输入会被转成结构化操作。</p>
            </div>
          </div>

          <div className="chat-thread">
            {chatMessages.map((message, index) => (
              <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "用户" : "B组 Agent"}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className="nl-command-box">
            <PencilLine size={18} aria-hidden="true" />
            <div>
              <strong>自然语言变更摘要</strong>
              <ul>
                {operations.map((operation) => (
                  <li key={operation}>{operation}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <section className="workbench-pane">
          <div className="pane-heading">
            <Target size={20} aria-hidden="true" />
            <div>
              <h2>结构化项目工作台</h2>
              <p>所有结论先是草稿，人工确认后才成为正式策略。</p>
            </div>
          </div>

          <div className="workbench-grid">
            <section className="workbench-section facts">
              <div className="section-title-row">
                <h3>1. 产品事实提取</h3>
                <span className="status-pill success">已确认</span>
              </div>
              <dl className="fact-list">
                {productFacts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="workbench-section strategy">
              <div className="section-title-row">
                <h3>2. 策略推荐</h3>
                <span className="status-pill warning">待人工确认</span>
              </div>
              <div className="strategy-grid">
                {strategyItems.map((item) => (
                  <article className="strategy-row" key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.value}</span>
                    <p>{item.reason}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="workbench-section approval">
              <div className="section-title-row">
                <h3>3. 人工确认</h3>
                <span className="status-pill neutral">演示状态</span>
              </div>
              <div className="approval-line">
                <CheckCircle2 size={20} aria-hidden="true" />
                <p>
                  确认后将保存为“巴西首月内容增长策略 v1”，并锁定 TikTok、Instagram、Facebook
                  作为首月渠道组合。
                </p>
              </div>
              <div className="demo-buttons" aria-label="演示按钮">
                <button className="button" type="button">
                  确认正式策略
                </button>
                <button className="button secondary" type="button">
                  继续用中文修改
                </button>
              </div>
            </section>

            <section className="workbench-section plan">
              <div className="section-title-row">
                <h3>4. 首月内容计划</h3>
                <span className="status-pill success">已生成草案</span>
              </div>
              <div className="month-plan">
                {monthlyPlan.map(([week, theme, output]) => (
                  <article className="plan-row" key={week}>
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        {week} · {theme}
                      </strong>
                      <p>{output}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="workbench-section package">
              <div className="section-title-row">
                <h3>5. 第一份素材包预览</h3>
                <span className="status-pill neutral">模拟生成</span>
              </div>
              <div className="pack-grid">
                {contentPackFiles.map((file) => {
                  const Icon = file.icon;

                  return (
                    <div className="pack-file" key={file.name}>
                      <Icon size={18} aria-hidden="true" />
                      <span>{file.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="download-preview">
                <Download size={18} aria-hidden="true" />
                <span>后续阶段接入真实 PDF/XLSX/DOCX/TXT/ZIP 生成。</span>
              </div>
            </section>
          </div>
        </section>
      </section>

      <section className="demo-footer-panel">
        <ClipboardCheck size={20} aria-hidden="true" />
        <p>
          B 组比赛演示建议从这条链路讲起：中文输入产品 → AI 提取事实 → 人工确认事实 →
          AI 推荐市场与渠道 → 中文修改策略 → 确认正式策略 → 生成首月计划和素材包预览。
        </p>
        <Link className="button secondary" href="/agent">
          返回 ABC 入口
        </Link>
      </section>
    </main>
  );
}
