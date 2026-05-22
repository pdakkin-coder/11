/**
 * AI-assisted citation analysis endpoint.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires GEMINI_API_KEY in environment.
 * Model cascade (geminiRouter.ts):
 *   gemini-2.5-flash → gemini-3.5-flash → gemini-3.1-flash-lite
 */

import type { Request, Response } from "express";
import { callGemini } from "./geminiRouter.js";

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
  const t = ru + en;
  if (!t) return "ru";
  const r = ru / t;
  return r > 0.7 ? "ru" : r < 0.3 ? "en" : "mixed";
}

/** Classify an error into a user-friendly Russian message. */
function friendlyError(err: unknown): { message: string; status: number } {
  const msg  = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? (err.name ?? "") : "";
  const httpStatus = (err as { status?: number }).status;

  // AbortError = our fetchWithTimeout fired — this is a TIMEOUT, not a network error
  if (
    name === "AbortError" ||
    msg.includes("AbortError") ||
    msg.includes("aborted") ||
    msg.includes("timed out") ||
    msg.includes("TimeoutError")
  ) {
    return {
      message: `Gemini не ответил за отведённое время. Попробуйте с более коротким документом или повторите запрос.`,
      status: 504,
    };
  }

  // All models exhausted
  if (msg.includes("Все модели Gemini") || msg.includes("RPD")) {
    return { message: msg, status: 503 };
  }

  // Network / DNS
  if (
    msg.includes("fetch failed") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET")
  ) {
    return {
      message: "Не удалось подключиться к Gemini API. Проверьте интернет-соединение.",
      status: 502,
    };
  }

  // JSON parse error from model
  if (msg.includes("неожиданном формате")) {
    return { message: msg, status: 502 };
  }

  return { message: msg, status: httpStatus ?? 502 };
}

export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) { res.status(400).json({ error: "Текст не передан." }); return; }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : null;
  const language   = typeof req.body?.language   === "string" ? req.body.language   : detectLang(rawText);

  const text = rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\n" + rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;

  const hints = [`Language hint: ${language}`];
  if (targetStyle) hints.push(`Target style for conversion: ${targetStyle}`);
  const userMsg = [...hints, "---BEGIN DOCUMENT---", text, "---END DOCUMENT---"].join("\n");

  const contents = [
    { role: "user",  parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Understood. I will analyze the document and return only valid JSON with no markdown fences." }] },
    { role: "user",  parts: [{ text: userMsg }] },
  ];

  const generationConfig = {
    temperature: 0,
    responseMimeType: "application/json",
  };

  try {
    const { raw, model } = await callGemini(contents, generationConfig, apiKey);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "Gemini вернул ответ в неожиданном формате. Попробуйте ещё раз или сократите документ."
      );
    }

    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      (parsed.language as string) ?? language,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
      _model:        model,
    });
  } catch (err) {
    const { message, status } = friendlyError(err);
    res.status(status).json({ error: message });
  }
}
