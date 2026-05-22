/**
 * AI-assisted citation analysis endpoint.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires GEMINI_API_KEY in environment.
 * Uses gemini-2.5-flash via geminiRouter.ts.
 */

import type { Request, Response } from "express";
import { callGemini, GeminiError } from "./geminiRouter.js";

const MAX_TEXT_CHARS = 24_000;

const SYSTEM_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, identify ALL inline citations, bibliography entries, and direct quotes.
Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).

When a Target style is provided, you MUST:
1. Read the full document as plain text.
2. Locate each citation and bibliography entry by its EXACT substring as it appears in the text.
3. Perform a global, deterministic find-and-replace:
   - Inline citations: replace each matching span with the correctly formatted version in the Target style.
   - Bibliography entries: replace each raw entry with its correctly formatted Target-style version.
4. Preserve ALL non-citation wording, whitespace, punctuation, and line breaks EXACTLY as in the input.
5. Never invent authors, years, titles, or other fields. If a required field is missing, keep the
   original string unchanged and note the issue in the item's "note" field.
6. Return the FULL resulting document — with all replacements applied — as "convertedText".

If target style matches the detected style or no conversion is needed, set "convertedText" to null.

Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description",
  "convertedText": "full document with converted citations, or null",
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
      "converted": "reformatted entry",
      "fields": { "author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":"" },
      "startLine": 1
    }
  ]
}`;

function detectLang(text: string): "ru" | "en" | "mixed" {
  const ru = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const en = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const total = ru + en;
  if (!total) return "ru";
  const ratio = ru / total;
  return ratio > 0.7 ? "ru" : ratio < 0.3 ? "en" : "mixed";
}

export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) {
    res.status(400).json({ error: "Текст не передан." });
    return;
  }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : null;
  const language = typeof req.body?.language === "string"
    ? req.body.language as "ru" | "en" | "mixed"
    : detectLang(rawText);

  // Trim to limit — keep beginning and end of document
  const text = rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, Math.floor(MAX_TEXT_CHARS * 0.7))
      + "\n[...]документ сокращён до 24к символов...\n"
      + rawText.slice(-Math.floor(MAX_TEXT_CHARS * 0.3))
    : rawText;

  const hints: string[] = [`Language hint: ${language}`];
  if (targetStyle) hints.push(`Target style for conversion: ${targetStyle}`);
  const userMsg = [...hints, "---BEGIN DOCUMENT---", text, "---END DOCUMENT---"].join("\n");

  const systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };
  const contents = [{ role: "user", parts: [{ text: userMsg }] }];
  const generationConfig = { temperature: 0 };

  try {
    const raw = await callGemini(contents, generationConfig, apiKey, systemInstruction);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("[ai-analyze] JSON parse failed, raw:", raw.slice(0, 200));
      res.status(502).json({
        error: "Gemini вернул ответ не в JSON-формате. Попробуйте ещё раз или сократите документ.",
      });
      return;
    }

    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: typeof parsed.detectedStyle === "string" ? parsed.detectedStyle : "Unknown",
      confidence:    typeof parsed.confidence    === "number" ? parsed.confidence    : 0,
      language:      typeof parsed.language      === "string" ? parsed.language      : language,
      summary:       typeof parsed.summary       === "string" ? parsed.summary       : "",
      convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
      _model:        "gemini-2.5-flash",
      _label:        "Gemini 2.5 Flash",
    });
  } catch (err) {
    if (err instanceof GeminiError) {
      res.status(err.httpStatus).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
}
