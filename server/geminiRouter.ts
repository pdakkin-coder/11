/**
 * geminiRouter.ts — Gemini model cascade
 *
 * Cascade order (free-tier AI Studio limits):
 *   1. gemini-2.5-flash     —  5 RPM,  20 RPD  (primary)
 *   2. gemini-1.5-flash     — 15 RPM, 1500 RPD (fallback-1)
 *   3. gemini-1.5-flash-8b  — 15 RPM, 1500 RPD (fallback-2)
 *
 * Cascade advance triggers:
 *   429 Rate-limit    → advance immediately to next model
 *   503 Unavailable   → retry same model 2×, then advance to next
 *   Network error     → retry same model 2×, then throw
 *   Other HTTP error  → throw immediately (no cascade)
 */

export const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
] as const;

export type GeminiModel = (typeof MODELS)[number];

const API_VERSION      = "v1beta";
const FETCH_TIMEOUT_MS = 25_000; // 25s per model attempt
const RETRY_DELAYS_MS  = [1_500, 4_000] as const; // delays between retries within one model

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
 * Try one model with up to 2 retries on transient errors (503 / network blip).
 * Other HTTP errors are thrown immediately without retry.
 *
 * Returns { raw, exhausted503: false } on success.
 * If all retries are consumed on 503 / network, throws with flag exhausted503 = true
 * so the caller can decide to advance to the next model.
 */
async function tryModel(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  model: GeminiModel,
): Promise<string> {
  let lastError: (Error & { status?: number }) | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      console.warn(
        `[gemini-router] ${model} transient error, retry ${attempt}/${RETRY_DELAYS_MS.length} ` +
        `in ${RETRY_DELAYS_MS[attempt - 1]}ms…`
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }

    try {
      return await callGeminiModel(contents, generationConfig, apiKey, model);
    } catch (err) {
      const e = err as Error & { status?: number };
      const isTransient = e.status === 503 || e.status === undefined;

      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        lastError = e;
        continue; // retry same model
      }

      // Non-transient error OR retries exhausted — bubble up to cascade
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
 * Hard errors (400, 401, 404, 500…) are thrown immediately without cascade.
 */
export async function callGemini(
  contents: object[],
  generationConfig: object,
  apiKey: string,
): Promise<GeminiResult> {
  const skippable = new Set([429, 503]);

  for (const model of MODELS) {
    try {
      const raw = await tryModel(contents, generationConfig, apiKey, model);
      console.info(`[gemini-router] success with ${model}`);
      return { raw, model };
    } catch (err) {
      const e = err as Error & { status?: number };

      if (e.status !== undefined && skippable.has(e.status)) {
        // 429 — quota exceeded; 503 — overloaded after all retries
        console.warn(
          `[gemini-router] ${model} HTTP ${e.status} — ` +
          `${e.status === 429 ? "quota exceeded" : "overloaded after retries"}, ` +
          `advancing to next model…`
        );
        continue;
      }

      // Non-skippable error — fail fast
      throw e;
    }
  }

  throw new Error(
    `Квота / перегрузка на всех моделях (${MODELS.join(" → ")}). ` +
    `RPD сбрасывается в полночь UTC. ` +
    `Подождите до следующего дня или проверьте план: https://ai.dev/rate-limit`
  );
}
