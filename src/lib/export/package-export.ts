import { readFile } from "node:fs/promises";
import { buildContentPackageReadiness } from "@/lib/content-package-readiness";
import { resolveLocalAssetPath } from "@/lib/data/assets";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";
import { buildSimpleDocx, buildSimplePdf, buildSimpleXlsx } from "./document-generators";
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
          assets: {
            orderBy: {
              createdAt: "asc",
            },
          },
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

export async function buildContentPackageZip(data: ContentPackageExportData) {
  return buildZipArchive([
    ...buildContentPackageExportFiles(data),
    ...(await buildLinkedAssetExportFiles(data)),
  ]);
}

export function buildContentPackageExportFiles(data: ContentPackageExportData): ZipFileInput[] {
  const { contentPackage, planItems } = data;
  const products = contentPackage.project.projectProducts.map(({ product }) => product);
  const sourceAssets = [
    ...contentPackage.project.assets,
    ...products.flatMap((product) => product.assets),
  ];
  const approvedAssets = sourceAssets.filter((asset) => asset.status === "APPROVED");
  const readiness = buildContentPackageReadiness({
    ...contentPackage,
    sourceAssets: approvedAssets,
  });
  const strategy = contentPackage.strategy;
  const channels = strategy?.channels.length
    ? strategy.channels
    : unique(planItems.map((item) => item.channel));
  const markets = strategy?.targetMarkets.length ? strategy.targetMarkets : ["待确认市场"];
  const contentDirections = strategy?.contentDirections.length
    ? strategy.contentDirections
    : unique(planItems.map((item) => item.theme));
  const linkedPackageFiles = contentPackage.files.filter((file) => file.asset);
  const calendarRows = [
    ["周次", "截止日期", "渠道", "主题", "标题", "交付物", "状态"],
    ...planItems.map((item) => [
      `第${item.week}周`,
      item.dueDate ? item.dueDate.toISOString().slice(0, 10) : "",
      item.channel,
      item.theme,
      item.title,
      item.deliverable,
      item.status,
    ]),
  ];
  const packageSummaryLines = [
    `项目：${contentPackage.project.name}`,
    `周期：${contentPackage.period}`,
    `频率：${contentPackage.frequency}`,
    `状态：${contentPackage.status}`,
    `摘要：${contentPackage.summary ?? "暂无素材包摘要。"}`,
    `目标市场：${markets.join("、")}`,
    `内容方向：${contentDirections.join("、") || "待补充"}`,
  ];
  const platformCopyParagraphs = channels.flatMap((channel) => [
    `【${channel}】`,
    `${contentPackage.project.name} 本周主线：${contentDirections[0] ?? "新品认知"}`,
    `面向${markets.join("、")}市场，突出${productFactHighlights(products).join("、") || "已确认产品卖点"}。`,
    "正式发布前请复核产品参数、活动规则和平台合规要求。",
  ]);
  const posterCopyParagraphs = [
    "主标题：新品内容增长素材",
    `副标题：面向${markets.join("、")}的${contentDirections[0] ?? "新品认知"}主题`,
    `卖点：${productFactHighlights(products).join(" / ") || "请补充已确认卖点"}`,
    "按钮文案：了解更多",
    "注意：海报文字由系统排版层生成，不交给图片模型自由生成。",
  ];
  const designBriefLines = [
    "Background Layer：可使用品牌色、节日氛围或后续 AI 背景。",
    "Product Layer：必须引用已审核真实产品图，保持产品主体锁定。",
    "Text Layer：使用本素材包文案，不依赖图片模型生成文字。",
    "Logo Layer：必须引用已审核官方 Logo。",
    "Decoration Layer：只允许非产品装饰元素。",
    `已审核素材：${
      approvedAssets.length > 0
        ? approvedAssets.map((asset) => `${asset.name}（${asset.kind}）`).join("、")
        : "暂无，请先进入素材库完成审核。"
    }`,
  ];
  const complianceLines = [
    "产品图来自用户上传或官方素材。",
    "Logo 来自官方素材。",
    "没有 AI 重绘产品主体、改变结构或添加不存在的部件。",
    "产品名称、参数和卖点与产品事实一致。",
    "抽奖、促销和免责声明已人工审核。",
  ];
  const manifestStrategy = strategy
    ? {
        id: strategy.id,
        version: strategy.version,
        status: strategy.status,
        targetMarkets: strategy.targetMarkets,
        audiences: strategy.audiences,
        channels: strategy.channels,
        contentDirections: strategy.contentDirections,
        packageFrequency: strategy.packageFrequency,
      }
    : null;
  const manifestPlanItems = planItems.map((item) => ({
    id: item.id,
    week: item.week,
    dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null,
    channel: item.channel,
    theme: item.theme,
    title: item.title,
    deliverable: item.deliverable,
    status: item.status,
  }));
  const manifestProductFacts = products.flatMap((product) =>
    product.facts.map((fact) => ({
      productId: product.id,
      productName: product.name,
      factId: fact.id,
      label: fact.label,
      value: fact.value,
      source: fact.source,
      confidence: fact.confidence,
      status: fact.status,
    })),
  );
  const manifestApprovedAssets = approvedAssets.map((asset) => ({
    id: asset.id,
    projectId: asset.projectId,
    productId: asset.productId,
    name: asset.name,
    kind: asset.kind,
    source: asset.source,
    status: asset.status,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename,
    checksum: asset.checksum,
  }));
  const manifestReadiness = {
    score: readiness.score,
    rating: readiness.rating,
    summary: readiness.summary,
    signals: readiness.signals.map((signal) => ({
      key: signal.key,
      label: signal.label,
      status: signal.status,
      summary: signal.summary,
      action: signal.action,
      blocking: signal.blocking,
    })),
  };
  const manualReviewChecklist = buildManualReviewChecklist({
    packageName: contentPackage.name,
    projectName: contentPackage.project.name,
    period: contentPackage.period,
    markets,
    channels,
    contentDirections,
    productFacts: manifestProductFacts,
    approvedAssets: manifestApprovedAssets,
    readiness: manifestReadiness,
  });

  return [
    {
      filename: "00-交付检查.txt",
      content: [
        `素材包：${readiness.packageName}`,
        `可交付性：${readiness.score} 分`,
        `状态：${readiness.rating}`,
        `摘要：${readiness.summary}`,
        "",
        "检查项：",
        ...readiness.signals.map(
          (signal) => `- ${signal.label}：${signal.summary}；下一步：${signal.action}`,
        ),
      ].join("\n"),
    },
    {
      filename: "01-素材包说明.pdf",
      content: buildSimplePdf({
        title: contentPackage.name,
        lines: packageSummaryLines,
      }),
    },
    {
      filename: "02-内容排期.xlsx",
      content: buildSimpleXlsx({
        sheetName: "内容排期",
        rows: calendarRows,
      }),
    },
    {
      filename: "03-平台文案.docx",
      content: buildSimpleDocx({
        title: "平台文案",
        paragraphs: platformCopyParagraphs,
      }),
    },
    {
      filename: "04-Hashtags.txt",
      content: [
        ...markets.map((market) => `#${market.replace(/\s+/g, "")}`),
        ...channels.map((channel) => `#${channel.replace(/\s+/g, "")}`),
        ...contentDirections.map((direction) => `#${direction.replace(/\s+/g, "")}`),
      ].join("\n"),
    },
    {
      filename: "05-TikTok视频脚本.docx",
      content: buildSimpleDocx({
        title: "TikTok 视频脚本",
        paragraphs: [
          "0-3s：用场景痛点开场。",
          "4-9s：展示真实产品图对应的核心卖点，不重绘产品。",
          "10-13s：加入本周活动或内容方向。",
          "14-15s：明确 CTA，引导评论、收藏或点击链接。",
        ],
      }),
    },
    {
      filename: "06-发布配文.txt",
      content: channels
        .map(
          (channel) =>
            [
              `【${channel}】`,
              `${contentPackage.project.name} 本周主线：${contentDirections[0] ?? "新品认知"}`,
              `适用市场：${markets.join("、")}`,
              "发布前请确认产品参数、活动规则、落地页链接和素材授权。",
            ].join("\n"),
        )
        .join("\n\n"),
    },
    {
      filename: "08-海报文案.docx",
      content: buildSimpleDocx({
        title: "海报文案",
        paragraphs: posterCopyParagraphs,
      }),
    },
    {
      filename: "09-设计Brief.pdf",
      content: buildSimplePdf({
        title: "设计 Brief",
        lines: designBriefLines,
      }),
    },
    {
      filename: "10-品牌与合规检查.pdf",
      content: buildSimplePdf({
        title: "品牌与合规检查",
        lines: complianceLines.map((line) => `□ ${line}`),
      }),
    },
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
        list(
          contentPackage.files.map((file) =>
            [
              `${file.name}（${file.fileType} / ${file.status}）`,
              file.asset ? `关联素材：${file.asset.name}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        ),
        "",
        "## 已关联素材",
        linkedPackageFiles.length > 0
          ? list(
              linkedPackageFiles.map(
                (file) =>
                  `${file.name} -> ${file.asset?.name}（${file.asset?.kind} / ${file.asset?.source}）`,
              ),
            )
          : "- 暂无文件项关联素材。",
      ].join("\n"),
    },
    {
      filename: "manual-review-checklist.md",
      content: manualReviewChecklist,
    },
    {
      filename: "content-calendar.csv",
      content: toCsv(calendarRows),
    },
    {
      filename: "platform-copy.txt",
      content: platformCopyParagraphs.join("\n"),
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
      filename: "poster-copy.txt",
      content: posterCopyParagraphs.join("\n"),
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
          schemaVersion: "b-agent-content-package.v1",
          contentPackageId: contentPackage.id,
          projectId: contentPackage.projectId,
          strategyId: contentPackage.strategyId,
          exportedAt: new Date().toISOString(),
          strategy: manifestStrategy,
          productFacts: manifestProductFacts,
          planItems: manifestPlanItems,
          approvedAssets: manifestApprovedAssets,
          readiness: manifestReadiness,
          generatedFiles: [
            "01-素材包说明.pdf",
            "02-内容排期.xlsx",
            "03-平台文案.docx",
            "04-Hashtags.txt",
            "05-TikTok视频脚本.docx",
            "06-发布配文.txt",
            "linked-assets/07-关联素材",
            "08-海报文案.docx",
            "09-设计Brief.pdf",
            "10-品牌与合规检查.pdf",
            "README-素材包说明.md",
            "manual-review-checklist.md",
            "content-calendar.csv",
            "platform-copy.txt",
            "hashtags.txt",
            "tiktok-script.txt",
            "poster-copy.txt",
            "poster-brief.md",
            "brand-compliance-checklist.md",
          ],
          files: contentPackage.files.map((file) => ({
            id: file.id,
            name: file.name,
            fileType: file.fileType,
            status: file.status,
            assetId: file.assetId,
            asset: file.asset
              ? {
                  id: file.asset.id,
                  name: file.asset.name,
                  kind: file.asset.kind,
                  source: file.asset.source,
                  status: file.asset.status,
                  mimeType: file.asset.mimeType,
                  originalFilename: file.asset.originalFilename,
                  checksum: file.asset.checksum,
                }
              : null,
          })),
        },
        null,
        2,
      ),
    },
  ];
}

async function buildLinkedAssetExportFiles(data: ContentPackageExportData): Promise<ZipFileInput[]> {
  const exportedAssets = new Set<string>();
  const files: ZipFileInput[] = [];
  const missingAssets: string[] = [];

  for (const [index, packageFile] of data.contentPackage.files.entries()) {
    const asset = packageFile.asset;

    if (!asset?.storagePath || exportedAssets.has(asset.id)) {
      continue;
    }

    try {
      const assetPath = resolveLocalAssetPath(asset.storagePath);
      files.push({
        filename: `linked-assets/${String(index + 1).padStart(2, "0")}-${safeExportName(
          packageFile.name,
        )}-${safeExportName(asset.originalFilename ?? asset.name)}`,
        content: await readFile(assetPath),
      });
      exportedAssets.add(asset.id);
    } catch (error) {
      missingAssets.push(`${packageFile.name} -> ${asset.name}: ${toErrorMessage(error)}`);
    }
  }

  if (missingAssets.length > 0) {
    files.push({
      filename: "linked-assets/MISSING_ASSETS.txt",
      content: [
        "以下已关联素材无法读取，ZIP 中已保留 manifest 和文件项记录。",
        ...missingAssets.map((asset) => `- ${asset}`),
      ].join("\n"),
    });
  }

  return files;
}

function productFactHighlights(
  products: Array<{
    facts: Array<{
      label: string;
      value: string;
      status: string;
    }>;
  }>,
) {
  return unique(
    products.flatMap((product) =>
      product.facts
        .filter(
          (fact) =>
            fact.status === "CONFIRMED" &&
            /卖点|优势|场景|规格|参数|人群|合规/.test(fact.label),
        )
        .map((fact) => fact.value),
    ),
  ).slice(0, 4);
}

function buildManualReviewChecklist(input: {
  packageName: string;
  projectName: string;
  period: string;
  markets: string[];
  channels: string[];
  contentDirections: string[];
  productFacts: Array<{
    productName: string;
    label: string;
    value: string;
    source: string | null;
    status: string;
  }>;
  approvedAssets: Array<{
    name: string;
    kind: string;
    source: string;
    status: string;
    originalFilename: string | null;
    checksum: string | null;
  }>;
  readiness: {
    score: number;
    rating: string;
    summary: string;
    signals: Array<{
      label: string;
      summary: string;
      action: string;
      blocking: boolean;
    }>;
  };
}) {
  const blockingSignals = input.readiness.signals.filter((signal) => signal.blocking);

  return [
    `# ${input.packageName} 人工审核清单`,
    "",
    `项目：${input.projectName}`,
    `周期：${input.period}`,
    `目标市场：${input.markets.join("、")}`,
    `渠道：${input.channels.join("、") || "待补充"}`,
    `内容方向：${input.contentDirections.join("、") || "待补充"}`,
    `交付体检：${input.readiness.score} 分 / ${input.readiness.rating}`,
    input.readiness.summary,
    "",
    "## 发布前必须确认",
    "- [ ] 产品图来源真实可信，且没有被图片模型重绘或替换。",
    "- [ ] 官方 Logo 来源已确认，未被模型改写、拉伸或错色。",
    "- [ ] 产品名称、规格参数、卖点、适用场景与已确认产品事实一致。",
    "- [ ] 抽奖、促销、免责声明、价格和平台合规要求已由人工复核。",
    "- [ ] 海报文字来自排版层或文案文件，不依赖图片模型生成正文。",
    "",
    "## 产品事实核对",
    input.productFacts.length > 0
      ? list(
          input.productFacts.map(
            (fact) =>
              `${fact.productName} · ${fact.label}：${fact.value}（${fact.status}${
                fact.source ? ` / ${fact.source}` : ""
              }）`,
          ),
        )
      : "- 暂无产品事实，请先在产品大脑补齐并确认。",
    "",
    "## 已审核素材核对",
    input.approvedAssets.length > 0
      ? list(
          input.approvedAssets.map(
            (asset) =>
              `${asset.name}（${asset.kind} / ${asset.source} / ${asset.status}${
                asset.originalFilename ? ` / ${asset.originalFilename}` : ""
              }${asset.checksum ? ` / ${asset.checksum}` : ""}）`,
          ),
        )
      : "- 暂无已审核素材，请先上传真实产品图和官方 Logo 并通过审核。",
    "",
    "## 当前阻塞项",
    blockingSignals.length > 0
      ? list(blockingSignals.map((signal) => `${signal.label}：${signal.summary}；下一步：${signal.action}`))
      : "- 暂无阻塞项，可进入人工终审。",
  ].join("\n");
}

function safeExportName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知读取错误";
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
