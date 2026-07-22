import {
  AssetKind,
  AssetStatus,
  ContentPackageStatus,
  PackageFileStatus,
} from "@prisma/client";

export type ContentPackageReadinessRating = "READY_TO_EXPORT" | "NEEDS_WORK" | "BLOCKED";
export type ContentPackageReadinessSignalStatus = "complete" | "warning" | "missing";

export type ContentPackageReadinessSignal = {
  key: string;
  label: string;
  status: ContentPackageReadinessSignalStatus;
  summary: string;
  action: string;
  blocking: boolean;
  score: number;
  maxScore: number;
};

export type ContentPackageReadinessInput = {
  id: string;
  name: string;
  status: ContentPackageStatus;
  files: Array<{
    status: PackageFileStatus;
    asset: {
      kind: AssetKind;
      status: AssetStatus;
    } | null;
  }>;
};

export type ContentPackageReadinessSummary = {
  packageId: string;
  packageName: string;
  rating: ContentPackageReadinessRating;
  score: number;
  summary: string;
  signals: ContentPackageReadinessSignal[];
  blockingSignals: ContentPackageReadinessSignal[];
};

export function buildContentPackageReadiness(
  input: ContentPackageReadinessInput,
): ContentPackageReadinessSummary {
  const fileCount = input.files.length;
  const plannedFileCount = input.files.filter((file) => file.status === PackageFileStatus.PLANNED)
    .length;
  const generatedFileCount = input.files.filter((file) =>
    file.status === PackageFileStatus.GENERATED || file.status === PackageFileStatus.APPROVED,
  ).length;
  const approvedFileCount = input.files.filter((file) => file.status === PackageFileStatus.APPROVED)
    .length;
  const linkedApprovedAssets = input.files
    .map((file) => file.asset)
    .filter((asset): asset is NonNullable<typeof asset> => asset?.status === AssetStatus.APPROVED);
  const hasApprovedProductImage = linkedApprovedAssets.some(
    (asset) => asset.kind === AssetKind.PRODUCT_IMAGE,
  );
  const hasApprovedLogo = linkedApprovedAssets.some((asset) => asset.kind === AssetKind.LOGO);
  const signals = [
    buildFileGenerationSignal(fileCount, generatedFileCount, plannedFileCount),
    buildFileApprovalSignal(fileCount, approvedFileCount),
    buildVisualSourceSignal(hasApprovedProductImage, hasApprovedLogo),
    buildPackageReviewSignal(input.status),
  ];
  const rawScore = signals.reduce((total, signal) => total + signal.score, 0);
  const maxScore = signals.reduce((total, signal) => total + signal.maxScore, 0);
  const score = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
  const blockingSignals = signals.filter(
    (signal) => signal.blocking && signal.status !== "complete",
  );
  const rating = inferReadinessRating(score, blockingSignals.length);

  return {
    packageId: input.id,
    packageName: input.name,
    rating,
    score,
    summary: buildReadinessSummary(rating, score, blockingSignals),
    signals,
    blockingSignals,
  };
}

function buildFileGenerationSignal(
  fileCount: number,
  generatedFileCount: number,
  plannedFileCount: number,
): ContentPackageReadinessSignal {
  if (fileCount > 0 && generatedFileCount === fileCount) {
    return signal(
      "file-generation",
      "文件生成",
      "complete",
      `全部 ${fileCount} 个文件项已生成或通过。`,
      "继续审核",
      false,
      30,
      30,
    );
  }

  if (generatedFileCount > 0) {
    return signal(
      "file-generation",
      "文件生成",
      "warning",
      `已生成 ${generatedFileCount} 个文件项，仍有 ${plannedFileCount} 个待生成。`,
      "补齐待生成文件",
      true,
      15,
      30,
    );
  }

  return signal(
    "file-generation",
    "文件生成",
    "missing",
    "素材包文件还停留在计划状态。",
    "先生成文件内容",
    true,
    0,
    30,
  );
}

