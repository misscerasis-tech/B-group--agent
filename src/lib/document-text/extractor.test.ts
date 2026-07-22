import { deflateRawSync, deflateSync } from "node:zlib";
import { AssetKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canExtractTextFromDocumentAsset,
  extractTextFromDocumentBuffer,
} from "@/lib/document-text/extractor";

describe("document text extraction", () => {
  it("detects plain text, DOCX and text-based PDF assets", () => {
    expect(canExtractTextFromDocumentAsset(documentAsset("brief.txt", "text/plain"))).toBe(true);
    expect(
      canExtractTextFromDocumentAsset(
        documentAsset(
          "official.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toBe(true);
    expect(canExtractTextFromDocumentAsset(documentAsset("manual.pdf", "application/pdf"))).toBe(
      true,
    );
    expect(canExtractTextFromDocumentAsset(documentAsset("deck.pptx", null))).toBe(false);
  });

  it("extracts text from DOCX document XML", () => {
    const docx = buildDocxLikeZip(
      "word/document.xml",
      '<w:document><w:body><w:p><w:r><w:t>Aurora Cup</w:t></w:r></w:p><w:p><w:r><w:t>500ml leakproof bottle</w:t></w:r></w:p></w:body></w:document>',
    );

    expect(extractTextFromDocumentBuffer(docx, documentAsset("official.docx", null))).toContain(
      "Aurora Cup",
    );
    expect(extractTextFromDocumentBuffer(docx, documentAsset("official.docx", null))).toContain(
      "500ml leakproof bottle",
    );
  });

  it("extracts text from plain and flate-compressed PDF text operators", () => {
    const plainPdf = Buffer.from(
      "%PDF-1.4\nBT (Aurora Cup 500ml leakproof) Tj ET\n%%EOF",
      "latin1",
    );
    const compressedContent = deflateSync(Buffer.from("BT (Brazil TikTok campaign) Tj ET", "latin1"));
    const compressedPdf = Buffer.concat([
      Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length ${compressedContent.length} >>\nstream\n`,
        "latin1",
      ),
      compressedContent,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    expect(extractTextFromDocumentBuffer(plainPdf, documentAsset("manual.pdf", null))).toContain(
      "Aurora Cup 500ml leakproof",
    );
    expect(
      extractTextFromDocumentBuffer(compressedPdf, documentAsset("compressed.pdf", null)),
    ).toContain("Brazil TikTok campaign");
  });
});

function documentAsset(filename: string, mimeType: string | null) {
  return {
    kind: AssetKind.DOCUMENT,
    mimeType,
    originalFilename: filename,
    storagePath: `storage/assets/workspace-1/${filename}`,
  };
}

function buildDocxLikeZip(filename: string, content: string) {
  const filenameBuffer = Buffer.from(filename, "utf8");
  const fileBuffer = Buffer.from(content, "utf8");
  const compressed = deflateRawSync(fileBuffer);
  const localHeader = Buffer.alloc(30 + filenameBuffer.length);

  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(fileBuffer.length, 22);
  localHeader.writeUInt16LE(filenameBuffer.length, 26);
  filenameBuffer.copy(localHeader, 30);

  const centralDirectoryOffset = localHeader.length + compressed.length;
  const centralDirectory = Buffer.alloc(46 + filenameBuffer.length);

  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(8, 10);
  centralDirectory.writeUInt32LE(compressed.length, 20);
  centralDirectory.writeUInt32LE(fileBuffer.length, 24);
  centralDirectory.writeUInt16LE(filenameBuffer.length, 28);
  filenameBuffer.copy(centralDirectory, 46);

  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([localHeader, compressed, centralDirectory, endOfCentralDirectory]);
}
