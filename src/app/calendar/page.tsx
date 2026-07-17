import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <PlaceholderPage
      activePath="/calendar"
      description="后续会按正式策略生成首月内容计划，并支持周期性素材包节奏。"
      nextSteps={["接入策略版本", "生成平台排期", "支持按周或按月查看内容日历"]}
      title="内容日历"
    />
  );
}

