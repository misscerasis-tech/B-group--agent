# AI 内容增长 Agent

AI 内容增长 Agent 是一个独立 Web 系统，面向新品品牌和多产品团队，作为“AI 内容增长负责人”辅助完成市场判断、内容策略、素材生成、审核提醒和数据复盘。

当前仓库状态：B 组正在 `feature/b-group-working-assistant` 分支推进，从静态演示模板升级为可本地读写数据的中文内容增长工作助手。

## 产品原则

- 中文操作界面优先。
- 支持多 Workspace、多项目、多产品、多市场。
- 支持中文自然语言驱动的策略生成与人工校准。
- AI 可以主动推荐市场、客群、平台和渠道，但正式策略必须经人工确认。
- 定期生成营销素材包，并支持一键下载。
- 支持真实产品图的模板化海报合成。
- 支持提醒、审核和数据复盘。
- 飞书是可插拔集成，不是系统底座。
- 核心业务即使不连接飞书也必须可运行。
- V1 后预留 AI 背景生成能力。

## Web-first, Feishu-connected

系统以独立 Web 产品为主，飞书仅用于任务、通知、简单审核和结果沉淀。项目、产品、素材、内容、审核、提醒和数据必须保存在本系统内。

不得在代码中写死以下信息：

- Feishu App ID
- Feishu App Secret
- tenant key
- chat ID
- document ID
- bitable ID

飞书连接必须归属于 Workspace，并支持连接、测试连接、更换组织、重新选择通知群、重新选择沉淀位置、停用旧连接和保存迁移记录。

## 仓库目录

```text
.
├── README.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
└── docs
    ├── architecture.md
    ├── development-plan.md
    └── rollback-guide.md
```

## 版本管理规则

- `main` 分支只保存可运行、可测试、可演示的稳定版本。
- 不长期直接在 `main` 分支开发。
- 每个开发阶段必须从 `main` 创建独立分支，例如 `feature/phase-1-foundation`。
- 每次修改前必须先检查 Git 状态。
- 如果发现未提交修改，必须先说明，并创建安全提交或备份分支。
- 每个阶段完成后必须运行测试、修复问题、更新文档、更新 `CHANGELOG.md`、创建清晰提交。
- 每个可用阶段必须创建 Git Tag，例如 `v0.1.0-foundation`。
- 所有版本必须可通过 commit 或 Tag 回滚。
- 数据库变化必须使用迁移文件，禁止直接修改不可追踪的数据库结构。
- 危险数据库迁移前必须设计备份和回滚方案。
- `.env`、密钥、App Secret 和其他凭证不得提交到 Git。

## 阶段汇报模板

每个阶段完成时必须汇报：

- 当前分支
- 最新 commit
- 当前 Tag
- 创建或修改的文件
- 测试结果
- 如何回滚到修改前

## 当前版本

- 初始化版本：`v0.0.1-initial`
- 当前 B 组工作分支：`feature/b-group-working-assistant`
- 当前 B 组远程仓库：`https://github.com/misscerasis-tech/B-group--agent.git`
- 下一稳定版本目标：验收后再合并 `main` 并创建阶段 Tag。

## 当前 B 组已具备能力

- `/b-agent` 为 B 组正式工作入口。
- 顶部 Workspace 区域支持切换和创建 Workspace。
- 左侧中文 Agent 对话可以提交本地规则型中文指令。
- 指令可转换为结构化操作，并真实写入项目策略、项目状态或进入待确认状态；当前支持市场、渠道、客群、内容方向、素材包频率和项目状态。
- 右侧项目工作台读取数据库中的产品事实、市场策略、首月计划、素材包结构、提醒和变更日志。
- 产品大脑支持从产品说明或补充资料生成产品事实、手动新增事实、确认全部事实；已确认事实不会被本地规则静默覆盖。
- 素材库支持上传真实产品图、官方 Logo、资料和参考图，服务端校验关联项目/产品归属，保存审核状态、校验和、本地存储路径，并自动创建审核中心任务。
- 图片生成供应商配置和生成任务已建立数据库底座，当前只保存候选配置和任务记录，不调用真实模型。
- 内容日历、素材包中心、审核中心、提醒中心已读取数据库，不再只是占位；内容日历可推进计划项状态。
- 素材包中心支持文件项状态推进和本地 ZIP 清单导出，ZIP 包含说明、排期 CSV、文案草稿、Hashtags、脚本、设计 Brief、合规检查和 manifest。
- 项目详情和 `/b-agent` 支持导出项目工作台 JSON 快照，便于演示前备份、复盘和迁移核对。
- 今日工作台展示项目、产品、计划、素材包、提醒和最近变更。
- 集成设置支持保存飞书占位连接、停用旧连接和记录换绑/迁移说明，但不接真实飞书 API。
- 数据复盘支持手动录入渠道表现，并基于策略、计划、素材、提醒、指令、指标和变更日志生成本地摘要。

