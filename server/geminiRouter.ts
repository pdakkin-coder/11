/**
 * geminiRouter.ts — Gemini model cascade
 *
 * Cascade order (as of 2026-05-21, free-tier AI Studio limits):
 *   1. gemini-2.5-flash      —  5 RPM,  20 RPD  (primary)
 *   2. gemini-3.5-flash      —  5 RPM,  20 RPD  (fallback-1)
 *   3. gemini-3.1-flash-lite — 15 RPM, 500 RPD  (fallback-2)
 *
 * On 429: advance to next model in cascade.
 * On 503: retry within same model (up to 2x), then advance to next model.
 * On transient network error (status === undefined): retry within same model.
 * All models exhausted: throw with UTC-midnight RPD reset hint.
 */

export const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

export type GeminiModel = typeof MODELS[number];

const API_VERSION      = "v1beta";
const FETCH_TIMEOUT_MS = 25_000; // 25s per model → 3×25s = 75s < Express timeout
const RETRY_DELAYS_MS  = [1_500, 4_000] as const;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiModel(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  model: GeminiModel,
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(
    url,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contents, generationConfig }),
    },
    FETCH_TIMEOUT_MS,
  );

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
  console.error(`[gemini-router] ${model} HTTP ${res.status}: ${errText}`);
  const err = new Error(`Gemini [${model}] ${res.status}: ${errText}`) as Error & { status: number };
  err.status = res.status;
  throw err;
}

/**
 * Try one model with retries.
 * Retries ONLY on: 503 (overload) or status === undefined (transient network blip).
 * Any other HTTP error (400, 404, 429, 500...) is thrown immediately.
 */
async function tryModel(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  model: GeminiModel,
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      return await callGeminiModel(contents, generationConfig, apiKey, model);
    } catch (err) {
      const e = err as Error & { status?: number };
      // Retry only on 503 or genuinely transient network errors (no HTTP status at all)
      const isTransient = e.status === 503 || e.status === undefined;
      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error(`Gemini [${model}]: все попытки исчерпаны`);
}

export interface GeminiResult {
  raw: string;
  model: GeminiModel;
}

/**
 * Main cascade: walk MODELS[], advance on 429 (quota) or 503 (overload after retries).
 * Non-skippable HTTP errors (400, 404, 500...) are thrown immediately.
 */
export async function callGemini(
  contents: object[],
  generationConfig: object,
  apiKey: string,
): Promise<GeminiResult> {
  for (const model of MODELS) {
    try {
      const raw = await tryModel(contents, generationConfig, apiKey, model);
      console.info(`[gemini-router] success with ${model}`);
      return { raw, model };
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429) {
        console.warn(`[gemini-router] ${model} quota exceeded (429), trying next model`);
        continue;
      }
      // NEW: also advance on 503 after retries are exhausted in tryModel
      if (e.status === 503) {
        console.warn(`[gemini-router] ${model} overloaded (503) after retries, trying next model`);
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    `Квота исчерпана на всех моделях (${MODELS.join(" → ")}). ` +
    `RPD сбрасывается в полночь UTC. ` +
    `Подождите до следующего дня или проверьте план: https://ai.dev/rate-limit`
  );
}
