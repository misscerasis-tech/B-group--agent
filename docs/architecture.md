# 技术架构

## 目标

AI 内容增长 Agent 是独立 Web 系统，不依赖飞书作为业务底座。系统要支持多 Workspace、多项目、多产品、多市场，并能围绕真实产品信息生成可审核、可下载、可复盘的营销素材包。

## 推荐技术栈

- 前端与 Web API：Next.js App Router + TypeScript。
- UI：当前使用原生 CSS + lucide-react 图标构建中文后台界面；后续如引入 Tailwind 或 shadcn/ui，必须保持既有后台信息密度和中文交互习惯。
- 数据库：PostgreSQL。
- ORM 与迁移：Prisma，配置入口为 `prisma.config.ts`，所有结构变化必须通过迁移文件提交。
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

- `/b-agent` 使用数据库读取项目、产品事实、策略、计划、素材包、真实素材、审核任务、提醒和变更日志。
- 中文指令通过 `AgentTextProvider` 进入系统；当前启用本地规则型 `local-rule` Provider，不调用真实 GPT，已支持市场、渠道、客群、内容方向、素材包频率、项目状态、产品事实提取、计划、素材包、审核、复盘指标和提醒。
- 解析后的结构化操作保存为 `AgentOperation`。
- 策略仍为草案时，安全操作可直接应用到 `ProjectStrategy`。
- 策略已被人工确认后，后续操作进入 `PENDING_CONFIRMATION`；用户可确认或拒绝。确认后创建新的正式策略版本，拒绝则不改策略并保留操作记录。
- 内容计划状态和截止日期由 Agent 服务端事务按当前 Workspace 和项目匹配后写入，支持改为需审核、可执行、草稿或完成并保留变更日志。
- 审核中心和 Agent 对话共用 `ReviewTask`：用户可用中文指令处理产品事实、策略草案、素材和素材包审核，服务端会同步写回对应业务对象。
- `/b-agent` 主工作台也可以直接处理当前项目的 `ReviewTask`。服务端 action 会同时限制 `workspaceId` 和 `projectId`，避免从当前项目页面误处理同 Workspace 下其他项目的审核任务。
- 取消审核任务只更新 `ReviewTask.CANCELED`，不改变被审核对象状态；通过或要求修改才会写回对应业务对象。
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

今日工作台的 Agent 工作简报不直接调用模型，而是先从 `ContentPackage`、`ContentPlanItem`、`Reminder` 和 `MetricsSnapshot` 聚合出可解释的中文重点进展、风险和下一步动作。后续接入真实 GPT 时，可以把这份结构化简报作为上下文输入，而不是让模型直接绕过业务数据做自由总结。

数据复盘风险先以 `MetricsSnapshot` 形式沉淀，再由规则模块识别低点击率、无转化和投放花费风险。Agent 对话可以把这些风险转成 `Reminder`，但不会凭空生成指标，也不会跨 Workspace 或跨项目读取数据。

内容日历缺口先以 `Reminder` 方式推进：Agent 会比较当前项目策略渠道和现有未完成计划项，识别没有排期的渠道与首月空缺周次。系统不会直接替用户发布完整排期，后续可在此基础上生成可编辑计划草案。

Agent 创建提醒时可解析明确日期并写入 `Reminder.dueAt`；提醒截止日期调整由服务端按当前 Workspace 和项目匹配开放提醒后写入。模糊时间表达、重复提醒合并和时区提醒策略留到调度任务阶段处理。

提醒关闭分为 `DONE` 和 `DISMISSED`：完成代表待办已处理，忽略代表确认暂不处理。Agent 对话和提醒中心写入同一套状态，便于后续飞书通知同步。

