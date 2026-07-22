import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";
import { buildZipArchive, type ZipFileInput } from "./zip";

export type ContentPackageExportData = NonNullable<
  Awaited<ReturnType<typeof getContentPackageExportData>>
>;

export async function getContentPackageExportData(workspaceId: string, contentPackageId: string) {
  const contentPackage = await prisma.contentPackage.findFirst({
    where: scopedWhere(workspaceId, {
      id: contentPackageId,
    }),
    include: {
      project: {
        include: {
          projectProducts: {
            include: {
              product: {
                include: {
                  facts: {
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                  assets: {
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                },
              },
            },
          },
        },
      },
      strategy: true,
      files: {
        include: {
          asset: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!contentPackage) {
    return null;
  }

  const planItems = await prisma.contentPlanItem.findMany({
    where: scopedWhere(workspaceId, {
      projectId: contentPackage.projectId,
    }),
    orderBy: [
      {
        week: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  return {
    contentPackage,
    planItems,
  };
}

export function buildContentPackageZip(data: ContentPackageExportData) {
  return buildZipArchive(buildContentPackageExportFiles(data));
}

export function buildContentPackageExportFiles(data: ContentPackageExportData): ZipFileInput[] {
  const { contentPackage, planItems } = data;
  const products = contentPackage.project.projectProducts.map(({ product }) => product);
  const strategy = contentPackage.strategy;
  const channels = strategy?.channels.length ? strategy.channels : unique(planItems.map((item) => item.channel));
  const markets = strategy?.targetMarkets.length ? strategy.targetMarkets : ["待确认市场"];
  const contentDirections = strategy?.contentDirections.length
    ? strategy.contentDirections
    : unique(planItems.map((item) => item.theme));
  const approvedAssets = products.flatMap((product) =>
    product.assets.filter((asset) => asset.status === "APPROVED"),
  );

  return [
    {
      filename: "README-素材包说明.md",
      content: [
        `# ${contentPackage.name}`,
        "",
        `项目：${contentPackage.project.name}`,
        `周期：${contentPackage.period}`,
        `频率：${contentPackage.frequency}`,
        `状态：${contentPackage.status}`,
        "",
        "## 素材包摘要",
        contentPackage.summary ?? "暂无素材包摘要。",
        "",
        "## 目标市场",
        list(markets),
        "",
        "## 内容方向",
        list(contentDirections),
        "",
        "## 文件清单",
        list(contentPackage.files.map((file) => `${file.name}（${file.fileType} / ${file.status}）`)),
      ].join("\n"),
    },
    {
      filename: "content-calendar.csv",
      content: toCsv([
        ["week", "channel", "theme", "title", "deliverable", "status"],
        ...planItems.map((item) => [
          `第${item.week}周`,
          item.channel,
          item.theme,
          item.title,
          item.deliverable,
          item.status,
        ]),
      ]),
    },
    {
      filename: "platform-copy.txt",
      content: channels
        .map(
          (channel) =>
            [
              `【${channel}】`,
              `${contentPackage.project.name} 本周主线：${contentDirections[0] ?? "新品认知"}`,
              "请结合真实产品图和已确认卖点生成正式文案；当前文件为本地占位草稿。",
            ].join("\n"),
        )
        .join("\n\n"),
    },
    {
      filename: "hashtags.txt",
      content: [
        ...markets.map((market) => `#${market.replace(/\s+/g, "")}`),
        ...channels.map((channel) => `#${channel.replace(/\s+/g, "")}`),
        ...contentDirections.map((direction) => `#${direction.replace(/\s+/g, "")}`),
      ].join("\n"),
    },
    {
      filename: "tiktok-script.txt",
      content: [
        "TikTok 15 秒脚本草稿",
        "0-3s：用场景痛点开场。",
        "4-9s：展示真实产品图对应的核心卖点，不重绘产品。",
        "10-13s：加入本周活动或内容方向。",
        "14-15s：明确 CTA，引导评论、收藏或点击链接。",
      ].join("\n"),
    },
    {
      filename: "poster-brief.md",
      content: [
        "# 模板化海报 Brief",
        "",
        "- Background Layer：可使用品牌色、节日氛围或后续 AI 背景。",
        "- Product Layer：必须引用已审核真实产品图。",
        "- Text Layer：使用本素材包文案，不依赖图片模型生成文字。",
        "- Logo Layer：必须引用已审核官方 Logo。",
        "- Decoration Layer：只允许非产品装饰元素。",
        "",
        "## 已审核素材",
        approvedAssets.length > 0
          ? list(approvedAssets.map((asset) => `${asset.name}（${asset.kind}）`))
          : "- 暂无已审核素材，请先进入素材库完成审核。",
      ].join("\n"),
    },
    {
      filename: "brand-compliance-checklist.md",
      content: [
        "# 品牌与合规检查",
        "",
        "- [ ] 产品图来自用户上传或官方素材。",
        "- [ ] Logo 来自官方素材。",
        "- [ ] 没有 AI 重绘产品主体、改变结构或添加不存在的部件。",
        "- [ ] 产品名称、参数和卖点与产品事实一致。",
        "- [ ] 抽奖、促销和免责声明已人工审核。",
      ].join("\n"),
    },
    {
      filename: "manifest.json",
      content: JSON.stringify(
        {
          contentPackageId: contentPackage.id,
          projectId: contentPackage.projectId,
          strategyId: contentPackage.strategyId,
          exportedAt: new Date().toISOString(),
          files: contentPackage.files.map((file) => ({
            id: file.id,
            name: file.name,
            fileType: file.fileType,
            status: file.status,
            assetId: file.assetId,
          })),
        },
        null,
        2,
      ),
    },
  ];
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  const normalizedValue = value.replace(/\r?\n/g, " ");
  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function list(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- 待补充";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
