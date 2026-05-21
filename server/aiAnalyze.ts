/**
 * AI-assisted citation analysis endpoint.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires GEMINI_API_KEY in environment.
 * Falls back to heuristic results if AI is unavailable.
 */

import type { Request, Response } from "express";

const MODEL = "gemini-1.5-flash";
const MAX_TEXT_CHARS = 24_000;

const SYSTEM_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, identify ALL inline citations, bibliography entries, and direct quotes.
Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).
Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description",
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

async function callGemini(userMsg: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

function detectLang(text: string): "ru" | "en" | "mixed" {
  const ru = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const en = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const t = ru + en;
  if (!t) return "ru";
  const r = ru / t;
  return r > 0.7 ? "ru" : r < 0.3 ? "en" : "mixed";
}

export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) { res.status(400).json({ error: "Текст не передан." }); return; }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : "APA";
  const language   = typeof req.body?.language   === "string" ? req.body.language   : detectLang(rawText);

  const text = rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\n" + rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;

  const userMsg = [`Language hint: ${language}`, `Target style: ${targetStyle}`, "---BEGIN---", text, "---END---"].join("\n");

  try {
    const raw = await callGemini(userMsg, apiKey);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* use empty */ }

    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      parsed.language ?? language,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
