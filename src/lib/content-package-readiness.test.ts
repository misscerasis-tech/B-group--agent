import { AssetKind, AssetStatus, ContentPackageStatus, PackageFileStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildContentPackageReadiness } from "./content-package-readiness";

describe("buildContentPackageReadiness", () => {
  it("marks an approved package with real product and logo assets as export-ready", () => {
    const readiness = buildContentPackageReadiness({
      id: "package-1",
      name: "巴西首周素材包",
      status: ContentPackageStatus.APPROVED,
      files: [
        {
          status: PackageFileStatus.APPROVED,
          asset: {
            kind: AssetKind.PRODUCT_IMAGE,
            status: AssetStatus.APPROVED,
          },
        },
        {
          status: PackageFileStatus.APPROVED,
          asset: {
            kind: AssetKind.LOGO,
            status: AssetStatus.APPROVED,
          },
        },
      ],
    });

    expect(readiness.rating).toBe("READY_TO_EXPORT");
    expect(readiness.score).toBe(100);
    expect(readiness.blockingSignals).toHaveLength(0);
  });

  it("blocks delivery when files are planned and real visual sources are missing", () => {
    const readiness = buildContentPackageReadiness({
      id: "package-1",
      name: "巴西首周素材包",
      status: ContentPackageStatus.DRAFT,
      files: [
        {
          status: PackageFileStatus.PLANNED,
          asset: {
            kind: AssetKind.GENERATED_IMAGE,
            status: AssetStatus.APPROVED,
          },
        },
      ],
    });

    expect(readiness.rating).toBe("BLOCKED");
    expect(readiness.blockingSignals.map((signal) => signal.key)).toEqual([
      "file-generation",
      "visual-source",
    ]);
    expect(readiness.summary).toContain("关联真实产品图和 Logo");
  });
});
