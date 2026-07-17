import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <PlaceholderPage
      activePath="/integrations"
      description="飞书只作为可插拔连接，用于通知、简单审核和结果沉淀，不作为系统底座。"
      nextSteps={["Workspace 级连接配置", "测试连接与换绑", "保存迁移记录"]}
      title="集成设置"
    />
  );
}

