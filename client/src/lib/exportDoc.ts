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

function escapeHtml(value: string): string {
  return escapeXml(value);
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

function isHeading(block: string, index: number): boolean {
  const trimmed = block.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (index === 0) return true;
  return !/[.!?:;]$/.test(trimmed);
}

function toHtmlDocument(text: string, title: string): string {
  const blocks = text.split(/\n\n+/);
  const body = blocks
    .map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const tag = isHeading(trimmed, index) ? (index === 0 ? "h1" : "h2") : "p";
      return `<${tag}>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</${tag}>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title.replace(/\.[^.]+$/, ""))}</title>
  <style>
    body { max-width: 72ch; margin: 48px auto; font: 16px/1.65 Georgia, serif; color: #28251d; }
    h1, h2 { font-family: Arial, sans-serif; line-height: 1.25; }
    h1 { font-size: 24px; margin-bottom: 28px; }
    h2 { font-size: 18px; margin-top: 28px; }
    p { margin: 0 0 16px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
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

function paragraphXml(block: string, index: number): string {
  const heading = isHeading(block, index);
  const style = heading ? `<w:pPr><w:pStyle w:val="${index === 0 ? "Title" : "Heading2"}"/></w:pPr>` : "";
  const lines = block.split("\n");
  const runs = lines
    .map((line, lineIndex) => {
      const br = lineIndex > 0 ? "<w:br/>" : "";
      return `<w:r>${br}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${style}${runs}</w:p>`;
}

function createDocumentXml(text: string): string {
  const body = text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => paragraphXml(block, index))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
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
</w:styles>`;
}

function makeDocxFiles(text: string): Record<string, string> {
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
    "word/document.xml": createDocumentXml(text),
    "word/styles.xml": createStylesXml(),
  };
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

async function exportDocx(text: string, docName: string) {
  downloadBlob(createZip(makeDocxFiles(text)), safeName(docName, "docx"));
}

export async function exportDocument(text: string, docName: string, format: ExportFormat) {
  if (format === "docx") {
    await exportDocx(text, docName);
    return;
  }

  const content =
    format === "html" ? toHtmlDocument(text, docName) :
    format === "md" ? toMarkdown(text) :
    text;
  const type =
    format === "html" ? "text/html;charset=utf-8" :
    format === "md" ? "text/markdown;charset=utf-8" :
    "text/plain;charset=utf-8";

  downloadBlob(new Blob([content], { type }), safeName(docName, format));
}
