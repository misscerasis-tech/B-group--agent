import { PlaceholderPage } from "@/components/placeholder-page";

export const dynamic = "force-dynamic";

export default function PackagesPage() {
  return (
    <PlaceholderPage
      activePath="/packages"
      description="后续会生成 PDF、XLSX、DOCX、TXT 和 ZIP 素材包，并保存在独立系统。"
      nextSteps={["定义素材包结构", "生成可下载文件", "接入素材库与审核状态"]}
      title="素材包"
    />
  );
}

