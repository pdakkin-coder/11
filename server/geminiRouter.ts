/**
 * geminiRouter.ts — Gemini model cascade
 *
 * Cascade order (free-tier AI Studio limits, 2026-05):
 *   1. gemini-2.5-flash      —  5 RPM,  20 RPD  (primary)
 *   2. gemini-3.5-flash      —  5 RPM,  20 RPD  (fallback-1)
 *   3. gemini-3.1-flash-lite — 15 RPM, 500 RPD  (fallback-2)
 *
 * On 429 or 503: immediately advance to next model (no retries — overloaded
 *   models rarely recover within seconds).
 * On AbortError / network error (status === undefined): retry once, then advance.
 * All models exhausted: throw with UTC-midnight RPD reset hint.
 */

export const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

export type GeminiModel = typeof MODELS[number];

const API_VERSION      = "v1beta";
const FETCH_TIMEOUT_MS = 15_000; // 15s → 3 models = 45s max, well within Express limit

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
 * Try one model.
 * - 429 / 503: throw immediately so cascade advances (no point waiting).
 * - AbortError / network (status===undefined): one retry after 1s, then throw.
 * - Everything else: throw immediately.
 */
async function tryModel(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  model: GeminiModel,
): Promise<string> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await callGeminiModel(contents, generationConfig, apiKey, model);
    } catch (err) {
      const e = err as Error & { status?: number; name?: string };

      // 429 / 503 — advance cascade immediately, no retries
      if (e.status === 429 || e.status === 503) throw e;

      // Network / abort — one retry
      const isNetworkBlip = e.status === undefined;
      if (isNetworkBlip && attempt === 0) {
        console.warn(`[gemini-router] ${model} network blip, retrying once…`);
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      // Everything else (400, 404, 500…) or second network failure
      throw e;
    }
  }
  // unreachable
  throw new Error(`Gemini [${model}]: все попытки исчерпаны`);
}

export interface GeminiResult {
  raw: string;
  model: GeminiModel;
}

/**
 * Main cascade: walk MODELS[], advance on 429 or 503.
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
        console.warn(`[gemini-router] ${model} quota (429) → next model`);
        continue;
      }
      if (e.status === 503) {
        console.warn(`[gemini-router] ${model} overloaded (503) → next model`);
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    `Все модели Gemini недоступны (${MODELS.join(" → ")}). ` +
    `RPD сбрасывается в полночь UTC. ` +
    `Подождите или проверьте план: https://ai.dev/rate-limit`,
  );
}
