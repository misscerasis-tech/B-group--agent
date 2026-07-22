import { ProjectStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildProjectHealthSummary, type ProjectHealthInput } from "./project-health";

const baseInput: ProjectHealthInput = {
  project: {
    id: "project-1",
    name: "巴西新品首月增长",
    status: ProjectStatus.ACTIVE,
  },
  linkedProductCount: 1,
  confirmedFactCount: 4,
  draftFactCount: 0,
  confirmedStrategyCount: 1,
  draftStrategyCount: 0,
  totalPlanItemCount: 4,
  readyPlanItemCount: 4,
  contentPackageCount: 1,
  generatedPackageCount: 1,
  pendingReviewCount: 0,
  approvedProductImageCount: 2,
  approvedLogoCount: 1,
  metricsSnapshotCount: 1,
  openReminderCount: 0,
};

describe("buildProjectHealthSummary", () => {
  it("marks a complete project as ready for execution", () => {
    const summary = buildProjectHealthSummary(baseInput);

    expect(summary.rating).toBe("READY");
    expect(summary.score).toBe(100);
    expect(summary.nextActions).toHaveLength(0);
    expect(summary.summary).toContain("可进入素材包生成");
  });

  it("surfaces blocking gaps before routine gaps", () => {
    const summary = buildProjectHealthSummary({
      ...baseInput,
      linkedProductCount: 0,
      confirmedFactCount: 0,
      confirmedStrategyCount: 0,
      draftStrategyCount: 1,
      approvedProductImageCount: 0,
      approvedLogoCount: 0,
      metricsSnapshotCount: 0,
    });

    expect(summary.rating).toBe("BLOCKED");
    expect(summary.nextActions.map((action) => action.key)).toEqual([
      "linked-products",
      "approved-assets",
      "product-facts",
      "strategy",
    ]);
    expect(summary.summary).toContain("关联至少一个产品");
  });

  it("keeps draft strategy as attention-needed instead of ready", () => {
    const summary = buildProjectHealthSummary({
      ...baseInput,
      confirmedStrategyCount: 0,
      draftStrategyCount: 1,
    });

    expect(summary.rating).toBe("NEEDS_ATTENTION");
    expect(summary.signals).toContainEqual(
      expect.objectContaining({
        key: "strategy",
        status: "warning",
        action: "确认正式策略",
      }),
    );
  });
});
