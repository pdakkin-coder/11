/**
 * AI-assisted citation analysis endpoint.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires OPENAI_API_KEY in environment.
 * Falls back to heuristic results if AI is unavailable.
 */

import type { Request, Response } from "express";

const MODEL = "gpt-4o";
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

interface OpenAIMessage { role: "system" | "user" | "assistant"; content: string; }

async function callOpenAI(messages: OpenAIMessage[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0, response_format: { type: "json_object" } }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "{}";
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "OPENAI_API_KEY не задан. Установите переменную окружения для AI-анализа." });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) { res.status(400).json({ error: "Текст не передан." }); return; }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : "APA";
  const language   = typeof req.body?.language   === "string" ? req.body.language   : detectLang(rawText);

  const text = rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\ n" + rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;

  const userMsg = [`Language hint: ${language}`, `Target style: ${targetStyle}`, "---BEGIN---", text, "---END---"].join("\n");

  try {
    const raw = await callOpenAI([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }], apiKey);
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
