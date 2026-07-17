# 技术架构

## 目标

AI 内容增长 Agent 是独立 Web 系统，不依赖飞书作为业务底座。系统要支持多 Workspace、多项目、多产品、多市场，并能围绕真实产品信息生成可审核、可下载、可复盘的营销素材包。

## 推荐技术栈

- 前端与 Web API：Next.js App Router + TypeScript。
- UI：Tailwind CSS + shadcn/ui，本地化中文界面。
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

## 第一阶段核心数据模型

第一阶段实现：

- `User`
- `Workspace`
- `WorkspaceMember`
- `Project`
- `Product`
- `ProjectProduct`

`Project` 和 `Product` 使用多对多关系，因为一个项目可能包含多个产品，一个产品也可能用于多个国家或 Campaign 项目。产品知识不应重复复制到不同项目。

除 `User` 这类全局身份表外，核心业务表必须带有 `workspace_id` 或等价字段。第一阶段 Prisma 字段为 `workspaceId`，数据库迁移中对应列为 `"workspaceId"`。

后续预留：

- `Asset`
- `ImageGenerationJob`
- `ImageGenerationProviderConfig`
- `ContentPlan`
- `ContentPackage`
- `ReviewTask`
- `Reminder`
- `MetricsSnapshot`
- `IntegrationConnection`
- `FeishuConnection`
- `IntegrationMigration`
- `AuditLog`

## 多 Workspace 原则

- 所有业务数据必须带有 `workspace_id`。
- 用户可以属于多个 Workspace。
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
