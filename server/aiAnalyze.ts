/**
 * AI-assisted citation analysis & conversion endpoints.
 *
 * POST /api/ai-analyze  — structural + citation analysis only
 * POST /api/ai-convert  — targeted conversion of annotated blocks
 *
 * Requires GEMINI_API_KEY in environment.
 */

import type { Request, Response } from "express";
import { callGemini } from "./geminiRouter.js";

const MAX_TEXT_CHARS = 24_000;

// ── Analysis prompt ────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, perform THREE tasks:

1. STRUCTURE ANALYSIS — identify logical sections (title, abstract, introduction,
   methodology, results, discussion, conclusion, notes, bibliography). For each
   section return: heading text, start line, end line, nesting level (1–3).

2. CITATION ANALYSIS — identify ALL inline citations, bibliography entries, and
   direct quotes. Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE,
   Vancouver, Harvard, GOST 7.0.5). For each item return exact span, line,
   character offsets, confidence score, and optional note.

   GOST 7.0.5 specific markers to look for:
   - Initials pattern: Иванов И.И. (surname then initials with dots)
   - Place of publication: М.: / СПб.: / Л.: (Russian city abbreviation + colon)
   - Electronic resource tag: [Электронный ресурс]
   - Volume/issue: Т. N, № N
   - Page range: С. N–N
   - Inline references: [N] or [Фамилия И.О., год, с. N]

3. BLOCK ANNOTATION — for each identified citation/quote block assign an
   annotation type: "inline-apa" | "inline-numeric" | "footnote" |
   "bibliography" | "ibid" | "quote".

Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description",
  "convertedText": null,
  "structure": [
    { "heading": "string", "level": 1, "startLine": 1, "endLine": 10 }
  ],
  "items": [
    {
      "id": "ai-0",
      "type": "inline-apa"|"inline-numeric"|"footnote"|"bibliography"|"ibid"|"quote",
      "text": "exact span",
      "line": 1,
      "start": 0,
      "end": 10,
      "confidence": 0.9,
      "note": "optional"
    }
  ],
  "bibEntries": [
    {
      "raw": "original entry",
      "style": "APA",
      "converted": null,
      "fields": { "author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":"" },
      "startLine": 1
    }
  ]
}`;

// ── Conversion prompt ──────────────────────────────────────────────────────
const CONVERT_PROMPT = `You are an expert academic document editor specialising in citation
reformatting, bibliography normalisation, and academic style correction.

The user will provide:
- The FULL document text (with sections already heuristically or AI-annotated)
- A TARGET citation style
- A SCOPE array listing what to convert (any combination of):
    "citations"     — reformat all inline citations to target style
    "bibliography"  — reformat all bibliography / reference-list entries
    "structure"     — normalise section headings to academic conventions
    "typos"         — fix obvious spelling / typography errors (Russian and English)
    "syntax"        — fix punctuation, spacing, dash usage (em-dash, en-dash, quotation marks)

Rules:
- Process ONLY the scope items listed. Do NOT touch anything else.
- Preserve all non-target text verbatim.
- Return the FULL converted document in "convertedText".
- Also return individual bibEntries with "converted" fields.
- Set "convertedText" to null only if no changes were needed.

GOST 7.0.5-2008 FORMATTING RULES (apply when targetStyle is "GOST"):
- Author format: Фамилия И.О. (surname first, then initials with dots, comma-separated for multiple)
- Inline citation: [N] where N is sequential reference number
- Book entry:     Фамилия И.О. Название. — Место : Издательство, Год. — N с.
- Journal entry:  Фамилия И.О. Название статьи // Журнал. — Год. — Т. N, № N. — С. N–N. — DOI: 10.xxx (if available)
- Web resource:   Фамилия И.О. Название [Электронный ресурс]. — URL: https://... (дата обращения: ДД.ММ.ГГГГ).
- Thesis:         Фамилия И.О. Название : дис. … канд./д-р наук / Учреждение. — Место, Год. — N с.
- Use em-dash (—) as separator between bibliographic fields
- Use Russian guillemets «» for titles when appropriate
- City abbreviations: Москва → М., Санкт-Петербург → СПб., Ленинград → Л.

