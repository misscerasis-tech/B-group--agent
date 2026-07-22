import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync, inflateSync } from "node:zlib";
import { AssetKind } from "@prisma/client";

export const MAX_DOCUMENT_ASSET_FACT_BYTES = 5 * 1024 * 1024;
export const MAX_EXTRACTED_FACT_TEXT_CHARS = 120_000;

const TEXT_ASSET_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);
const DOCX_EXTENSIONS = new Set([".docx"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

const TEXT_ASSET_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);

export type DocumentAssetForExtraction = {
  kind: AssetKind;
  mimeType: string | null;
  originalFilename: string | null;
  storagePath: string | null;
};

type DocumentExtractionKind = "plain-text" | "docx" | "pdf";

export async function extractTextFromLocalDocument(
  absolutePath: string,
  asset: DocumentAssetForExtraction,
) {
  const buffer = await readFile(absolutePath);
  const extracted = extractTextFromDocumentBuffer(buffer, asset);

  return normalizeExtractedText(extracted).slice(0, MAX_EXTRACTED_FACT_TEXT_CHARS);
}

export function canExtractTextFromDocumentAsset(asset: DocumentAssetForExtraction) {
  return getDocumentExtractionKind(asset) !== null;
}

export function extractTextFromDocumentBuffer(buffer: Buffer, asset: DocumentAssetForExtraction) {
  const kind = getDocumentExtractionKind(asset);

  if (!kind) {
    throw new Error("当前只支持从 TXT、MD、CSV、JSON、DOCX 或文本型 PDF 产品资料中提取事实。");
  }

  if (kind === "plain-text") {
    return buffer.toString("utf8");
  }

  if (kind === "docx") {
    return extractDocxText(buffer);
  }

  return extractPdfText(buffer);
}

function getDocumentExtractionKind(asset: DocumentAssetForExtraction): DocumentExtractionKind | null {
  if (asset.kind !== AssetKind.DOCUMENT || !asset.storagePath) {
    return null;
  }

  const mimeType = asset.mimeType?.toLowerCase();
  const filename = asset.originalFilename ?? asset.storagePath;
  const extension = path.extname(filename).toLowerCase();

  if ((mimeType && TEXT_ASSET_MIME_TYPES.has(mimeType)) || TEXT_ASSET_EXTENSIONS.has(extension)) {
    return "plain-text";
  }

  if ((mimeType && DOCX_MIME_TYPES.has(mimeType)) || DOCX_EXTENSIONS.has(extension)) {
    return "docx";
  }

  if ((mimeType && PDF_MIME_TYPES.has(mimeType)) || PDF_EXTENSIONS.has(extension)) {
    return "pdf";
  }

  return null;
}

function extractDocxText(buffer: Buffer) {
  const xmlFiles = readZipTextFiles(buffer, (name) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(name),
  );
  const text = xmlFiles
    .map((xml) =>
      xml
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:br\b[^>]*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " "),
    )
    .join("\n");

  if (!text.trim()) {
    throw new Error("DOCX 中没有提取到可用文本，请整理成产品 Brief 后再提取。");
  }

  return decodeXmlEntities(text);
}

function readZipTextFiles(buffer: Buffer, includeFile: (filename: string) => boolean) {
  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset < 0) {
    throw new Error("DOCX 文件结构无法识别，请重新上传或整理成产品 Brief。");
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: string[] = [];
  let offset = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  while (offset < centralDirectoryEnd) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const filenameStart = offset + 46;
    const filename = buffer.toString("utf8", filenameStart, filenameStart + filenameLength);

    if (includeFile(filename)) {
      entries.push(readZipEntry(buffer, localHeaderOffset, compressedSize, compressionMethod));
    }

    offset = filenameStart + filenameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function readZipEntry(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  compressionMethod: number,
) {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("DOCX 文件条目结构无法识别，请重新上传或整理成产品 Brief。");
  }

  const filenameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + filenameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return data.toString("utf8");
  }

  if (compressionMethod === 8) {
    return inflateRawSync(data).toString("utf8");
  }

  throw new Error("DOCX 压缩方式暂不支持，请整理成产品 Brief 后再提取。");
}

function extractPdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const candidates = [source, ...extractFlatePdfStreams(source)];
  const text = candidates.map(extractPdfTextOperators).join("\n");

  if (!text.trim()) {
    throw new Error("PDF 中没有提取到可用文本，扫描件请先 OCR 或整理成产品 Brief。");
  }

  return text;
}

function extractFlatePdfStreams(source: string) {
  const streams: string[] = [];
  const streamPattern =
    /<<(?:[^>]|>(?!>))*\/Filter\s*\/FlateDecode(?:[^>]|>(?!>))*>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(source))) {
    try {
      streams.push(inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      // Ignore streams that are not plain zlib data; another stream may still contain readable text.
    }
  }

  return streams;
}

function extractPdfTextOperators(source: string) {
  const parts: string[] = [];
  let literalMatch: RegExpExecArray | null;
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayPattern = /\[(.*?)\]\s*TJ/g;
  const hexPattern = /<([0-9A-Fa-f\s]{4,})>\s*Tj/g;

  while ((literalMatch = literalPattern.exec(source))) {
    parts.push(decodePdfLiteralString(literalMatch[0].replace(/\s*Tj$/, "")));
  }

  while ((literalMatch = arrayPattern.exec(source))) {
    const arrayContent = literalMatch[1];
    const strings = arrayContent.match(/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]{4,})>/g) ?? [];
    parts.push(
      strings
        .map((item) =>
          item.startsWith("(") ? decodePdfLiteralString(item) : decodePdfHexString(item.slice(1, -1)),
        )
        .join(""),
    );
  }

  while ((literalMatch = hexPattern.exec(source))) {
    parts.push(decodePdfHexString(literalMatch[1]));
  }

  return parts.join("\n");
}

function decodePdfLiteralString(value: string) {
  const body = value.slice(1, -1);

  return body.replace(/\\([nrtbf\\()])/g, (_match, escaped: string) => {
    const replacements: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "\\": "\\",
      "(": "(",
      ")": ")",
    };

    return replacements[escaped] ?? escaped;
  });
}

function decodePdfHexString(value: string) {
  const clean = value.replace(/\s/g, "");
  const bytes = Buffer.from(clean.length % 2 === 0 ? clean : `${clean}0`, "hex");

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars: string[] = [];

    for (let index = 2; index + 1 < bytes.length; index += 2) {
      chars.push(String.fromCharCode(bytes.readUInt16BE(index)));
    }

    return chars.join("");
  }

  return bytes.toString("utf8");
}

function decodeXmlEntities(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_match, entity: string) => {
    const replacements: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };

    return replacements[entity] ?? entity;
  });
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
