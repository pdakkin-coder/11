import type { Request, Response } from "express";

const MODELS = [
  { id: "gemini-2.5-flash",    label: "Gemini 2.5 Flash" },
  { id: "gemini-1.5-flash",    label: "Gemini 1.5 Flash (fallback)" },
  { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash-8B (fallback)" },
] as const;

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const SYSTEM_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document, identify ALL inline citations, bibliography entries, and direct quotes.
Determine the citation style (APA 7, Chicago 17, MLA 9, IEEE, Vancouver, Harvard, GOST 7.0.5).

When a Target style is provided:
- Replace each inline citation and bibliography entry with the correctly formatted Target-style version.
- Preserve ALL non-citation text, whitespace, punctuation, and line breaks EXACTLY.
- Return the full converted document as "convertedText".
- If no conversion needed, set "convertedText" to null.

Return ONLY valid JSON, no markdown fences:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description",
  "convertedText": "full converted document or null",
  "items": [{
    "id": "ai-0",
    "type": "inline-apa"|"inline-numeric"|"footnote"|"bibliography"|"ibid"|"quote",
    "text": "exact span",
    "line": 1,
    "start": 0,
    "end": 10,
    "confidence": 0.9,
    "note": "optional"
  }],
  "bibEntries": [{
    "raw": "original entry",
    "style": "APA",
    "converted": "reformatted entry or null",
    "fields": {"author":"","year":"","title":"","source":"","publisher":"","place":"","pages":"","doi":"","url":""},
    "startLine": 1
  }]
}`;

function buildPrompt(text: string, language: string, targetStyle?: string): string {
  const lines = [
    `Language: ${language}`,
    targetStyle ? `Convert citations to: ${targetStyle}` : null,
    "---BEGIN DOCUMENT---",
    text,
    "---END DOCUMENT---",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Call one Gemini model. Returns { ok, status, body, aborted }. Never throws. */
async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; body: string; aborted: boolean }> {
  try {
    const res = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
      signal,
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, aborted: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      msg.toLowerCase().includes("abort");
    return { ok: false, status: 0, body: msg, aborted };
  }
}

/** Returns true when we should try the next model in the cascade. */
function shouldTryNext(r: { ok: boolean; status: number; aborted: boolean }): boolean {
  if (r.ok) return false;
  // quota / overload / network / abort → retry with next tier
  return r.aborted || r.status === 429 || r.status === 503 || r.status === 0;
}

export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY not set" });
    return;
  }

  const rawText     = typeof req.body?.text        === "string" ? req.body.text        : "";
  const targetStyle = typeof req.body?.targetStyle === "string" ? req.body.targetStyle : undefined;
  const language    = typeof req.body?.language    === "string" ? req.body.language    : "mixed";

  if (!rawText.trim()) {
    res.status(400).json({ error: "Текст не передан" });
    return;
  }

  // Trim oversized documents
  const text = rawText.length > 24_000
    ? rawText.slice(0, 16_800) + "\n[...]\n" + rawText.slice(-7_200)
    : rawText;

  const prompt = buildPrompt(text, language, targetStyle);

  // --- Cascade through models ---
  let geminiResult!: { ok: boolean; status: number; body: string; aborted: boolean };
  let usedModel = MODELS[0].id;
  let usedLabel = MODELS[0].label;

  for (const model of MODELS) {
    geminiResult = await callGemini(apiKey, model.id, prompt);
    usedModel    = model.id;
    usedLabel    = model.label;

    if (geminiResult.ok) break;

    if (shouldTryNext(geminiResult)) {
      console.warn(`[gemini] ${model.id} returned ${geminiResult.status} (abort=${geminiResult.aborted}), trying next model`);
      continue;
    }

    // Hard error (4xx other than 429) — no point retrying
    break;
  }

  if (!geminiResult.ok) {
    console.error(`[gemini] all models failed. last: ${usedModel} ${geminiResult.status}:`, geminiResult.body.slice(0, 300));
    const status = geminiResult.status || 502;
    res.status(status).json({ error: geminiResult.body });
    return;
  }

  // --- Extract model text ---
  let modelText: string;
  try {
    const geminiJson = JSON.parse(geminiResult.body) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    modelText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    res.status(502).json({ error: "Не удалось распарсить ответ Gemini" });
    return;
  }

  // Strip possible markdown fences
  const clean = modelText
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // --- Parse JSON from model ---
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    console.error("[gemini] model returned non-JSON:", clean.slice(0, 200));
    res.status(502).json({ error: "Модель вернула не JSON. Попробуйте ещё раз." });
    return;
  }

  // --- Send structured response to client ---
  res.json({
    items:         Array.isArray(parsed.items)      ? parsed.items      : [],
    bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
    detectedStyle: typeof parsed.detectedStyle === "string" ? parsed.detectedStyle : "Unknown",
    confidence:    typeof parsed.confidence    === "number" ? parsed.confidence    : 0,
    language:      typeof parsed.language      === "string" ? parsed.language      : language,
    summary:       typeof parsed.summary       === "string" ? parsed.summary       : "",
    convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
    _model:        usedModel,
    _label:        usedLabel,
  });
}