本阶段仍不接入真实 GPT、图片生成 API、飞书、外部社媒平台或第三方登录，也不生成正式 PDF、DOCX、XLSX 或 PNG 成品文件。

## 本地开发

前置条件：

- Node.js。
- pnpm。若本机没有全局 pnpm，可使用 `npx pnpm@10.13.1 ...` 运行下列命令。
- Docker Desktop 与 Docker Compose，用于本地 PostgreSQL。

首次启动：

```bash
cp .env.example .env
```

然后编辑 `.env`，填写本地 `POSTGRES_USER`、`POSTGRES_PASSWORD` 和 `DATABASE_URL`。不要把 `.env` 提交到 Git。

安装依赖：

```bash
npx pnpm@10.13.1 install
```

启动 PostgreSQL：

```bash
npx pnpm@10.13.1 run docker:up
```

执行数据库迁移和 seed：

```bash
npx pnpm@10.13.1 run db:migrate
npx pnpm@10.13.1 run db:seed
```

启动 Web：

```bash
npx pnpm@10.13.1 exec next dev -p 3002
```

打开 `http://127.0.0.1:3002/b-agent`。

## 演示用户

第一阶段使用本地演示用户模拟登录：

- 邮箱：`demo@example.com`
- Workspace：`演示增长团队`、`欧洲增长演示团队`

演示用户由 `prisma/seed.ts` 创建。页面不会把用户 ID 散落写死，而是通过统一 Workspace 上下文读取当前演示用户。顶部 Workspace 切换可用于验证项目、产品、策略、计划和指标不会跨 Workspace 混在一起。

## 第一阶段页面

已规划的中文后台导航：

- B组 Agent
- 今日工作台
- 项目中心
- 产品大脑
- 内容日历
- 素材包
- 审核中心
- 提醒中心
- 数据复盘
- 集成设置

当前具备基础操作或真实数据展示的页面：

- 今日工作台。
- 项目中心。
- 产品大脑。
- 素材库。
- B组 Agent。
- 内容日历。
- 素材包。
- 审核中心。
- 提醒中心。
- 数据复盘。

数据复盘、集成设置当前仍是占位说明，后续继续接入真实数据。

## AI赛 ABC 三组入口

为避免 A/B/C 三组页面互相覆盖，固定入口如下：

- `/agent`：分组选择入口。
- `/a-agent`：A 组 Agent 独立入口。
- `/b-agent`：B 组 AI 内容增长 Agent 独立入口。
- `/c-agent`：C 组 CES 项目推进 Agent 独立入口。

当前仓库当前分支以 B 组为主。详细规则见 `docs/group-routing.md`。

## B 组仓库

B 组独立 GitHub 仓库：

```text
https://github.com/misscerasis-tech/B-group--agent.git
```

当前 B 组正式演示入口：

```text
/b-agent
```

能力拆分和后续计划见 `docs/b-group-capability-plan.md`。

## C 组 CES 项目推进 Agent

C 组入口：

```text
/c-agent
```

C 组定位为 CES 项目启动与推进工作助手。用户输入真实项目启动指令后，系统会生成 CES 项目总控、WBS、v1/v2/v3 节奏、计划疏漏检查、待 Owner 验证问题和飞书动作队列。

详细规则见：

- `docs/c-group-ces-project-agent.md`
- `docs/c-group-feishu-contract.md`
- `docs/c-group-owner-confirmation-checklist.md`