function buildFileApprovalSignal(
  fileCount: number,
  approvedFileCount: number,
): ContentPackageReadinessSignal {
  if (fileCount > 0 && approvedFileCount === fileCount) {
    return signal(
      "file-approval",
      "文件审核",
      "complete",
      `全部 ${fileCount} 个文件项已通过。`,
      "准备下载",
      false,
      25,
      25,
    );
  }

  if (approvedFileCount > 0) {
    return signal(
      "file-approval",
      "文件审核",
      "warning",
      `已有 ${approvedFileCount} 个文件项通过，仍需继续审核。`,
      "继续审核文件",
      false,
      12,
      25,
    );
  }

  return signal(
    "file-approval",
    "文件审核",
    "warning",
    "还没有文件项通过审核。",
    "先标记关键文件通过",
    false,
    0,
    25,
  );
}

function buildVisualSourceSignal(
  hasApprovedProductImage: boolean,
  hasApprovedLogo: boolean,
): ContentPackageReadinessSignal {
  if (hasApprovedProductImage && hasApprovedLogo) {
    return signal(
      "visual-source",
      "真实视觉素材",
      "complete",
      "素材包已关联审核通过的产品视觉和官方 Logo。",
      "进入最终检查",
      false,
      25,
      25,
    );
  }

  if (hasApprovedProductImage || hasApprovedLogo) {
    return signal(
      "visual-source",
      "真实视觉素材",
      "warning",
      hasApprovedProductImage
        ? "已关联产品视觉，但缺少官方 Logo。"
        : "已关联官方 Logo，但缺少产品视觉。",
      "补齐真实视觉素材",
      true,
      12,
      25,
    );
  }

  return signal(
    "visual-source",
    "真实视觉素材",
    "missing",
    "素材包未关联审核通过的产品视觉和官方 Logo。",
    "关联真实产品图和 Logo",
    true,
    0,
    25,
  );
}

function buildPackageReviewSignal(
  status: ContentPackageStatus,
): ContentPackageReadinessSignal {
  if (status === ContentPackageStatus.APPROVED) {
    return signal(
      "package-review",
      "素材包审核",
      "complete",
      "素材包已通过审核。",
      "下载交付包",
      false,
      20,
      20,
    );
  }

  if (status === ContentPackageStatus.REVIEW_NEEDED) {
    return signal(
      "package-review",
      "素材包审核",
      "warning",
      "素材包已提交审核，等待处理。",
      "处理审核任务",
      false,
      10,
      20,
    );
  }

  return signal(
    "package-review",
    "素材包审核",
    "warning",
    "素材包还没有提交 Web 审核。",
    "提交素材包审核",
    false,
    0,
    20,
  );
}

function inferReadinessRating(score: number, blockingSignalCount: number) {
  if (score >= 85 && blockingSignalCount === 0) {
    return "READY_TO_EXPORT";
  }

  if (score < 55 || blockingSignalCount > 0) {
    return "BLOCKED";
  }

  return "NEEDS_WORK";
}

function buildReadinessSummary(
  rating: ContentPackageReadinessRating,
  score: number,
  blockingSignals: ContentPackageReadinessSignal[],
) {
  if (rating === "READY_TO_EXPORT") {
    return `可交付性 ${score} 分，可以下载 ZIP 并进入最终人工复核。`;
  }

  if (blockingSignals.length > 0) {
    return `可交付性 ${score} 分，阻塞项：${blockingSignals
      .map((signalItem) => signalItem.action)
      .join("、")}。`;
  }

  return `可交付性 ${score} 分，建议继续完成审核和最终检查。`;
}

function signal(
  key: string,
  label: string,
  status: ContentPackageReadinessSignalStatus,
  summary: string,
  action: string,
  blocking: boolean,
  score: number,
  maxScore: number,
): ContentPackageReadinessSignal {
  return {
    key,
    label,
    status,
    summary,
    action,
    blocking,
    score,
    maxScore,
  };
}
