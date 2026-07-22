import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  Download,
  Image as ImageIcon,
  Layers,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

const workflow = [
  "用户用中文介绍产品或上传资料",
  "AI 提取产品事实，并让用户确认",
  "AI 推荐市场、客群、平台、渠道和内容方向",
  "人工编辑确认后生成正式策略",
  "生成首月计划和第一份营销素材包",
];

const deliverables = [
  "素材包说明 PDF",
  "内容排期 XLSX",
  "平台文案 DOCX",
  "Hashtags TXT",
  "TikTok 视频脚本 DOCX",
  "模板化海报图片",
  "设计 Brief PDF",
  "最终 ZIP 打包下载",
];

const layers = [
  "Background Layer",
  "Product Layer",
  "Text Layer",
  "Logo Layer",
  "Decoration Layer",
];

export default function BAgentPage() {
  return (
    <main className="b-agent-page">
      <section className="b-agent-hero">
        <div>
          <p className="eyebrow">B组 · AI 内容增长 Agent</p>
          <h1>新品品牌的 AI 内容增长负责人</h1>
          <p>
            面向多 Workspace、多项目、多产品和多市场，用中文自然语言把产品认知、市场策略、
            内容计划、素材包和审核复盘串成一条可演示链路。
          </p>
          <div className="hero-actions">
            <Link className="button" href="/dashboard">
              进入工作台
            </Link>
            <Link className="button secondary" href="/projects">
              查看项目中心
            </Link>
          </div>
        </div>
        <div className="b-agent-summary">
          <Sparkles size={22} aria-hidden="true" />
          <strong>Web-first, Feishu-connected</strong>
          <p>核心业务保存在独立 Web 系统，飞书只作为通知、任务、简单审核和结果沉淀入口。</p>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>
            <MessageSquareText size={20} aria-hidden="true" />
            首次项目创建流程
          </h2>
          <ol className="clean-list">
            {workflow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <h2>
            <Download size={20} aria-hidden="true" />
            V1 素材包目标
          </h2>
          <div className="tag-grid">
            {deliverables.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid three">
        <div className="panel">
          <h2>
            <CalendarDays size={20} aria-hidden="true" />
            定期内容计划
          </h2>
          <p className="muted">
            后续支持按月、按周生成营销素材包，并结合市场节日、平台特性和内容缺口主动提醒。
          </p>
        </div>
        <div className="panel">
          <h2>
            <ImageIcon size={20} aria-hidden="true" />
            真实产品视觉
          </h2>
          <p className="muted">
            V1 使用用户上传的真实产品图和官方 Logo。允许裁切、缩放、定位、排版和阴影，
            禁止 AI 重绘产品结构。
          </p>
        </div>
        <div className="panel">
          <h2>
            <ClipboardCheck size={20} aria-hidden="true" />
            审核与复盘
          </h2>
          <p className="muted">
            AI 建议必须经人工确认后成为正式策略，素材发布前需要产品、Logo、参数和合规检查。
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>
          <Layers size={20} aria-hidden="true" />
          V1 海报图层结构
        </h2>
        <div className="layer-row">
          {layers.map((layer) => (
            <span key={layer}>{layer}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
