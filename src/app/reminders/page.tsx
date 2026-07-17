import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function RemindersPage() {
  return (
    <PlaceholderPage
      activePath="/reminders"
      description="后续会基于时间、状态、内容缺口、风险和机会主动生成提醒。"
      nextSteps={["定义提醒规则", "加入后台任务", "支持通知渠道配置"]}
      title="提醒中心"
    />
  );
}

