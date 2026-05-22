/**
 * AI citation analysis + conversion endpoint.
 *
 * POST /api/ai-analyze  — structure analysis, block markup, citation analysis
 * POST /api/ai-convert  — targeted conversion of citations/bibliography/structure
 *
 * Body (analyze): { text: string; language?: string }
 * Body (convert):  { text: string; targetStyle?: string; language?: string; scopes?: string[] }
 *
 * Requires GEMINI_API_KEY in environment.
 */

import type { Request, Response } from "express";
import { callGemini } from "./geminiRouter.js";

const MAX_TEXT_CHARS = 24_000;

// ── Prompt: structural analysis + citation markup ─────────────────────────────
const ANALYZE_PROMPT = `You are an expert academic document analysis engine.
Given a scholarly document, perform the following tasks:
1. Identify ALL inline citations, bibliography entries, footnotes, and direct quotes.
2. Detect the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).
3. Analyse the document structure: sections, headings, abstract, body, conclusion, bibliography block.
4. Flag potential citation issues (missing fields, inconsistent formatting, duplicate entries).

Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description of the document",
  "structureSummary": "brief description of document structure",
  "convertedText": null,
  "items": [
    {
      "id": "ai-0",
      "type": "inline-apa"|"inline-numeric"|"footnote"|"bibliography"|"ibid"|"quote",
      "text": "exact span",
      "line": 1,
      "start": 0,
      "end": 10,
      "confidence": 0.9,
      "note": "optional issue or comment"
    }
  ],
  "bibEntries": [
    {
      "raw": "original entry",
      "style": "APA",
      "fields": { "author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":"" },
      "startLine": 1,
      "issues": []
    }
  ],
  "structureBlocks": [
    { "type": "heading"|"abstract"|"body"|"conclusion"|"bibliography"|"footnotes", "startLine": 1, "endLine": 5, "title": "" }
  ]
}`;

// ── Prompt: targeted conversion ───────────────────────────────────────────────
const CONVERT_PROMPT = `You are an expert academic citation conversion engine.
Given a scholarly document and a target citation style, perform ONLY the conversion scopes requested.

Conversion scopes (provided in the request):
- "citations"     — reformat all inline citations to the target style
- "bibliography"  — reformat all bibliography / reference list entries to the target style
- "structure"     — add or reformat section headings, abstract label, bibliography heading to match target style conventions
- "typos"         — fix obvious spelling and typographic errors (preserve academic terminology)
- "syntax"        — fix punctuation, spacing, hyphenation, quotation marks per target language norms

Rules:
- Preserve ALL non-citation wording exactly unless the scope includes "typos" or "syntax".
- If converted text is identical to input (nothing to change), set "convertedText" to null.
- Never invent citations or bibliography entries that are not in the original.

Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "brief description of what was converted",
  "convertedText": "full document with requested conversions applied, or null",
  "items": [],
  "bibEntries": [
    {
      "raw": "original entry",
      "converted": "reformatted entry",
      "fields": { "author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":"" }
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

function truncate(raw: string): string {
  return raw.length > MAX_TEXT_CHARS
    ? raw.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\n" + raw.slice(-MAX_TEXT_CHARS * 0.3)
    : raw;
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
  const generationConfig = { temperature: 0, responseMimeType: "application/json" };
  return callGemini(contents, generationConfig, apiKey);
}

// ── Handler: /api/ai-analyze ──────────────────────────────────────────────────
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
      items:           Array.isArray(parsed.items)          ? parsed.items          : [],
      bibEntries:      Array.isArray(parsed.bibEntries)     ? parsed.bibEntries     : [],
      structureBlocks: Array.isArray(parsed.structureBlocks)? parsed.structureBlocks: [],
      detectedStyle:   parsed.detectedStyle  ?? "Unknown",
      confidence:      typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:        (parsed.language as string) ?? language,
      summary:         typeof parsed.summary === "string" ? parsed.summary : "",
      structureSummary:typeof parsed.structureSummary === "string" ? parsed.structureSummary : "",
      convertedText:   null,
      _model:          model,
    });
  } catch (err) {
    res.status(502).json({ error: friendlyError(err) });
  }
}

// ── Handler: /api/ai-convert ──────────────────────────────────────────────────
export async function handleAiConvert(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-конвертации." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) { res.status(400).json({ error: "Текст не передан." }); return; }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : "APA";
  const language    = typeof req.body?.language    === "string" ? req.body.language    : detectLang(rawText);
  const scopes: string[] = Array.isArray(req.body?.scopes) ? req.body.scopes : ["citations", "bibliography"];

  const text = truncate(rawText);
  const userMsg = [
    `Language hint: ${language}`,
    `Target style: ${targetStyle}`,
    `Conversion scopes: ${scopes.join(", ")}`,
    "---BEGIN---",
    text,
    "---END---",
  ].join("\n");

  try {
    const { raw, model } = await runGemini(CONVERT_PROMPT, userMsg, apiKey);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("Gemini вернул ответ в неожиданном формате. Попробуйте ещё раз или сократите документ.");
    }
    res.json({
      items:         [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle  ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      (parsed.language as string) ?? language,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
      _model:        model,
    });
  } catch (err) {
    res.status(502).json({ error: friendlyError(err) });
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("TimeoutError") || msg.includes("signal timed out"))
    return "Gemini не ответил за 90 секунд. Попробуйте с более коротким документом.";
  if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED"))
    return "Не удалось подключиться к Gemini API. Проверьте интернет-соединение.";
  return msg;
}
