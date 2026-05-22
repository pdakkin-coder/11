/**
 * geminiRouter.ts — Gemini model cascade
 *
 * Cascade order (free-tier AI Studio limits, 2026-05):
 *   1. gemini-2.5-flash      —  5 RPM,  20 RPD  (primary)
 *   2. gemini-3.5-flash      —  5 RPM,  20 RPD  (fallback-1)
 *   3. gemini-3.1-flash-lite — 15 RPM, 500 RPD  (fallback-2)
 *
 * On any error (429, 503, timeout, network): advance to next model.
 * All models exhausted: throw with UTC-midnight RPD reset hint.
 */

export const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

export type GeminiModel = typeof MODELS[number];

const API_VERSION      = "v1beta";
const FETCH_TIMEOUT_MS = 30_000;

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
  systemInstruction?: object,
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  const res = await fetchWithTimeout(
    url,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
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

export interface GeminiResult {
  raw: string;
  model: GeminiModel;
}

/**
 * Main cascade: walk MODELS[], advance on ANY error.
 */
export async function callGemini(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  systemInstruction?: object,
): Promise<GeminiResult> {
  let lastError: unknown;

  for (const model of MODELS) {
    try {
      const raw = await callGeminiModel(contents, generationConfig, apiKey, model, systemInstruction);
      console.info(`[gemini-router] success with ${model}`);
      return { raw, model };
    } catch (err) {
      const e = err as Error & { status?: number };
      lastError = err;
      console.warn(`[gemini-router] ${model} failed (${e.status ?? "network"}), trying next model…`);
      continue;
    }
  }

  const lastMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Все модели Gemini недоступны (${MODELS.join(" → ")}). ` +
    `Последняя ошибка: ${lastMsg}. ` +
    `RPD сбрасывается в полночь UTC. ` +
    `Подождите или проверьте план: https://ai.dev/rate-limit`,
  );
}
