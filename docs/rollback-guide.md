# 回滚指南

本项目必须保证所有可用阶段都能通过 Git commit 或 Git Tag 回滚。

## 回到上一稳定版本

1. 检查当前状态：

   ```bash
   git status
   ```

2. 如果有未提交修改，先创建安全分支：

   ```bash
   git switch -c backup/before-rollback-YYYYMMDD-HHMM
   git add .
   git commit -m "chore: backup before rollback"
   ```

3. 查看可用稳定 Tag：

   ```bash
   git tag --list --sort=-creatordate
   ```

4. 切回 `main` 并确认目标版本：

   ```bash
   git switch main
   git log --oneline --decorate -n 10
   ```

5. 推荐做法是从目标 Tag 创建回滚验证分支：

   ```bash
   git switch -c rollback/v0.1.0-foundation v0.1.0-foundation
   ```

6. 在回滚分支运行测试和本地启动验证，确认无误后再决定是否重新部署该版本。

## 使用 Git Tag 恢复

查看 Tag：

```bash
git tag --list
```

检出某个稳定版本进行验证：

```bash
git switch --detach v0.1.0-foundation
```

从稳定版本创建修复分支：

```bash
git switch -c hotfix/from-v0.1.0-foundation v0.1.0-foundation
```

如果必须让 `main` 回到某个 Tag，必须先确认已经备份当前状态，并记录原因。生产项目中优先使用“从 Tag 重新部署旧版本”，不要随意改写已共享历史。

## 恢复数据库

数据库恢复必须遵循“先备份，再迁移，再验证”的原则。

上线前：

- 导出数据库备份。
- 记录当前应用 commit 和 Tag。
- 记录当前数据库迁移版本。
- 准备迁移回滚脚本或恢复备份方案。

推荐备份命令示例：

```bash
pg_dump "$DATABASE_URL" > backups/backup-YYYYMMDD-HHMM.sql
```

恢复备份示例：

```bash
psql "$DATABASE_URL" < backups/backup-YYYYMMDD-HHMM.sql
```

注意：

- 备份文件可能包含敏感数据，不得提交到 Git。
- 危险迁移包括删除字段、重命名字段、修改枚举、批量改写数据、删除表。
- 危险迁移必须先在测试环境演练。
- 如果应用代码回滚到旧版本，数据库结构也必须与旧版本兼容。
- 对象存储中的素材文件也需要保留版本或备份策略。

## 环境变量处理

- `.env.example` 只记录变量名和占位值。
- `.env` 不得提交到 Git。
- 回滚旧版本时，先对照该版本的 `.env.example` 检查变量是否缺失或废弃。
- 飞书 App Secret、AI Key、对象存储密钥等必须保存在部署平台或密钥管理服务中。
- 更换飞书组织时，旧连接必须停用并保存迁移记录，不得直接覆盖历史记录。

## 重新部署旧版本

1. 确认目标 Tag：

   ```bash
   git tag --list
   ```

2. 检出目标版本：

   ```bash
   git switch --detach v0.1.0-foundation
   ```

3. 安装依赖并运行测试。

4. 对照 `.env.example` 检查部署环境变量。

5. 确认数据库迁移版本与应用版本兼容。

6. 使用部署平台重新部署该 commit 或 Tag。

7. 部署后执行冒烟测试：

   - Web 页面可访问。
   - 登录或基础访问正常。
   - 核心数据可读取。
   - 后台任务无明显错误。
   - 飞书未连接时核心业务仍可运行。

## 回滚汇报模板

每次回滚必须记录：

- 回滚原因。
- 回滚前 commit 和 Tag。
- 回滚目标 commit 和 Tag。
- 数据库是否恢复。
- 环境变量是否变化。
- 部署时间。
- 验证结果。

