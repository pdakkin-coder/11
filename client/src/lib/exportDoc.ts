export type ExportFormat = "docx" | "txt" | "md" | "html";

function safeName(name: string, ext: ExportFormat): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "document";
  return `${base}.${ext}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ── HTML → plain text ─────────────────────────────────────────────────────────
function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  // Add newlines at block boundaries
  div.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,br,blockquote").forEach((el) => {
    el.appendChild(document.createTextNode("\n"));
  });
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// ── HTML → Markdown (basic) ───────────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const lines: string[] = [];

  function walk(node: Node, prefix = "") {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(prefix + (node.textContent || ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") { lines.push("# " + el.textContent?.trim()); lines.push(""); }
    else if (tag === "h2") { lines.push("## " + el.textContent?.trim()); lines.push(""); }
    else if (tag === "h3") { lines.push("### " + el.textContent?.trim()); lines.push(""); }
    else if (tag === "p") { lines.push(el.textContent?.trim() || ""); lines.push(""); }
    else if (tag === "blockquote") { lines.push("> " + el.textContent?.trim()); lines.push(""); }
    else if (tag === "li") {
      const parent = el.parentElement?.tagName.toLowerCase();
      const bullet = parent === "ol" ? "1. " : "- ";
      lines.push(bullet + el.textContent?.trim());
    }
    else if (tag === "br") { lines.push(""); }
    else { el.childNodes.forEach((c) => walk(c, prefix)); }
  }

  div.childNodes.forEach((n) => walk(n));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Full HTML document wrapper ────────────────────────────────────────────────
function wrapHtmlDoc(body: string, title: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title.replace(/\.[^.]+$/, ""))}</title>
  <style>
    body { max-width: 72ch; margin: 48px auto; font: 16px/1.65 Georgia, serif; color: #28251d; }
    h1 { font-size: 24px; margin-bottom: 28px; }
    h2 { font-size: 20px; margin-top: 32px; margin-bottom: 8px; }
    h3 { font-size: 17px; margin-top: 24px; margin-bottom: 6px; }
    p  { margin: 0 0 16px; }
    ul, ol { margin: 0 0 16px; padding-left: 1.5em; }
    blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #555; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    td, th { border: 1px solid #ccc; padding: 6px 12px; }
    th { background: #f5f5f5; font-weight: 600; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── DOCX: parse HTML nodes → Word XML ────────────────────────────────────────
function escapeXmlStr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineXml(el: HTMLElement): string {
  let result = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent || "";
      if (txt) result += `<w:r><w:t xml:space="preserve">${escapeXmlStr(txt)}</w:t></w:r>`;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();
      if (tag === "strong" || tag === "b") {
        result += `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXmlStr(child.textContent || "")}</w:t></w:r>`;
      } else if (tag === "em" || tag === "i") {
        result += `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escapeXmlStr(child.textContent || "")}</w:t></w:r>`;
      } else if (tag === "u") {
        result += `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXmlStr(child.textContent || "")}</w:t></w:r>`;
      } else if (tag === "br") {
        result += "<w:r><w:br/></w:r>";
      } else {
        result += inlineXml(child);
      }
    }
  });
  return result;
}

function blockXml(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "h1") {
    return `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${inlineXml(el)}</w:p>`;
  }
  if (tag === "h2") {
    return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${inlineXml(el)}</w:p>`;
  }
  if (tag === "h3") {
    return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${inlineXml(el)}</w:p>`;
  }
  if (tag === "blockquote") {
    return `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escapeXmlStr(el.textContent || "")}</w:t></w:r></w:p>`;
  }
  if (tag === "ul" || tag === "ol") {
    return Array.from(el.querySelectorAll("li")).map((li) =>
      `<w:p><w:pPr><w:ind w:left="480"/></w:pPr><w:r><w:t xml:space="preserve">• ${escapeXmlStr((li as HTMLElement).textContent || "")}</w:t></w:r></w:p>`
    ).join("");
  }
  // p or unknown
  const runs = inlineXml(el);
  return runs ? `<w:p>${runs}</w:p>` : "";
}

function htmlToDocumentXml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const blocks: string[] = [];
  div.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const xml = blockXml(node as HTMLElement);
      if (xml) blocks.push(xml);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent?.trim();
      if (txt) blocks.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXmlStr(txt)}</w:t></w:r></w:p>`);
    }
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${blocks.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function plainTextToDocumentXml(text: string): string {
  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const paragraphs = blocks.map((b, i) => {
    const isTitle = i === 0 && b.length < 90;
    if (isTitle) return `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXmlStr(b)}</w:t></w:r></w:p>`;
    return `<w:p><w:r><w:t xml:space="preserve">${escapeXmlStr(b)}</w:t></w:r></w:p>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function createStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="26"/></w:rPr></w:style>
</w:styles>`;
}

function makeDocxFiles(docXml: string): Record<string, string> {
  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    "word/document.xml": docXml,
    "word/styles.xml": createStylesXml(),
  };
}

// ── ZIP builder (no external deps) ───────────────────────────────────────────
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

function writeUint16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files: Record<string, string>): Blob {
  const encoder = new TextEncoder();
  const out: number[] = [];
  const central: number[] = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const offset = out.length;

    writeUint32(out, 0x04034b50);
    writeUint16(out, 20);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint32(out, crc);
    writeUint32(out, data.length);
    writeUint32(out, data.length);
    writeUint16(out, nameBytes.length);
    writeUint16(out, 0);
    out.push(...nameBytes, ...data);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, crc);
    writeUint32(central, data.length);
    writeUint32(central, data.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    central.push(...nameBytes);
  }

  const centralOffset = out.length;
  out.push(...central);
  writeUint32(out, 0x06054b50);
  writeUint16(out, 0);
  writeUint16(out, 0);
  writeUint16(out, Object.keys(files).length);
  writeUint16(out, Object.keys(files).length);
  writeUint32(out, central.length);
  writeUint32(out, centralOffset);
  writeUint16(out, 0);

  return new Blob([new Uint8Array(out)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Export the document to the requested format.
 *
 * @param text  - Plain text fallback (always available)
 * @param docName - Original file name (used for the download filename)
 * @param format  - Target format
 * @param html  - Optional rich HTML from the RichEditor (used for DOCX/HTML exports
 *                when available; falls back to `text` when absent)
 */
export async function exportDocument(
  text: string,
  docName: string,
  format: ExportFormat,
  html?: string
) {
  if (format === "docx") {
    const docXml = html ? htmlToDocumentXml(html) : plainTextToDocumentXml(text);
    downloadBlob(createZip(makeDocxFiles(docXml)), safeName(docName, "docx"));
    return;
  }

  if (format === "html") {
    const body = html ?? `<p>${escapeXml(text).replace(/\n/g, "<br>")}</p>`;
    downloadBlob(
      new Blob([wrapHtmlDoc(body, docName)], { type: "text/html;charset=utf-8" }),
      safeName(docName, "html")
    );
    return;
  }

  if (format === "md") {
    const md = html ? htmlToMarkdown(html) : text;
    downloadBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), safeName(docName, "md"));
    return;
  }

  // txt
  const plain = html ? htmlToText(html) : text;
  downloadBlob(new Blob([plain], { type: "text/plain;charset=utf-8" }), safeName(docName, "txt"));
}
