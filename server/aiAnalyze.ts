/**
 * AI-assisted citation analysis endpoint.
 *
 * POST /api/ai-analyze
 * Body: { text: string; targetStyle?: string; language?: string }
 *
 * Requires GEMINI_API_KEY in environment.
 * Model cascade: gemini-2.5-flash → gemini-2.0-flash (on 429)
 * Falls back gracefully if AI is unavailable.
 */

import type { Request, Response } from "express";

const MODEL_PRIMARY  = "gemini-2.5-flash";
const MODEL_FALLBACK = "gemini-2.0-flash";
const API_VERSION    = "v1beta";
const MAX_TEXT_CHARS  = 24_000;
const RETRY_DELAYS_MS = [1_500, 4_000];
const FETCH_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, identify ALL inline citations, bibliography entries, and direct quotes.
Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).
If the user provides a Target style, also return the FULL DOCUMENT text with ALL citations
converted into that target style as the "convertedText" field. Preserve all non-citation wording exactly.
If target style matches detected style or no conversion is needed, set "convertedText" to null.

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

/**
 * Call one specific Gemini model. Returns raw text or throws.
 * Does NOT retry — retry/fallback logic lives in callGemini.
 */
async function callGeminiModel(userMsg: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;
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
    // Strip markdown fences Gemini may include despite responseMimeType
    return raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }

  const errText = (await res.text()).slice(0, 600);
  const err = new Error(`Gemini ${res.status}: ${errText}`) as Error & { status: number };
  err.status = res.status;
  throw err;
}

/**
 * Primary: gemini-2.5-flash with 503-retry.
 * On 429 → immediate fallback to gemini-2.0-flash (same retry policy).
 * On 429 from fallback → throw with a clear quota message.
 */
async function callGemini(userMsg: string, apiKey: string): Promise<{ raw: string; model: string }> {
  async function tryModel(model: string): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        return await callGeminiModel(userMsg, apiKey, model);
      } catch (err) {
        const e = err as Error & { status?: number };
        // Retry only on 503 (overloaded) or transient network errors
        if ((e.status === 503 || !e.status) && attempt < RETRY_DELAYS_MS.length) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    throw lastError ?? new Error(`Gemini (${model}): все попытки исчерпаны`);
  }

  // ── Primary model ──────────────────────────────────────────────────────────
  try {
    const raw = await tryModel(MODEL_PRIMARY);
    return { raw, model: MODEL_PRIMARY };
  } catch (primaryErr) {
    const e = primaryErr as Error & { status?: number };

    // 429 on primary → try fallback model
    if (e.status === 429) {
      console.warn(`[ai-analyze] ${MODEL_PRIMARY} quota exceeded (429), switching to ${MODEL_FALLBACK}`);
      try {
        const raw = await tryModel(MODEL_FALLBACK);
        return { raw, model: MODEL_FALLBACK };
      } catch (fallbackErr) {
        const fe = fallbackErr as Error & { status?: number };
        if (fe.status === 429) {
          throw new Error(
            `Квота исчерпана на обеих моделях (${MODEL_PRIMARY} и ${MODEL_FALLBACK}). ` +
            `Подождите несколько минут или проверьте план на https://ai.dev/rate-limit`
          );
        }
        throw fallbackErr;
      }
    }

    throw primaryErr;
  }
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

  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : null;
  const language   = typeof req.body?.language   === "string" ? req.body.language   : detectLang(rawText);

  const text = rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) + "\n[...]\n" + rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;

  const hints = [`Language hint: ${language}`];
  if (targetStyle) hints.push(`Target style for conversion: ${targetStyle}`);
  const userMsg = [...hints, "---BEGIN---", text, "---END---"].join("\n");

  try {
    const { raw, model } = await callGemini(userMsg, apiKey);

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
    const msg = err instanceof Error ? err.message : String(err);

    const friendly =
      msg.includes("TimeoutError") || msg.includes("signal timed out")
        ? "Gemini не ответил за 90 секунд. Попробуйте с более коротким документом."
        : msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")
          ? "Не удалось подключиться к Gemini API. Проверьте интернет-соединение."
          : msg;

    res.status(502).json({ error: friendly });
  }
}
