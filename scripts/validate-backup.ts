import { readFile } from "node:fs/promises";
import { validateWorkspaceBackupEnvelope } from "../src/lib/export/workspace-backup-validate";

void main();

async function main() {
  const filePath = process.argv.slice(2).find((arg) => arg !== "--");

  if (!filePath) {
    console.error("请提供 Workspace 备份 JSON 文件路径。");
    console.error("用法：npx pnpm@10.13.1 run backup:validate -- backups/workspace.json");
    process.exit(1);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error("无法读取或解析 JSON 文件。");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const result = validateWorkspaceBackupEnvelope(parsed);

  console.log("B 组 Workspace 备份校验");
  console.log(`文件：${filePath}`);
  console.log(`schemaVersion：${result.schemaVersion ?? "缺失"}`);
  console.log(`workspaceId：${result.workspaceId ?? "缺失"}`);
  console.log("");

  console.log("数据计数：");
  for (const [key, count] of Object.entries(result.counts)) {
    console.log(`- ${key}: ${count}`);
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("警告：");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.issues.length > 0) {
    console.log("");
    console.log("未通过：");
    for (const issue of result.issues) {
      console.log(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("备份校验通过。该文件可用于演示核对和辅助恢复；真实数据库恢复仍以 pg_dump 为准。");
}
