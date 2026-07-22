# Changelog

所有重要变更都会记录在本文件中。

格式参考 Keep a Changelog，版本号遵循“阶段可用版本”的语义。

## [Unreleased]

### Added

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
