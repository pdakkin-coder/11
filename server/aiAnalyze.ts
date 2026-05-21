/**
 * AI-assisted citation analysis — Gemini model router.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires GEMINI_API_KEY in environment.
 *
 * Model cascade (free-tier limits, May 2026):
 *   gemini-2.5-flash      →  5 RPM / 20 RPD   (primary, best quality)
 *   gemini-3.5-flash      →  5 RPM / 20 RPD   (fallback-1)
 *   gemini-3.1-flash-lite → 15 RPM / 500 RPD  (fallback-2, ~25× more RPD)
 *
 * On 429 from a model → cascade to next.
 * On 429 from last model → friendly error with midnight-UTC reset hint.
 * On 503 → exponential backoff (up to 2 retries) before cascading.
 */

import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

interface ModelConfig {
  id: string;
  label: string;
  rpm: number;
  rpd: number;
}

const MODELS: ModelConfig[] = [
  { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",       rpm:  5, rpd:  20 },
  { id: "gemini-3.5-flash",      label: "Gemini 3.5 Flash",       rpm:  5, rpd:  20 },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite",  rpm: 15, rpd: 500 },
];

const API_VERSION      = "v1beta";
const MAX_TEXT_CHARS   = 24_000;
const FETCH_TIMEOUT_MS = 95_000;
/** Delays between 503-retries per model attempt */
const RETRY_DELAYS_MS  = [1_500, 4_000];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, identify ALL inline citations, bibliography entries, and direct quotes.
Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).
If the user provides a Target style, also return the FULL DOCUMENT text with ALL citations
converted into that target style as the "convertedText" field.
Preserve all non-citation wording exactly.
If target style matches detected style, set "convertedText" to null.

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
      "converted": "reformatted entry or null",
      "fields": {
        "author": "",
        "year": "",
        "title": "",
        "source": "",
        "publisher": "",
        "place": "",
        "pages": "",
        "doi": "",
        "url": "",
        "volume": "",
        "issue": "",
        "type": ""
      },
      "startLine": 1
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Low-level: call one model, no retry
// ---------------------------------------------------------------------------

async function callGeminiModel(
  userMsg: string,
  apiKey: string,
  model: ModelConfig,
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/${API_VERSION}` +
    `/models/${model.id}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      { role: "user",  parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Understood. I will analyze the document and return only valid JSON with no markdown fences." }] },
      { role: "user",  parts: [{ text: userMsg }] },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (res.ok) {
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }

  const errText = (await res.text()).slice(0, 600);
  const err = new Error(`${model.label} → HTTP ${res.status}: ${errText}`) as Error & { status: number; isRpd: boolean };
  err.status = res.status;
  // Detect RPD (daily quota) exhaustion in the error body
  err.isRpd = errText.includes("RESOURCE_EXHAUSTED") && errText.includes("daily");
  throw err;
}

// ---------------------------------------------------------------------------
// Mid-level: call one model with 503-retry backoff
// ---------------------------------------------------------------------------

async function callWithRetry(
  userMsg: string,
  apiKey: string,
  model: ModelConfig,
): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      return await callGeminiModel(userMsg, apiKey, model);
    } catch (e) {
      const err = e as Error & { status?: number };
      // Retry only on 503 (overloaded) or transient network failure
      if ((err.status === 503 || !err.status) && attempt < RETRY_DELAYS_MS.length) {
        lastErr = err;
        console.warn(`[gemini-router] ${model.label} 503, retry ${attempt + 1}…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error(`${model.label}: все попытки исчерпаны`);
}

// ---------------------------------------------------------------------------
// High-level: cascade through model list
// ---------------------------------------------------------------------------

interface RouterResult {
  raw: string;
  model: ModelConfig;
}

async function callGeminiRouter(
  userMsg: string,
  apiKey: string,
): Promise<RouterResult> {
  let lastErr: Error | null = null;

  for (const model of MODELS) {
    try {
      console.log(`[gemini-router] Trying ${model.label} (RPM ${model.rpm}, RPD ${model.rpd})…`);
      const raw = await callWithRetry(userMsg, apiKey, model);
      console.log(`[gemini-router] ✓ ${model.label} responded.`);
      return { raw, model };
    } catch (e) {
      const err = e as Error & { status?: number; isRpd?: boolean };
      lastErr = err;

      if (err.status === 429) {
        const reason = err.isRpd
          ? `RPD исчерпан (лимит ${model.rpd} запросов/день)`
          : `RPM исчерпан (лимит ${model.rpm} запросов/мин)`;
        console.warn(`[gemini-router] ${model.label}: 429 — ${reason}. Каскад к следующей модели.`);
        continue; // try next model
      }

      // Non-quota error: propagate immediately (don't cascade on 400, 401, etc.)
      throw err;
    }
  }

  // All models exhausted
  const lastModel = MODELS[MODELS.length - 1];
  throw new Error(
    `Квота исчерпана на всех моделях каскада. ` +
    `Лучший резерв (${lastModel.label}) тоже отвечает 429. ` +
    `Лимиты сбрасываются в полночь по UTC — попробуйте завтра или проверьте план на https://aistudio.google.com/plan`,
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function detectLang(text: string): "ru" | "en" | "mixed" {
  const ru = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const en = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const t = ru + en;
  if (!t) return "ru";
  const r = ru / t;
  return r > 0.7 ? "ru" : r < 0.3 ? "en" : "mixed";
}

/**
 * Smart truncation: keep first 70% and last 30% of the allowed budget
 * so that both the introduction and bibliography are preserved.
 */
function smartTruncate(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  const head = Math.floor(MAX_TEXT_CHARS * 0.7);
  const tail = MAX_TEXT_CHARS - head;
  return text.slice(0, head) + "\n[... текст сокращён для AI-анализа ...]\n" + text.slice(-tail);
}

// ---------------------------------------------------------------------------
// Express handler
// ---------------------------------------------------------------------------

export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа.",
    });
    return;
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text : "";
  if (!rawText.trim()) {
    res.status(400).json({ error: "Текст не передан." });
    return;
  }

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : null;
  const language    = typeof req.body?.language    === "string" ? req.body.language    : detectLang(rawText);

  const text = smartTruncate(rawText);

  const hints = [`Language hint: ${language}`];
  if (targetStyle) hints.push(`Target style for conversion: ${targetStyle}`);
  const userMsg = [...hints, "---BEGIN---", text, "---END---"].join("\n");

  try {
    const { raw, model } = await callGeminiRouter(userMsg, apiKey);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "Gemini вернул ответ в неожиданном формате. Попробуйте ещё раз или сократите документ.",
      );
    }

    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      (parsed.language as string) ?? language,
      summary:       typeof parsed.summary      === "string" ? parsed.summary      : "",
      convertedText: typeof parsed.convertedText === "string" && parsed.convertedText.trim()
        ? parsed.convertedText
        : null,
      _model:  model.id,
      _label:  model.label,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const friendly =
      msg.includes("TimeoutError") || msg.includes("signal timed out")
        ? "Gemini не ответил за 95 секунд. Попробуйте с более коротким документом."
        : msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")
          ? "Не удалось подключиться к Gemini API. Проверьте интернет-соединение сервера."
          : msg;

    res.status(502).json({ error: friendly });
  }
}
