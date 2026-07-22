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
- `/b-agent` 在当前 Workspace 还没有项目时，可直接用中文 Brief 启动第一个 B 组项目。
- 顶部 Workspace 区域支持切换和创建 Workspace。
- 左侧中文 Agent 对话通过 `AgentTextProvider` 处理指令；当前启用本地规则型 `local-rule` Provider，后续可替换为真实 GPT 适配器。
- Agent 可执行能力由统一的 `agentCommandCapabilities` 清单维护，页面示例、测试和未来 GPT prompt 可复用同一能力目录。
- 指令可转换为结构化操作，并真实写入项目、产品、项目策略、项目状态、产品事实、项目提醒、渠道表现、内容日历、素材包、审核任务、首月计划或进入待确认状态；当前支持新项目启动、当前项目新增并关联产品、市场、渠道、客群、内容方向、素材包频率、项目状态、产品事实新增/提取/修改/确认、提醒创建/改期/完成/忽略、指标录入、风险提醒生成、计划项新增/改期/改状态/完成、指定周期素材包创建/归档/恢复草稿、素材包文件推进、模板海报关联、素材包提交审核、审核任务处理/取消/补齐和首月计划生成。
- 正式策略被修改时，Agent 会写入待确认操作并提示风险；当前可识别删除唯一渠道、删除内容日历仍在使用的渠道、清空内容方向、降低素材包频率和暂停/归档项目。
- 右侧项目工作台读取数据库中的产品事实、市场策略、首月计划、素材包结构、真实素材、审核任务、提醒和变更日志。
- `/b-agent` 右侧工作台顶部展示项目就绪度体检，显示评分、阻塞状态和下一步动作。
- `/b-agent` 可以直接通过、要求修改或取消当前项目的待审核任务，处理后留在当前项目工作台，并同步写回对应业务对象。
- `/b-agent` 提供常用流程按钮，并可在主动提醒区直接完成或忽略提醒。
- `/b-agent` 在已有项目时也能用中文 Brief 继续启动新项目，创建后自动切换到新项目工作台。
- `/b-agent` 左侧中文指令可识别“切换到某项目工作台”，只在当前 Workspace 内匹配项目并跳转，未命中时不会误改业务数据。
- `/b-agent` 左侧中文指令可识别“创建/启动新项目”，并在当前 Workspace 下创建 Project、Product、ProjectProduct、ProductFact、ProjectStrategy、AgentConversation、AgentOperation 和 ChangeLog。
- `/b-agent` 左侧中文指令可给当前项目新增产品；系统会优先复用当前 Workspace 下同名产品，避免重复创建，并补充待确认产品事实。
- `/b-agent` 的素材包预览会复用素材包中心的可交付性检查，直接展示文件生成、审核、真实产品图、官方 Logo 和包级审核阻塞项。
- 项目中心支持用中文 Brief 启动项目，一次创建项目、产品、多对多关联、待确认产品事实、策略草案、对话消息和变更日志。
- 产品大脑支持从产品说明、粘贴补充资料或已上传的 TXT/MD/CSV/JSON/DOCX/文本型 PDF 产品资料 Asset 生成产品事实、手动新增事实、通过中文指令修改事实、确认全部事实；事实被修改后会转为需复核，已确认事实不会被本地规则静默覆盖。
- 项目和产品的手工创建、编辑、关联、事实生成与确认都会进入变更日志。
- 素材库支持上传和下载真实产品图、官方 Logo、资料和参考图，服务端校验文件大小、格式、下载路径和关联项目/产品归属，保存审核状态、校验和、本地存储路径，并自动创建审核中心任务。
- 图片生成供应商配置和生成任务已建立数据库底座；素材库可用已审核真实产品图和官方 Logo 生成本地分层 SVG 模板海报，结果进入统一 Asset，当前不调用真实模型。
- 内容日历、素材包中心、审核中心、提醒中心已读取数据库，不再只是占位；内容日历可新增计划项并推进计划项状态。
- 首月计划会生成 4 周截止日期，并在 B 组 Agent、内容日历和导出文件中展示。
- 素材包中心支持手动创建素材包结构、文件项关联已审核素材、文件项状态推进、提交 Web 审核和本地 ZIP 可交付文件包导出，ZIP 包含基础 PDF、XLSX、DOCX、TXT、关联素材、素材摘要、人工审核清单和 manifest；manifest 会记录策略、产品事实、内容计划、项目级/产品级已审核素材和可交付性检查摘要。
- 素材包中心会显示可交付性检查；导出 ZIP 内包含 `00-交付检查.txt`，明确文件生成、文件审核、真实产品图、官方 Logo 和素材包审核状态。
- 项目详情和 `/b-agent` 支持导出项目工作台 JSON 快照，便于演示前备份、复盘和迁移核对。
- 今日工作台支持导出当前 Workspace 安全备份 JSON，覆盖项目、产品、策略、计划、素材包、审核、提醒、复盘、Agent 操作、集成占位和图片生成任务元数据，并递归屏蔽疑似密钥字段。
- 可用 `backup:validate` 校验导出的 Workspace 备份 JSON，检查 schema、计数、敏感字段脱敏和 Workspace 归属；该命令不写数据库。
- 今日工作台会生成 Agent 工作简报，基于素材包、近期内容计划、开放提醒和渠道表现给出重点进展、风险和下一步动作。
- 今日工作台展示项目、产品、计划、素材包、提醒、最近变更、按优先级生成的今日行动队列和项目就绪度体检。
- 项目就绪度会按产品关联、产品事实、正式策略、首月计划、素材包、真实视觉素材、审核任务、指标复盘和提醒处理生成评分与下一步动作。
- 项目详情可以把项目就绪度缺口一键生成项目提醒，系统会跳过已存在的同标题开放提醒。
- 集成设置支持保存飞书占位连接、占位测试、停用旧连接和记录换绑/迁移说明，但不接真实飞书 API。
- 提醒中心支持系统扫描生成提醒，也支持人工创建 Workspace 或项目级提醒；主动扫描会检查策略、审核、素材、素材包、活动规则和渠道表现异常。
- 数据复盘支持单条或批量录入渠道表现，校验指标逻辑，并基于策略、计划、素材、提醒、指令、指标和变更日志生成本地摘要。
- 数据复盘支持导出当前 Workspace 的 JSON 快照，便于周报沉淀、演示前备份和后续飞书归档。
- Seed 会在主 Workspace 同时创建一个较完整的巴西项目和一个“蒙古夏季预热内容缺口项目”，方便直接验收就绪度、提醒和素材包阻塞。

