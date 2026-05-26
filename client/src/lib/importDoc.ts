// File import helpers. DOCX uses mammoth (browser bundle); TXT/MD are read directly.
// Graceful fallback if mammoth fails to load.

export interface ImportedDoc {
  name: string;
  text: string;
  html: string;        // Rich HTML (from mammoth convertToHtml)
  warnings: string[];
}

/** mammoth styleMap: map common Russian/English Word heading styles to HTML */
const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  // Russian Word styles
  "p[style-name='\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a 1'] => h1:fresh",
  "p[style-name='\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a 2'] => h2:fresh",
  "p[style-name='\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a 3'] => h3:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='\u0417\u0430\u0433\u043b\u0430\u0432\u0438\u0435'] => h1:fresh",
  "p[style-name='Block Text'] => blockquote:fresh",
  "p[style-name='\u0426\u0438\u0442\u0430\u0442\u0430'] => blockquote:fresh",
];

export async function importFile(file: File): Promise<ImportedDoc> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = await file.text();
    // Convert plain text to basic HTML paragraphs
    const html = text
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    return { name, text, html, warnings: [] };
  }

  if (lower.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth/mammoth.browser.js");
      const arrayBuffer = await file.arrayBuffer();

      // 1. Rich HTML with heading/bold/italic preservation
      const htmlResult = await mammoth.convertToHtml(
        { arrayBuffer },
        { styleMap: STYLE_MAP }
      );
      const html = htmlResult.value || "";

      // 2. Plain text for analysis engine
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      const text = textResult.value || "";

      const allMessages = [
        ...(htmlResult.messages || []),
        ...(textResult.messages || []),
      ];
      const warnings = allMessages
        .filter((m: any) => m?.type === "warning" || m?.type === "error")
        .map((m: any) => String(m?.message || m))
        .slice(0, 5);

      return { name, text, html, warnings };
    } catch (e: any) {
      return {
        name,
        text: "",
        html: "",
        warnings: [
          "Не удалось разобрать DOCX в браузере. Попробуйте TXT/MD или загрузите демо-документ.",
          e?.message || String(e),
        ],
      };
    }
  }

  // Unknown extension — try plain text
  try {
    const text = await file.text();
    const html = text
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    return { name, text, html, warnings: ["Неизвестное расширение — файл прочитан как обычный текст."] };
  } catch (e: any) {
    return { name, text: "", html: "", warnings: ["Не удалось прочитать файл.", e?.message || String(e)] };
  }
}