当前素材包导出使用服务端本地 ZIP 生成器，输出基础 PDF、XLSX、DOCX、TXT、关联素材文件和 manifest。manifest 记录策略、产品事实、内容计划、已审核素材和可交付性检查摘要，便于复盘、迁移核对和后续飞书沉淀。素材包中心和 `/b-agent` 主入口复用同一套可交付性检查，按文件生成、文件审核、真实产品图、官方 Logo 和包级审核给出分数、阻塞项和下一步动作。素材包可由 Agent 按当前 Workspace 和项目归档或恢复草稿，并写入变更日志。导出查询必须按当前 Workspace 限制；后续精排 PDF、复杂 XLSX、正式 DOCX、PNG 海报或对象存储打包可以逐个替换同一导出入口。

素材包海报文件项可以关联已审核的 `GENERATED_IMAGE` Asset。Agent 对话只负责把当前项目范围内的最新模板海报挂到素材包文件项，不调用图片模型，也不会绕过真实产品图和官方 Logo 的审核要求。

项目工作台快照导出为 Workspace 作用域 JSON，包含项目、关联产品事实、素材审核状态、最新策略与版本历史、内容计划、素材包、提醒、审核任务、最近 Agent 操作和变更日志。`/b-agent` 主入口也会读取当前项目和关联产品范围内的 `Asset` 与 `ReviewTask`，让真实产品图、官方 Logo 和待审核对象不再只藏在素材库或审核中心。该导出不包含密钥、飞书 token 或本地文件二进制，只用于演示备份、复盘和迁移核对。

Workspace 复盘快照导出为 Workspace 作用域 JSON，包含聚合指标、可用性信号、建议、项目列表、近期表现和最近变更。该导出可作为周报、复盘沉淀和未来飞书文档/多维表格归档的输入，但生成过程不依赖飞书。

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

当前实现采用“`AgentTextProvider` → 结构化操作 → 服务端事务写入”的可替换路径。`local-rule` 是第一阶段默认 Provider；未来接入 GPT 时，只新增 Provider 适配器和必要的提示词版本，不修改项目策略、确认、计划、素材包、提醒、变更日志等业务数据结构。

Agent 可执行能力由 `agentCommandCapabilities` 集中维护，记录能力 key、中文标题、示例、写入表和是否需要明确人工审核。`/b-agent` 页面直接读取该清单，后续 GPT Provider 可以把它作为工具能力目录或 prompt 上下文，避免自然语言能力只散落在页面文案里。

产品事实提取当前同样采用本地规则型模块：可从产品说明、补充资料、TXT/MD/CSV/JSON/DOCX/文本型 PDF Asset，或 `/b-agent` 对话中粘贴的中文资料提取产品名称、说明、核心卖点、规格参数、目标场景、目标人群、视觉限制和合规注意。DOCX 通过本地 zip XML 读取，PDF 先做文本型内容 best-effort 提取；扫描件必须先 OCR 或整理成 Brief。已确认事实不会被规则提取静默覆盖；用户通过中文指令校准事实时，系统会写入新值并把对应事实转为 `NEEDS_REVIEW`，等待再次人工确认。

策略推荐当前采用 `buildStrategyRecommendation` 本地规则模块：读取当前项目关联产品和产品事实，结合用户中文推荐请求中的市场或节奏线索，生成 `ProjectStrategy` 草案。若当前策略已经人工确认，推荐结果会创建新的草案版本，旧正式策略继续保留；用户确认后才成为新的正式策略。

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

当前实现只保存非敏感占位连接、目标名称、占位测试结果和迁移记录；真实授权、真实连接测试、群聊/文档/多维表格选择和密钥加密保存留到 Feishu Connector 阶段。

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
- `/setup` 用于给操作者展示中文本地运行诊断，不暴露密钥或数据库密码。
- `/api/health` 用于检查 Web 进程、环境变量配置状态和数据库连接状态，便于本地演示前快速排查。
- `/workspace/export` 用于导出当前 Workspace 结构化业务数据，需屏蔽疑似密钥字段；文件二进制和完整数据库仍需单独备份。
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