本阶段仍不接入真实 GPT、图片生成 API、飞书、外部社媒平台或第三方登录；PDF、DOCX、XLSX 先使用本地基础生成器，正式精排和 PNG 海报成品留到后续阶段。

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

启动前诊断：

```bash
npx pnpm@10.13.1 run doctor
```

诊断会检查当前目录、Git 分支、`.env`、Docker、Docker Compose、Node.js、pnpm 和 `3002` 端口。如果 `3002` 已被 A 组或其他服务占用，它会显示占用进程，并建议下一个可用端口。

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
npx pnpm@10.13.1 run dev:b
```

打开 `http://127.0.0.1:3002/b-agent`。

如果 3002 已被 A 组或其他服务占用，改用一个空闲端口：

```bash
npx pnpm@10.13.1 exec next dev -p 3003
```

如果 `doctor` 建议的是其他端口，把命令里的 `3003` 换成诊断结果里的端口。然后打开对应的 `/b-agent`，例如 `http://127.0.0.1:3003/b-agent`。

健康检查：

```text
http://127.0.0.1:3002/setup
http://127.0.0.1:3002/api/health
```

如果页面打不开，优先打开 `/setup` 查看中文排障建议；机器可读状态可看 `/api/health`。如果 `database.status` 是 `unavailable`，通常是 PostgreSQL/Docker 没有启动或 `.env` 的 `DATABASE_URL` 不正确。

演示前冒烟检查：

```bash
npx pnpm@10.13.1 run smoke
```

如果 B 组临时跑在 3003：

```bash
npx pnpm@10.13.1 run smoke -- --url http://127.0.0.1:3003
```

若只是想确认 Web 服务和页面路由已启动、暂时允许数据库不可用：

```bash
npx pnpm@10.13.1 run smoke -- --allow-unhealthy-db
```

校验已导出的 Workspace 备份 JSON：

```bash
npx pnpm@10.13.1 run backup:validate -- backups/workspace.json
```

## 演示用户

第一阶段使用本地演示用户模拟登录：

- 邮箱：`demo@example.com`
- Workspace：`演示增长团队`、`欧洲增长演示团队`

演示用户由 `prisma/seed.ts` 创建。页面不会把用户 ID 散落写死，而是通过统一 Workspace 上下文读取当前演示用户。顶部 Workspace 切换可用于验证项目、产品、策略、计划和指标不会跨 Workspace 混在一起。

Seed 后，素材库会包含可下载的本地 SVG 示例产品图、Logo 和模板海报；演示素材包中的海报文件项已关联到生成图，用于验证素材到素材包的闭环。

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
- 集成设置。

数据复盘已读取系统内策略、计划、素材、提醒、指令和手动指标，并可导出 Workspace 复盘快照；集成设置已支持保存飞书占位连接、停用旧连接和记录迁移说明。

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