Return ONLY valid JSON — no markdown fences:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "summary": "one-sentence description of what was done",
  "convertedText": "full converted document or null",
  "items": [],
  "bibEntries": [
    {
      "raw": "original entry",
      "style": "string",
      "converted": "reformatted entry",
      "fields": { "author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":"" },
      "startLine": 1
    }
  ]
}`;

function detectLang(text: string): "ru" | "en" | "mixed" {
  const ru = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const en = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const t = ru + en;
  if (!t) return "ru";
  const r = ru / t;
  return r > 0.7 ? "ru" : r < 0.3 ? "en" : "mixed";
}

function truncate(rawText: string): string {
  return rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\n" + rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;
}

async function runGemini(
  systemPrompt: string,
  userMsg: string,
  apiKey: string
): Promise<{ raw: string; model: string }> {
  const contents = [
    { role: "user",  parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I will return only valid JSON with no markdown fences." }] },
    { role: "user",  parts: [{ text: userMsg }] },
  ];
  return callGemini(contents, { temperature: 0, responseMimeType: "application/json" }, apiKey);
}

function friendlyError(msg: string): string {
  if (msg.includes("TimeoutError") || msg.includes("signal timed out"))
    return "Gemini не ответил за 90 секунд. Попробуйте с более коротким документом.";
  if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED"))
    return "Не удалось подключиться к Gemini API. Проверьте интернет-соединение.";
  return msg;
}

// ── POST /api/ai-analyze ───────────────────────────────────────────────────
export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) { res.status(400).json({ error: "Текст не передан." }); return; }

  const language = typeof req.body?.language === "string" ? req.body.language : detectLang(rawText);
  const text = truncate(rawText);
  const userMsg = [`Language hint: ${language}`, "---BEGIN---", text, "---END---"].join("\n");

  try {
    const { raw, model } = await runGemini(ANALYZE_PROMPT, userMsg, apiKey);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("Gemini вернул ответ в неожиданном формате. Попробуйте ещё раз или сократите документ.");
    }
    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      structure:     Array.isArray(parsed.structure)  ? parsed.structure  : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      (parsed.language as string) ?? language,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: null,
      _model:        model,
    });
  } catch (err) {
    res.status(502).json({ error: friendlyError(err instanceof Error ? err.message : String(err)) });
  }
}

// ── POST /api/ai-convert ───────────────────────────────────────────────────
export async function handleAiConvert(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан." });
    return;
  }

  const rawText    = typeof req.body?.text        === "string" ? req.body.text        : "";
  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : "";
  const scope: string[] = Array.isArray(req.body?.scope) ? req.body.scope : ["citations", "bibliography"];

  if (!rawText.trim())    { res.status(400).json({ error: "Текст не передан." }); return; }
  if (!targetStyle.trim()) { res.status(400).json({ error: "Целевой стиль не указан." }); return; }

  const language = typeof req.body?.language === "string" ? req.body.language : detectLang(rawText);
  const text = truncate(rawText);

  // Append language-specific instruction context
  const langInstruction = language === "ru"
    ? "The document is in Russian. Apply Russian academic conventions: guillemets «» for quotations, em-dash (—) as bibliographic separator, Cyrillic initials format."
    : language === "mixed"
    ? "The document mixes Russian and English. Handle both scripts correctly."
    : "The document is in English.";

  const userMsg = [
    `Language hint: ${language}`,
    langInstruction,
    `Target style: ${targetStyle}`,
    `Scope: ${scope.join(", ")}`,
    "---BEGIN---",
    text,
    "---END---",
  ].join("\n");

  try {
    const { raw, model } = await runGemini(CONVERT_PROMPT, userMsg, apiKey);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("Gemini вернул ответ в неожиданном формате.");
    }
    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
      _model:        model,
    });
  } catch (err) {
    res.status(502).json({ error: friendlyError(err instanceof Error ? err.message : String(err)) });
  }
}
