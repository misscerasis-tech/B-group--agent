# 技术架构

## 目标

AI 内容增长 Agent 是独立 Web 系统，不依赖飞书作为业务底座。系统要支持多 Workspace、多项目、多产品、多市场，并能围绕真实产品信息生成可审核、可下载、可复盘的营销素材包。

## 推荐技术栈

- 前端与 Web API：Next.js App Router + TypeScript。
- UI：当前使用原生 CSS + lucide-react 图标构建中文后台界面；后续如引入 Tailwind 或 shadcn/ui，必须保持既有后台信息密度和中文交互习惯。
- 数据库：PostgreSQL。
- ORM 与迁移：Prisma，所有结构变化必须通过迁移文件提交。
- 后台任务：独立 Worker 进程，优先使用 PostgreSQL 队列方案，后续可替换为 Redis/BullMQ。
- 文件存储：本地开发使用本地存储，生产使用 S3 兼容对象存储。
- AI 调用：通过 Provider Adapter 封装，避免业务代码绑定单一模型。
- 图片合成：V1 使用模板化合成管线，优先支持真实产品图、文案、价格、卖点和平台规格。
- 飞书集成：作为 Workspace 级 Integration Connector。
- 测试：单元测试、数据模型测试、API 测试、关键用户流端到端测试。

第一阶段实际落地：

- Next.js App Router + TypeScript。
- Docker Compose PostgreSQL。
- Prisma schema、migration 和 seed。
- 本地演示用户模拟登录。
- 服务端 Workspace 上下文与数据隔离。
- 中文后台工作台页面。

当前 B 组工作助手分支继续落地：

- `/b-agent` 使用数据库读取项目、产品事实、策略、计划、素材包、提醒和变更日志。
- 中文指令先由本地规则型解析器处理，不调用真实 GPT；当前支持市场、渠道、客群、内容方向和素材包频率。
- 解析后的结构化操作保存为 `AgentOperation`。
- 策略仍为草案时，安全操作可直接应用到 `ProjectStrategy`。
- 策略已被人工确认后，后续操作进入 `PENDING_CONFIRMATION`；用户可确认或拒绝。确认后创建新的正式策略版本，拒绝则不改策略并保留操作记录。
- `/b-agent` 默认读取最新未归档策略，同时展示最近策略版本历史。
- 所有操作写入 `ChangeLog`，保证可追踪和可回滚。
- 内容日历、素材包中心、审核中心、提醒中心从同一套 Workspace 数据读取。

## 分层设计

```text
Browser
  ↓
Web App / API Routes
  ↓
Application Services
  ↓
Domain Modules
  ↓
Database / Object Storage / Job Queue
  ↓
Optional Connectors: Feishu, AI Providers, Analytics Sources
```

核心业务模块包括：

- Workspace 与成员权限。
- 项目、产品、市场和客群管理。
- AI 策略推荐与人工校准。
- 内容计划、素材包、模板化海报合成。
- 审核、提醒、任务和通知。
- 数据复盘与指标沉淀。
- Workspace 级飞书连接与迁移记录。

## 核心数据模型

Foundation 已实现：

- `User`
- `Workspace`
- `WorkspaceMember`
- `Project`
- `Product`
- `ProjectProduct`

`Project` 和 `Product` 使用多对多关系，因为一个项目可能包含多个产品，一个产品也可能用于多个国家或 Campaign 项目。产品知识不应重复复制到不同项目。

除 `User` 这类全局身份表外，核心业务表必须带有 `workspace_id` 或等价字段。第一阶段 Prisma 字段为 `workspaceId`，数据库迁移中对应列为 `"workspaceId"`。

B 组工作助手已新增：

- `ProductFact`：产品事实，区分草稿、已确认、需复核。
- `ProjectStrategy`：项目策略，支持目标市场、客群、渠道、内容方向、素材包频率、确认状态和版本记录。
- `ContentPlanItem`：首月内容计划项，支持在内容日历中推进状态并写入变更日志。
- `ContentPackage` 与 `ContentPackageFile`：素材包结构和文件状态，文件项推进会自动更新素材包整体状态。
- `ReviewTask`：策略、素材包、素材和产品事实的 Web-first 审核任务。
- `Reminder`：基于项目风险、计划缺口、审核状态和素材来源生成的主动提醒。
- `MetricsSnapshot`：按项目、周期和渠道保存手动录入或未来导入的表现数据。
- `AgentConversation` 与 `AgentMessage`：项目级 Agent 对话。
- `AgentOperation`：自然语言转换后的结构化操作。
- `ChangeLog`：人工确认、手工 CRUD、指令应用、事实生成和生成动作的变更记录。
- `Asset`：素材库，保存真实产品图、官方 Logo、资料、参考图、生成图和导出文件；上传时必须服务端校验文件大小、格式和关联项目/产品属于当前 Workspace，并自动进入 Web 审核任务。
- `ImageGenerationProviderConfig`：Workspace 级图片生成候选供应商配置，不保存 seed 密钥。
- `ImageGenerationJob`：图片生成/模板合成任务，保存 provider、model、promptVersion、sourceAssetIds、generationMode、aspectRatio、status 和 error。
- `IntegrationConnection`：Workspace 级可插拔集成连接，当前支持飞书占位连接。
- `IntegrationMigrationRecord`：飞书组织、通知群或沉淀位置换绑时的迁移记录。

