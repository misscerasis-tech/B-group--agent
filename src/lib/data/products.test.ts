import { AssetKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canExtractFactsFromAsset } from "./products";

describe("canExtractFactsFromAsset", () => {
  it("allows text-like product document assets", () => {
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.DOCUMENT,
        mimeType: "text/plain",
        originalFilename: "official-brief.txt",
        storagePath: "storage/assets/workspace-1/brief.txt",
      }),
    ).toBe(true);
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.DOCUMENT,
        mimeType: null,
        originalFilename: "faq.md",
        storagePath: "storage/assets/workspace-1/faq.md",
      }),
    ).toBe(true);
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.DOCUMENT,
        mimeType: "application/pdf",
        originalFilename: "manual.pdf",
        storagePath: "storage/assets/workspace-1/manual.pdf",
      }),
    ).toBe(true);
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.DOCUMENT,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalFilename: "official-brief.docx",
        storagePath: "storage/assets/workspace-1/official-brief.docx",
      }),
    ).toBe(true);
  });

  it("rejects images and unsupported document formats for local text extraction", () => {
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.PRODUCT_IMAGE,
        mimeType: "image/png",
        originalFilename: "product.png",
        storagePath: "storage/assets/workspace-1/product.png",
      }),
    ).toBe(false);
    expect(
      canExtractFactsFromAsset({
        kind: AssetKind.DOCUMENT,
        mimeType: "application/vnd.ms-powerpoint",
        originalFilename: "brand-deck.ppt",
        storagePath: "storage/assets/workspace-1/brand-deck.ppt",
      }),
    ).toBe(false);
  });
});
