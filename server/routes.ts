import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import mammoth from "mammoth";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { handleAiAnalyze, handleAiConvert } from "./aiAnalyze";

const MAX_REMOTE_BYTES = 18 * 1024 * 1024;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── AI endpoints ───────────────────────────────────────────────────────────
  app.post("/api/ai-analyze", handleAiAnalyze);
  app.post("/api/ai-convert", handleAiConvert);

  // ── Import from URL ────────────────────────────────────────────────────────
  app.post("/api/import-url", async (req, res) => {
    const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!rawUrl) {
      return res.status(400).json({ message: "Укажите ссылку на документ." });
    }

    let url: URL;
    try {
      url = new URL(normalizeDocumentUrl(rawUrl));
    } catch {
      return res.status(400).json({ message: "Ссылка должна быть корректным http/https URL." });
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      return res.status(400).json({ message: "Поддерживаются только http/https ссылки." });
    }

    const fetched = await fetch(url, {
      headers: {
        "user-agent": "CodexCitationDesktop/0.1 (+document-import)",
        accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,*/*",
      },
      redirect: "follow",
    });

    if (!fetched.ok) {
      return res.status(400).json({
        message: `Не удалось получить файл: HTTP ${fetched.status}. Проверьте, что ссылка публичная.`,
      });
    }

    const contentLength = Number(fetched.headers.get("content-length") || "0");
    if (contentLength > MAX_REMOTE_BYTES) {
      return res.status(413).json({ message: "Файл слишком большой для прототипа. Максимум: 18 МБ." });
    }

    const buffer = Buffer.from(await fetched.arrayBuffer());
    if (buffer.byteLength > MAX_REMOTE_BYTES) {
      return res.status(413).json({ message: "Файл слишком большой для прототипа. Максимум: 18 МБ." });
    }

    const contentType = fetched.headers.get("content-type") || "";
    const finalUrl = fetched.url || url.toString();
    const name = inferFileName(finalUrl, contentType);
    let text = "";
    const warnings: string[] = [];

    if (isDocx(name, contentType)) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      for (const message of result.messages ?? []) {
        warnings.push(message.message);
      }
      warnings.push("DOCX импортирован по публичной ссылке; сложные сноски Word могут быть извлечены как обычный текст.");
    } else if (/text\/plain|text\/markdown|application\/octet-stream/i.test(contentType) || /\.(txt|md)$/iu.test(name)) {
      text = buffer.toString("utf8");
    } else if (/text\/html/i.test(contentType) || /\.html?$/iu.test(name)) {
      text = stripHtml(buffer.toString("utf8"));
      warnings.push("HTML преобразован в plain text; форматирование сохранено частично.");
    } else {
      text = buffer.toString("utf8");
      warnings.push("Тип файла не распознан; выполнено чтение как plain text.");
    }

    return res.json({
      name,
      text: text.trim(),
      warnings,
      sourceUrl: finalUrl,
    });
  });

  // ── Export to Drive ────────────────────────────────────────────────────────
  app.post("/api/export-drive", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const docName = typeof req.body?.docName === "string" ? req.body.docName : "document.txt";
    const format = normalizeFormat(req.body?.format);
    if (!text.trim()) return res.status(400).json({ message: "Документ пуст." });

    const dir = join(tmpdir(), "codex-citation-export");
    await mkdir(dir, { recursive: true });
    const fileName = safeFileName(docName, format);
    const filePath = join(dir, `${Date.now()}-${fileName}`);
    await writeFile(filePath, renderExport(text, docName, format));

    try {
      const output = await callExternalTool("google_drive", "export_files", { file_paths: [filePath] });
      return res.json({
        name: fileName,
        message: "Файл экспортирован в Google Drive.",
        result: output,
        url: extractUrl(output),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      if (/requires file resolution|Use call_external_tool/i.test(rawMessage)) {
        return res.status(501).json({
          message:
            "Google Drive connector подключён, но прямой экспорт из автономного приложения требует отдельного Google OAuth/API приложения. В этой версии используйте скачивание DOCX/TXT/MD/HTML или экспорт через коннектор в чате.",
        });
      }
      return res.status(502).json({
        message: rawMessage || "Не удалось вызвать Google Drive connector.",
      });
    }
  });

  return httpServer;
}

function normalizeDocumentUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  const googleDoc = url.hostname === "docs.google.com" && url.pathname.includes("/document/d/");
  if (googleDoc) {
    const match = url.pathname.match(/\/document\/d\/([^/]+)/u);
    if (match?.[1]) return `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
  }

  const googleDrive = url.hostname.includes("drive.google.com");
  if (googleDrive) {
    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/u);
    const openId = url.searchParams.get("id");
    const id = fileMatch?.[1] || openId;
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  return rawUrl;
}

function inferFileName(urlValue: string, contentType: string): string {
  try {
    const url = new URL(urlValue);
    const raw = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "document");
    if (/\.[a-z0-9]{2,5}$/iu.test(raw)) return raw;
  } catch {
    // fall through
  }

  if (/wordprocessingml\.document|application\/vnd\.openxmlformats-officedocument/i.test(contentType)) return "linked-document.docx";
  if (/markdown/i.test(contentType)) return "linked-document.md";
  if (/html/i.test(contentType)) return "linked-document.html";
  return "linked-document.txt";
}

function isDocx(name: string, contentType: string): boolean {
  return /\.docx$/iu.test(name) || /wordprocessingml\.document|application\/vnd\.openxmlformats-officedocument/i.test(contentType);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, "")
    .replace(/<style[\s\S]*?<\/style>/giu, "")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/giu, "\n")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

type ExportFormat = "docx" | "txt" | "md" | "html";

function normalizeFormat(value: unknown): ExportFormat {
  return value === "txt" || value === "md" || value === "html" || value === "docx" ? value : "docx";
}

function safeFileName(name: string, ext: ExportFormat): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "document";
  return `${base}.${ext}`;
}

function renderExport(text: string, docName: string, format: ExportFormat): Buffer | string {
  if (format === "txt") return text;
  if (format === "md") return toMarkdown(text);
  if (format === "html") return toHtmlDocument(text, docName);
  return createDocxBuffer(text);
}

function isHeading(block: string, index: number): boolean {
  const trimmed = block.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (index === 0) return true;
  return !/[.!?:;]$/.test(trimmed);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toMarkdown(text: string): string {
  return text
    .split(/\n\n+/)
    .map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (isHeading(trimmed, index)) return `${index === 0 ? "# " : "## "}${trimmed}`;
      return trimmed;
    })
    .join("\n\n");
}

function toHtmlDocument(text: string, title: string): string {
  const body = text
    .split(/\n\n+/)
    .map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const tag = isHeading(trimmed, index) ? (index === 0 ? "h1" : "h2") : "p";
      return `<${tag}>${escapeXml(trimmed).replace(/\n/g, "<br>")}</${tag}>`;
    })
    .join("\n");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeXml(title)}</title></head><body>${body}</body></html>`;
}

function paragraphXml(block: string, index: number): string {
  const style = isHeading(block, index) ? `<w:pPr><w:pStyle w:val="${index === 0 ? "Title" : "Heading2"}"/></w:pPr>` : "";
  const runs = block.split("\n").map((line, i) => `<w:r>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`).join("");
  return `<w:p>${style}${runs}</w:p>`;
}

function createDocxBuffer(text: string): Buffer {
  const body = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean).map(paragraphXml).join("");
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`,
  };
  return zipStore(files);
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function push16(out: number[], value: number) { out.push(value & 0xff, (value >>> 8) & 0xff); }
function push32(out: number[], value: number) { out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }

function zipStore(files: Record<string, string>): Buffer {
  const out: number[] = [];
  const central: number[] = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const offset = out.length;
    push32(out, 0x04034b50); push16(out, 20); push16(out, 0); push16(out, 0); push16(out, 0); push16(out, 0);
    push32(out, crc); push32(out, data.length); push32(out, data.length); push16(out, nameBytes.length); push16(out, 0);
    out.push(...nameBytes, ...data);
    push32(central, 0x02014b50); push16(central, 20); push16(central, 20); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0);
    push32(central, crc); push32(central, data.length); push32(central, data.length); push16(central, nameBytes.length); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0); push32(central, 0); push32(central, offset);
    central.push(...nameBytes);
  }
  const centralOffset = out.length;
  out.push(...central);
  push32(out, 0x06054b50); push16(out, 0); push16(out, 0); push16(out, Object.keys(files).length); push16(out, Object.keys(files).length); push32(out, central.length); push32(out, centralOffset); push16(out, 0);
  return Buffer.from(out);
}

function callExternalTool(sourceId: string, toolName: string, argumentsValue: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ source_id: sourceId, tool_name: toolName, arguments: argumentsValue });
    const child = spawn("external-tool", ["call", payload], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `external-tool exited with code ${code}`));
      try { resolve(JSON.parse(stdout)); } catch { resolve(stdout); }
    });
  });
}

function extractUrl(value: unknown): string | undefined {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.match(/https:\/\/[^\s"']+/)?.[0];
}
