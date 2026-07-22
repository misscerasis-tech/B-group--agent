import {
  AgentMessageRole,
  AgentOperationStatus,
  AssetKind,
  AssetSource,
  AssetStatus,
  ContentFrequency,
  ContentPackageStatus,
  ImageGenerationMode,
  ImageGenerationStatus,
  PackageFileStatus,
  PlanItemStatus,
  PrismaClient,
  ProductFactStatus,
  ProductStatus,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  StrategyStatus,
  WorkspaceRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      name: "演示用户",
    },
    create: {
      name: "演示用户",
      email: "demo@example.com",
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-growth-team" },
    update: {
      name: "演示增长团队",
      deletedAt: null,
    },
    create: {
      name: "演示增长团队",
      slug: "demo-growth-team",
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: WorkspaceRole.OWNER,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "demo-product-aurora-cup" },
    update: {
      workspaceId: workspace.id,
      name: "Aurora Cup 智能保温杯",
      description: "面向年轻通勤人群的智能温显保温杯，强调轻量、长效保温与礼品属性。",
      status: ProductStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      id: "demo-product-aurora-cup",
      workspaceId: workspace.id,
      name: "Aurora Cup 智能保温杯",
      description: "面向年轻通勤人群的智能温显保温杯，强调轻量、长效保温与礼品属性。",
      status: ProductStatus.ACTIVE,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project-brazil-launch" },
    update: {
      workspaceId: workspace.id,
      name: "巴西新品上市首月增长",
      description: "围绕 TikTok 与 Instagram 的新品上市内容测试项目。",
      status: ProjectStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      id: "demo-project-brazil-launch",
      workspaceId: workspace.id,
      name: "巴西新品上市首月增长",
      description: "围绕 TikTok 与 Instagram 的新品上市内容测试项目。",
      status: ProjectStatus.ACTIVE,
    },
  });

  await prisma.projectProduct.upsert({
    where: {
      projectId_productId: {
        projectId: project.id,
        productId: product.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      productId: product.id,
    },
  });

  const productFacts = [
    {
      id: "demo-fact-product-name",
      label: "产品名称",
      value: "Aurora Cup 智能温显保温杯",
      confidence: 96,
    },
    {
      id: "demo-fact-selling-points",
      label: "核心卖点",
      value: "温度显示、24 小时保温、防漏便携、礼品属性",
      confidence: 88,
    },
    {
      id: "demo-fact-scenes",
      label: "目标场景",
      value: "通勤、健身、办公桌、节日礼赠",
      confidence: 84,
    },
    {
      id: "demo-fact-visual-limits",
      label: "视觉限制",
      value: "正式视觉必须使用已审核真实产品图和官方 Logo，禁止 AI 重绘产品。",
      confidence: 100,
    },
  ];

  for (const fact of productFacts) {
    await prisma.productFact.upsert({
      where: { id: fact.id },
      update: {
        workspaceId: workspace.id,
        productId: product.id,
        label: fact.label,
        value: fact.value,
        confidence: fact.confidence,
        source: "seed",
        status: ProductFactStatus.CONFIRMED,
      },
      create: {
        id: fact.id,
        workspaceId: workspace.id,
        productId: product.id,
        label: fact.label,
        value: fact.value,
        confidence: fact.confidence,
        source: "seed",
        status: ProductFactStatus.CONFIRMED,
      },
    });
  }

  const strategy = await prisma.projectStrategy.upsert({
    where: { id: "demo-strategy-brazil-v1" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      version: 1,
      status: StrategyStatus.DRAFT,
      targetMarkets: ["巴西"],
      audiences: ["20-35 岁通勤人群", "健身用户", "礼品购买者"],
      channels: ["TikTok", "Instagram", "Facebook"],
      contentDirections: ["温度可视化", "通勤效率", "节日礼赠", "小抽奖活动"],
      packageFrequency: ContentFrequency.WEEKLY,
      positioning: "把智能温显从技术点转译成通勤、健身和礼赠场景中的日常便利。",
      rationale: "TikTok 做发现，Instagram 做视觉背书，Facebook 做活动扩散。",
      confirmedAt: null,
    },
    create: {
      id: "demo-strategy-brazil-v1",
      workspaceId: workspace.id,
      projectId: project.id,
      version: 1,
      status: StrategyStatus.DRAFT,
      targetMarkets: ["巴西"],
      audiences: ["20-35 岁通勤人群", "健身用户", "礼品购买者"],
      channels: ["TikTok", "Instagram", "Facebook"],
      contentDirections: ["温度可视化", "通勤效率", "节日礼赠", "小抽奖活动"],
      packageFrequency: ContentFrequency.WEEKLY,
      positioning: "把智能温显从技术点转译成通勤、健身和礼赠场景中的日常便利。",
      rationale: "TikTok 做发现，Instagram 做视觉背书，Facebook 做活动扩散。",
    },
  });

  const planItems = [
    {
      id: "demo-plan-week-1",
      week: 1,
      channel: "TikTok",
      theme: "新品认知",
      title: "温显功能 15 秒短视频",
      deliverable: "短视频脚本、发布配文、竖版海报",
    },
    {
      id: "demo-plan-week-2",
      week: 2,
      channel: "Instagram",
      theme: "场景种草",
      title: "通勤与健身场景图文",
      deliverable: "轮播文案、方图海报、Hashtags",
    },
    {
      id: "demo-plan-week-3",
      week: 3,
      channel: "Facebook",
      theme: "礼品转化",
      title: "节日礼赠与小抽奖活动",
      deliverable: "互动贴、活动规则草案、礼品海报",
    },
    {
      id: "demo-plan-week-4",
      week: 4,
      channel: "TikTok",
      theme: "复盘加码",
      title: "高表现内容二创与 FAQ",
      deliverable: "二创脚本、FAQ 图文、下月建议",
    },
  ];

  for (const item of planItems) {
    await prisma.contentPlanItem.upsert({
      where: { id: item.id },
      update: {
        workspaceId: workspace.id,
        projectId: project.id,
        strategyId: strategy.id,
        week: item.week,
        channel: item.channel,
        theme: item.theme,
        title: item.title,
        deliverable: item.deliverable,
        status: PlanItemStatus.READY,
      },
      create: {
        id: item.id,
        workspaceId: workspace.id,
        projectId: project.id,
        strategyId: strategy.id,
        week: item.week,
        channel: item.channel,
        theme: item.theme,
        title: item.title,
        deliverable: item.deliverable,
        status: PlanItemStatus.READY,
      },
    });
  }

  const contentPackage = await prisma.contentPackage.upsert({
    where: { id: "demo-package-week-1" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      strategyId: strategy.id,
      name: "巴西首月第 1 周素材包",
      period: "首月第 1 周",
      frequency: ContentFrequency.WEEKLY,
      status: ContentPackageStatus.DRAFT,
      summary:
        "围绕新品认知生成说明、排期、平台文案、Hashtags、TikTok 脚本、发布配文、模板化海报和 ZIP 清单。",
    },
    create: {
      id: "demo-package-week-1",
      workspaceId: workspace.id,
      projectId: project.id,
      strategyId: strategy.id,
      name: "巴西首月第 1 周素材包",
      period: "首月第 1 周",
      frequency: ContentFrequency.WEEKLY,
      status: ContentPackageStatus.DRAFT,
      summary:
        "围绕新品认知生成说明、排期、平台文案、Hashtags、TikTok 脚本、发布配文、模板化海报和 ZIP 清单。",
    },
  });

  const packageFiles = [
    ["demo-package-file-summary", "素材包说明 PDF", "PDF"],
    ["demo-package-file-calendar", "内容排期 XLSX", "XLSX"],
    ["demo-package-file-copy", "平台文案 DOCX", "DOCX"],
    ["demo-package-file-hashtags", "Hashtags TXT", "TXT"],
    ["demo-package-file-tiktok", "TikTok 视频脚本 DOCX", "DOCX"],
    ["demo-package-file-caption", "发布配文 TXT", "TXT"],
    ["demo-package-file-poster", "模板化海报图片", "PNG"],
    ["demo-package-file-brief", "设计 Brief PDF", "PDF"],
    ["demo-package-file-zip", "最终 ZIP 打包下载", "ZIP"],
  ];

  for (const [id, name, fileType] of packageFiles) {
    await prisma.contentPackageFile.upsert({
      where: { id },
      update: {
        contentPackageId: contentPackage.id,
        name,
        fileType,
        status: PackageFileStatus.PLANNED,
      },
      create: {
        id,
        contentPackageId: contentPackage.id,
        name,
        fileType,
        status: PackageFileStatus.PLANNED,
      },
    });
  }

  await prisma.reminder.upsert({
    where: { id: "demo-reminder-prize-rules" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      title: "小抽奖活动需要提前准备奖品和规则",
      description: "第 3 周计划包含 Facebook 小抽奖，发布前需要确认奖品、参与门槛和免责声明。",
      severity: ReminderSeverity.WARNING,
      status: ReminderStatus.OPEN,
    },
    create: {
      id: "demo-reminder-prize-rules",
      workspaceId: workspace.id,
      projectId: project.id,
      title: "小抽奖活动需要提前准备奖品和规则",
      description: "第 3 周计划包含 Facebook 小抽奖，发布前需要确认奖品、参与门槛和免责声明。",
      severity: ReminderSeverity.WARNING,
      status: ReminderStatus.OPEN,
    },
  });

  const conversation = await prisma.agentConversation.upsert({
    where: { id: "demo-conversation-brazil-launch" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      title: "巴西新品上市首月增长顾问",
    },
    create: {
      id: "demo-conversation-brazil-launch",
      workspaceId: workspace.id,
      projectId: project.id,
      title: "巴西新品上市首月增长顾问",
    },
  });

  await prisma.agentMessage.upsert({
    where: { id: "demo-message-user-1" },
    update: {
      workspaceId: workspace.id,
      conversationId: conversation.id,
      role: AgentMessageRole.USER,
      content: "我们要给一款智能温显保温杯做巴西市场首月内容增长，产品图和官方 Logo 已经有了。",
    },
    create: {
      id: "demo-message-user-1",
      workspaceId: workspace.id,
      conversationId: conversation.id,
      role: AgentMessageRole.USER,
      content: "我们要给一款智能温显保温杯做巴西市场首月内容增长，产品图和官方 Logo 已经有了。",
    },
  });

  await prisma.agentMessage.upsert({
    where: { id: "demo-message-agent-1" },
    update: {
      workspaceId: workspace.id,
      conversationId: conversation.id,
      role: AgentMessageRole.ASSISTANT,
      content:
        "我已提取产品事实并生成巴西首月策略草案。正式视觉会锁定真实产品图和官方 Logo，AI 只用于背景、场景和非产品装饰。",
    },
    create: {
      id: "demo-message-agent-1",
      workspaceId: workspace.id,
      conversationId: conversation.id,
      role: AgentMessageRole.ASSISTANT,
      content:
        "我已提取产品事实并生成巴西首月策略草案。正式视觉会锁定真实产品图和官方 Logo，AI 只用于背景、场景和非产品装饰。",
    },
  });

  await prisma.agentOperation.upsert({
    where: { id: "demo-operation-channel-frequency" },
    update: {
      workspaceId: workspace.id,
      conversationId: conversation.id,
      projectId: project.id,
      rawText: "巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。",
      summary: "删除 LinkedIn，新增 TikTok，素材包频率改为每周一次。",
      operations: [
        { type: "remove_channel", value: "LinkedIn" },
        { type: "add_channel", value: "TikTok" },
        { type: "set_package_frequency", value: "WEEKLY" },
      ],
      conflictCheck: "当前策略仍为草案，可直接应用。",
      status: AgentOperationStatus.APPLIED,
    },
    create: {
      id: "demo-operation-channel-frequency",
      workspaceId: workspace.id,
      conversationId: conversation.id,
      projectId: project.id,
      rawText: "巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。",
      summary: "删除 LinkedIn，新增 TikTok，素材包频率改为每周一次。",
      operations: [
        { type: "remove_channel", value: "LinkedIn" },
        { type: "add_channel", value: "TikTok" },
        { type: "set_package_frequency", value: "WEEKLY" },
      ],
      conflictCheck: "当前策略仍为草案，可直接应用。",
      status: AgentOperationStatus.APPLIED,
    },
  });

  await prisma.changeLog.upsert({
    where: { id: "demo-change-log-seed" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      entityType: "ProjectStrategy",
      entityId: strategy.id,
      action: "seed",
      summary: "初始化 B 组工作助手演示数据。",
      actorUserId: user.id,
    },
    create: {
      id: "demo-change-log-seed",
      workspaceId: workspace.id,
      projectId: project.id,
      entityType: "ProjectStrategy",
      entityId: strategy.id,
      action: "seed",
      summary: "初始化 B 组工作助手演示数据。",
      actorUserId: user.id,
    },
  });

  const productImageAsset = await prisma.asset.upsert({
    where: { id: "demo-asset-aurora-product-image" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      productId: product.id,
      name: "Aurora Cup 真实产品图",
      kind: AssetKind.PRODUCT_IMAGE,
      source: AssetSource.IMPORTED,
      status: AssetStatus.APPROVED,
      mimeType: "image/png",
      originalFilename: "aurora-cup-product.png",
      storagePath: null,
      metadata: {
        visualRole: "Product Layer",
        productSubjectLocked: true,
        note: "Seed 示例记录，不包含真实文件；正式使用时由用户上传。",
      },
    },
    create: {
      id: "demo-asset-aurora-product-image",
      workspaceId: workspace.id,
      projectId: project.id,
      productId: product.id,
      name: "Aurora Cup 真实产品图",
      kind: AssetKind.PRODUCT_IMAGE,
      source: AssetSource.IMPORTED,
      status: AssetStatus.APPROVED,
      mimeType: "image/png",
      originalFilename: "aurora-cup-product.png",
      metadata: {
        visualRole: "Product Layer",
        productSubjectLocked: true,
        note: "Seed 示例记录，不包含真实文件；正式使用时由用户上传。",
      },
    },
  });

  const logoAsset = await prisma.asset.upsert({
    where: { id: "demo-asset-aurora-logo" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      productId: product.id,
      name: "Aurora Cup 官方 Logo",
      kind: AssetKind.LOGO,
      source: AssetSource.IMPORTED,
      status: AssetStatus.APPROVED,
      mimeType: "image/svg+xml",
      originalFilename: "aurora-logo.svg",
      storagePath: null,
      metadata: {
        visualRole: "Logo Layer",
        productSubjectLocked: true,
        note: "Seed 示例记录，不包含真实文件；正式使用时由用户上传。",
      },
    },
    create: {
      id: "demo-asset-aurora-logo",
      workspaceId: workspace.id,
      projectId: project.id,
      productId: product.id,
      name: "Aurora Cup 官方 Logo",
      kind: AssetKind.LOGO,
      source: AssetSource.IMPORTED,
      status: AssetStatus.APPROVED,
      mimeType: "image/svg+xml",
      originalFilename: "aurora-logo.svg",
      metadata: {
        visualRole: "Logo Layer",
        productSubjectLocked: true,
        note: "Seed 示例记录，不包含真实文件；正式使用时由用户上传。",
      },
    },
  });

  const openAiImageProvider = await prisma.imageGenerationProviderConfig.upsert({
    where: { id: "demo-image-provider-openai" },
    update: {
      workspaceId: workspace.id,
      provider: "openai",
      displayName: "OpenAI Image API 候选",
      defaultModel: "workspace-configured",
      enabled: false,
      capabilities: ["background_generation", "image_edit", "image_expand"],
      notes: "候选供应商记录，不代表最终选型；密钥不得进入数据库 seed。",
    },
    create: {
      id: "demo-image-provider-openai",
      workspaceId: workspace.id,
      provider: "openai",
      displayName: "OpenAI Image API 候选",
      defaultModel: "workspace-configured",
      enabled: false,
      capabilities: ["background_generation", "image_edit", "image_expand"],
      notes: "候选供应商记录，不代表最终选型；密钥不得进入数据库 seed。",
    },
  });

  await prisma.imageGenerationProviderConfig.upsert({
    where: { id: "demo-image-provider-firefly" },
    update: {
      workspaceId: workspace.id,
      provider: "adobe-firefly",
      displayName: "Adobe Firefly 候选",
      defaultModel: "workspace-configured",
      enabled: false,
      capabilities: ["background_generation", "image_edit"],
      notes: "候选供应商记录，不代表最终选型；密钥不得进入数据库 seed。",
    },
    create: {
      id: "demo-image-provider-firefly",
      workspaceId: workspace.id,
      provider: "adobe-firefly",
      displayName: "Adobe Firefly 候选",
      defaultModel: "workspace-configured",
      enabled: false,
      capabilities: ["background_generation", "image_edit"],
      notes: "候选供应商记录，不代表最终选型；密钥不得进入数据库 seed。",
    },
  });

  await prisma.imageGenerationJob.upsert({
    where: { id: "demo-image-job-template-poster" },
    update: {
      workspaceId: workspace.id,
      projectId: project.id,
      providerConfigId: openAiImageProvider.id,
      provider: "template-composer",
      model: "local-template-v1",
      promptVersion: "poster-template-v1",
      sourceAssetIds: [productImageAsset.id, logoAsset.id],
      generationMode: ImageGenerationMode.TEMPLATE_COMPOSITION,
      aspectRatio: "4:5",
      status: ImageGenerationStatus.QUEUED,
      error: null,
    },
    create: {
      id: "demo-image-job-template-poster",
      workspaceId: workspace.id,
      projectId: project.id,
      providerConfigId: openAiImageProvider.id,
      provider: "template-composer",
      model: "local-template-v1",
      promptVersion: "poster-template-v1",
      sourceAssetIds: [productImageAsset.id, logoAsset.id],
      generationMode: ImageGenerationMode.TEMPLATE_COMPOSITION,
      aspectRatio: "4:5",
      status: ImageGenerationStatus.QUEUED,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
