import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function RecapsPage() {
  return (
    <PlaceholderPage
      activePath="/recaps"
      description="后续会记录内容表现数据，并生成复盘报告和下一轮建议。"
      nextSteps={["建立数据快照", "支持手动录入或导入", "生成复盘摘要"]}
      title="数据复盘"
    />
  );
}

