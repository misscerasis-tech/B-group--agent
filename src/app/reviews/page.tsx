import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  return (
    <PlaceholderPage
      activePath="/reviews"
      description="后续会承接策略确认、素材包审核、品牌与合规检查。"
      nextSteps={["建立审核任务", "记录人工确认", "为飞书简单审核预留连接"]}
      title="审核中心"
    />
  );
}

