/**
 * geminiRouter.ts — single Gemini API call, no cascade
 *
 * Makes one request to gemini-2.5-flash.
 * Returns the raw text from the model response.
 * Throws a typed GeminiError on any failure.
 */

export const MODEL = "gemini-2.5-flash";
const API_VERSION  = "v1beta";
const TIMEOUT_MS   = 60_000; // 60s — generous for large documents

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function parseRetryAfter(body: string): number | undefined {
  // Gemini 429 body contains "Please retry in 54.41s"
  const match = body.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : undefined;
}

export async function callGemini(
  contents: object[],
  generationConfig: object,
  apiKey: string,
  systemInstruction?: object,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as Error;
    if (e.name === "AbortError") {
      throw new GeminiError(
        "Gemini не ответил за 60 секунд. Попробуйте с более коротким документом.",
        504,
      );
    }
    throw new GeminiError(
      `Не удалось подключиться к Gemini API: ${e.message}`,
      502,
    );
  } finally {
    clearTimeout(timer);
  }

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

  const errBody = await res.text();
  console.error(`[gemini] HTTP ${res.status}:`, errBody.slice(0, 400));

  if (res.status === 429) {
    const retryAfterMs = parseRetryAfter(errBody);
    const seconds = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
    throw new GeminiError(
      `Лимит запросов Gemini исчерпан. Повторите через ${seconds} секунд.`,
      429,
      retryAfterMs,
    );
  }

  if (res.status === 503) {
    throw new GeminiError(
      "Gemini API временно перегружен. Повторите через несколько секунд.",
      503,
    );
  }

  throw new GeminiError(
    `Gemini API ошибка ${res.status}. Повторите запрос.`,
    res.status >= 500 ? 502 : 400,
  );
}
