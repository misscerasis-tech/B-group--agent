# Changelog

所有重要变更都会记录在本文件中。

格式参考 Keep a Changelog，版本号遵循“阶段可用版本”的语义。

## [Unreleased]

### Added

- 增加 B 组工作助手开发分支 `feature/b-group-working-assistant`。
- 增加 Agent 对话、结构化操作、产品事实、项目策略、内容计划、素材包、提醒和变更日志数据模型。
- 增加 B 组本地规则型中文指令解析器，可识别市场、渠道增删、素材包频率和内容方向。
- `/b-agent` 升级为数据库驱动的中文工作助手，可提交指令、确认策略、确认应用变更、生成首月计划。
- 产品大脑支持从产品说明生成初始产品事实、手动新增事实和确认事实。
- 增加 Asset、ImageGenerationProviderConfig、ImageGenerationJob 数据模型和 migration。
- 增加素材库 `/assets`，支持本地上传素材、关联项目/产品、保存审核状态和文件元数据。
- 增加图片生成候选供应商和模板化合成任务 seed。
- 增加 IntegrationConnection、IntegrationMigrationRecord 数据模型和 migration。
- 集成设置页面支持保存飞书占位连接、停用旧连接和记录迁移说明，不接真实飞书。
- 内容日历、素材包中心、审核中心、提醒中心改为读取当前 Workspace 真实数据。
- 增加 ReviewTask 数据模型、审核任务生成和审核通过/要求修改的 Web-first 审核流。
- 提醒中心支持根据当前 Workspace 数据生成主动提醒，并可标记完成或忽略。
- 素材包中心支持按当前 Workspace 下载本地 ZIP 清单导出。
- `/b-agent` 展示项目策略版本历史，便于查看确认后变更产生的新版本。
- 数据复盘页面改为基于系统内策略、计划、素材、素材包、提醒、指令和变更日志生成摘要。
- 正式策略确认后的 Agent 变更会创建新的策略版本，旧版本保留用于复盘和回滚。
- 今日工作台增加内容计划、素材包、待处理提醒和最近变更摘要。
- 增加 B 组工作助手 Prisma migration 和增强 seed 数据。
- 增加中文指令解析单元测试。
- 增加 C 组 CES 项目推进 Agent 工作台 `/c-agent`。
- 增加 CES 项目启动指令解析、项目快照、WBS、v1/v2/v3 版本节奏、计划疏漏检查和待 Owner 验证问题。
- 增加 CES 项目飞书文档草案、WBS 任务表行数据和 Owner 确认清单导出工具。
- 增加 C 组 CES 项目推进 Agent 产品说明文档。
- 增加 C 组飞书文档、任务表、群聊、日历和审批的落地契约文档。
- 增加 C 组项目 Owner 待确认清单文档。
- 增加 C 组项目计划生成与审查逻辑测试。
- 增加 B 组能力拆分与演示链路计划文档。
- 优化 `/b-agent` 为“左侧中文 AI 对话 + 右侧结构化项目工作台”的正式演示入口。
- `/b-agent` 使用模拟数据展示产品事实提取、策略推荐、人工确认、首月计划和素材包预览。
- 增加 AI 赛 ABC 三组路由拆分规则，避免 `/agent` 被单一小组覆盖。
- 增加 B 组固定入口 `/b-agent`。
- 增加通用分组入口 `/agent`。
- 搭建 Next.js + TypeScript 中文后台系统骨架。
- 增加左侧导航、顶部 Workspace 切换和右侧内容区。
- 增加 Docker PostgreSQL 本地开发配置。
- 增加 Prisma schema、Foundation migration 和可重复 seed。
- 增加 User、Workspace、WorkspaceMember、Project、Product、ProjectProduct 最小模型。
- 增加 Workspace 级服务端数据隔离工具和基础测试。
- 增加项目创建、查看、编辑和关联产品能力。
- 增加产品创建、查看和编辑能力。
- 增加今日工作台、项目中心、产品大脑和 V1 导航占位路由。
- 增加可插拔图片生成接口和图层化视觉策略文档。

### Changed

- 更新 README、架构、开发计划和回滚文档，补充第一阶段启动、数据库和验证说明。

## [v0.0.1-initial] - 2026-07-17

### Added

- 初始化独立项目目录和 Git 仓库。
- 建立 `main` 稳定分支规则。
- 创建基础文件：`README.md`、`CHANGELOG.md`、`.gitignore`、`.env.example`。
- 创建规划文档：`docs/architecture.md`、`docs/development-plan.md`、`docs/rollback-guide.md`。
- 固化 Web-first、Feishu-connected 的架构原则。
- 固化阶段开发、数据库迁移、凭证管理和回滚原则。
