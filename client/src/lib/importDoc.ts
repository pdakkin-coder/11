// File import helpers. DOCX uses mammoth (browser bundle); TXT/MD are read directly.
// Graceful fallback if mammoth fails to load.

export interface ImportedDoc {
  name: string;
  text: string;
  warnings: string[];
}

export async function importFile(file: File): Promise<ImportedDoc> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = await file.text();
    return { name, text, warnings: [] };
  }
  if (lower.endsWith(".docx")) {
    try {
      // Dynamic import: mammoth's browser bundle
      const mammoth = await import("mammoth/mammoth.browser.js");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const warnings = (result.messages || []).map((m: any) => String(m?.message || m));
      return { name, text: result.value || "", warnings };
    } catch (e: any) {
      return {
        name,
        text: "",
        warnings: [
          "Не удалось разобрать DOCX в браузере. Откройте файл как TXT/MD или загрузите демо-документ.",
          e?.message || String(e),
        ],
      };
    }
  }
  // unknown — try as text
  try {
    const text = await file.text();
    return { name, text, warnings: ["Неизвестное расширение — файл прочитан как обычный текст."] };
  } catch (e: any) {
    return { name, text: "", warnings: ["Не удалось прочитать файл.", e?.message || String(e)] };
  }
}