当前素材包导出先使用服务端本地 ZIP 清单生成器，输出说明、排期 CSV、文案、Hashtags、TikTok 脚本、设计 Brief、合规检查和 manifest。导出查询必须按当前 Workspace 限制；后续 PDF、DOCX、XLSX、PNG 生成器可以逐个替换同一导出入口。

项目工作台快照导出为 Workspace 作用域 JSON，包含项目、关联产品事实、素材审核状态、最新策略与版本历史、内容计划、素材包、提醒、审核任务、最近 Agent 操作和变更日志。该导出不包含密钥、飞书 token 或本地文件二进制，只用于演示备份、复盘和迁移核对。

V1 的模板化合成任务通过 `ImageGenerationJob` 入库，provider 固定为内部模板记录器 `internal-template-composer`，不会调用外部图片模型。创建任务时必须选择已审核的真实产品图和官方 Logo，系统保存 sourceAssetIds、generationMode、aspectRatio 和状态，后续可由真实模板渲染器或图片供应商适配器接管。

仍预留：

- `FeishuConnection`
- `AuditLog`

## 多 Workspace 原则

- 所有业务数据必须带有 `workspace_id`。
- 用户可以属于多个 Workspace。
- 用户可以在 Web 中创建新的 Workspace，并自动成为该 Workspace 的所有者。
- 飞书连接、通知群、沉淀位置、审核配置都归属于 Workspace。
- 后台任务必须按 Workspace 隔离执行。
- 导出文件和生成素材必须按 Workspace 隔离存储。

## AI 工作流

1. 用户用中文输入新品、产品或增长目标。
2. AI 解析目标，生成市场、客群、平台、渠道和内容机会建议。
3. 用户人工校准建议。
4. 系统保存正式策略版本。
5. 系统按计划生成内容包和海报合成任务。
6. 人工审核后发布或下载。
7. 系统沉淀数据，进入复盘和下一轮建议。

当前实现采用“本地规则型 Agent → 结构化操作 → 服务端事务写入”的可替换路径。未来接入 GPT 时，只替换解析和建议生成 Provider，项目策略、确认、计划、素材包、提醒、变更日志等业务数据结构保持稳定。

产品事实提取当前同样采用本地规则型模块：从产品说明或补充资料中提取产品名称、说明、核心卖点、规格参数、目标场景、目标人群、视觉限制和合规注意。已确认事实不会被规则提取静默覆盖，未确认事实会更新为需复核。

## 飞书连接架构

飞书不是系统底座。飞书只承担：

- 任务通知。
- 审核提醒。
- 简单审批入口。
- 结果沉淀到用户选择的位置。

飞书连接必须满足：

- 连接信息属于 Workspace。
- App ID、App Secret、tenant key、chat ID、document ID、bitable ID 均不得写死。
- 支持测试连接。
- 支持更换飞书组织。
- 支持重新选择通知群和沉淀位置。
- 支持停用旧连接。
- 支持保存迁移记录。
- 旧飞书组织断开后，核心业务数据仍在本系统中可用。

当前实现只保存非敏感占位连接、目标名称和迁移记录；真实授权、连接测试、群聊/文档/多维表格选择和密钥加密保存留到 Feishu Connector 阶段。

## 安全与凭证

- `.env` 不进入 Git。
- `.env.example` 只保存变量名和示例占位值。
- 生产密钥使用部署平台或密钥管理服务保存。
- 所有外部集成凭证按 Workspace 加密保存。
- 所有关键操作写入审计日志。

## 数据库迁移

- 数据库结构变化必须通过迁移文件提交。
- 禁止直接在线修改生产数据库结构。
- 危险迁移必须先完成备份、回滚脚本和演练。
- 迁移记录必须和应用版本、Git commit、Git Tag 关联。

## 可观测性

- API 请求、后台任务、AI 调用、飞书回调、素材生成任务都要有结构化日志。
- 关键失败需要可重试，并能在后台任务面板中查看状态。
- 生产环境需要错误追踪和基础性能指标。

## V1 后预留能力

- AI 背景生成。
- 多模型路由。
- 多平台数据自动回流。
- 素材效果预测。
- 自动 A/B 测试建议。

## 图片生成抽象

图片生成不得绑定单一供应商。第一阶段通过 `ImageGenerationProvider` 接口预留：

- `template_composition`
- `background_generation`
- `image_edit`
- `image_expand`

正式产品图和 Logo 必须引用已审核真实 Asset，图片模型不能重绘、替换或改变产品结构。详细策略见 `docs/image-generation-strategy.md`。
