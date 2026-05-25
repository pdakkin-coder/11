/**
 * AI-assisted citation analysis & conversion endpoints.
 *
 * POST /api/ai-analyze  — structural + citation analysis
 * POST /api/ai-convert  — targeted conversion of annotated blocks
 *
 * Requires GEMINI_API_KEY in environment.
 * Returns _model (ID) and _label (human-readable) so the client can display
 * which Gemini model actually handled the request.
 *
 * Evidence-Pack pipeline:
 *   Client sends { heuristicSummary, evidence[], bibliographyCandidates[],
 *                  structureCandidates[], selectedFragment?, scope, targetStyle? }
 *   instead of raw text. This reduces token usage 5-10x.
 *   Legacy requests with req.body.text are still accepted for compatibility.
 */

import type { Request, Response } from "express";
import { callGemini, modelLabel } from "./geminiRouter.js";

const MAX_TEXT_CHARS = 24_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function detectLang(text: string): "ru" | "en" | "mixed" {
  const ru = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const en = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const t  = ru + en;
  if (!t) return "ru";
  const r = ru / t;
  return r > 0.7 ? "ru" : r < 0.3 ? "en" : "mixed";
}

function truncate(rawText: string): string {
  return rawText.length > MAX_TEXT_CHARS
    ? rawText.slice(0, MAX_TEXT_CHARS * 0.7) +
      "\n[...document truncated for token efficiency...]\n" +
      rawText.slice(-MAX_TEXT_CHARS * 0.3)
    : rawText;
}

async function runGemini(
  systemPrompt: string,
  userMsg: string,
  apiKey: string,
): Promise<{ raw: string; model: string; label: string }> {
  const contents = [
    { role: "user",  parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I will return only valid JSON with no markdown fences." }] },
    { role: "user",  parts: [{ text: userMsg }] },
  ];
  return callGemini(
    contents,
    { temperature: 0, responseMimeType: "application/json" },
    apiKey,
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("TimeoutError") || msg.includes("signal timed out"))
    return "Gemini не ответил за 90 секунд. Попробуйте с более коротким документом.";
  if (
    msg.includes("fetch failed") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNREFUSED")
  ) return "Не удалось подключиться к Gemini API. Проверьте интернет-соединение.";
  return msg;
}

/**
 * Build a compact Evidence-Pack string from the structured request body.
 * Used when the client sends the new evidence-pack format instead of raw text.
 */
function buildEvidencePackMsg(body: Record<string, unknown>): string {
  const summary = body.heuristicSummary as Record<string, unknown> | undefined;
  const evidence = Array.isArray(body.evidence) ? body.evidence : [];
  const bibCandidates = Array.isArray(body.bibliographyCandidates)
    ? body.bibliographyCandidates
    : [];
  const structCandidates = Array.isArray(body.structureCandidates)
    ? body.structureCandidates
    : [];
  const fragment = body.selectedFragment as Record<string, unknown> | undefined;

  const parts: string[] = [];

  if (summary) {
    parts.push(
      `HEURISTIC SUMMARY:\n${JSON.stringify(summary, null, 2)}`,
    );
  }
  if (evidence.length) {
    parts.push(
      `EVIDENCE SNIPPETS (${evidence.length}):\n` +
      JSON.stringify(evidence.slice(0, 80), null, 2),
    );
  }
  if (bibCandidates.length) {
    parts.push(
      `BIBLIOGRAPHY CANDIDATES (${bibCandidates.length}):\n` +
      JSON.stringify(bibCandidates.slice(0, 40), null, 2),
    );
  }
  if (structCandidates.length) {
    parts.push(
      `STRUCTURE CANDIDATES (${structCandidates.length}):\n` +
      JSON.stringify(structCandidates.slice(0, 20), null, 2),
    );
  }
  if (fragment) {
    parts.push(
      `SELECTED FRAGMENT (chars ${fragment.charStart}–${fragment.charEnd}):\n"${fragment.text}"`,
    );
  }

  return parts.join("\n\n");
}

// ── Analysis prompt ────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `You are an expert academic citation analysis engine.
Given a scholarly document (or a compact evidence pack extracted from it),
perform THREE tasks:

1. STRUCTURE ANALYSIS — identify logical sections (title, abstract, introduction,
   methodology, results, discussion, conclusion, notes, bibliography). For each
   section return: heading text, start line, end line, nesting level (1–3).

2. CITATION ANALYSIS — identify ALL inline citations, bibliography entries, and
   direct quotes. Determine the citation style:
   APA 7 | Chicago 17 | MLA 9 | IEEE | Vancouver | Harvard | GOST 7.0.5
   For each item return exact span, line, character offsets, confidence, note.

   GOST 7.0.5 markers:
   - Author pattern: Иванов И.И. (surname then initials with dots)
   - City abbreviations: М.: / СПб.: / Л.: before publisher
   - Tag: [Электронный ресурс]
   - Volume/issue: Т. N, № N    |   Pages: С. N–N
   - Inline refs: [N] or [Фамилия И.О., год, с. N]
   - Em-dash (—) as field separator in bibliography entries

3. BLOCK ANNOTATION — assign each item a type:
   "inline-apa" | "inline-numeric" | "footnote" | "bibliography" | "ibid" | "quote"

Return ONLY valid JSON — no markdown fences, no prose:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "language": "ru"|"en"|"mixed",
  "summary": "one-sentence description",
  "convertedText": null,
  "structure": [
    { "heading": "string", "level": 1, "startLine": 1, "endLine": 10 }
  ],
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
      "converted": null,
      "fields": {
        "author": "", "year": "", "title": "", "source": "",
        "publisher": "", "place": "", "pages": "",
        "doi": "", "url": "", "volume": "", "issue": "", "type": ""
      },
      "startLine": 1
    }
  ]
}`;

// ── Conversion prompt ──────────────────────────────────────────────────────
//
// CRITICAL CONTRACT (enforced by this prompt):
//   The model MUST return items[] where every element carries a "text" field
//   containing the converted span. The client uses these to do surgical
//   applySelectiveConversion() and then shows a preview — the user must
//   explicitly press «Применить» before any text change is committed.
//   convertedText is still required as a full-document fallback but items[]
//   is the primary delivery mechanism.
//
const CONVERT_PROMPT = `You are an expert academic document editor specialising in
citation reformatting, bibliography normalisation, and academic style correction.

The user will provide:
- The FULL document text (or an evidence pack) with annotated citations
- A TARGET citation style
- A SCOPE array (any combination):
    "citations"    — reformat inline citations to target style
    "bibliography" — reformat bibliography / reference-list entries
    "structure"    — normalise section headings to academic conventions
    "typos"        — fix spelling / typography errors (Russian and English)
    "syntax"       — fix punctuation, spacing, dashes, quotation marks

Rules:
- Process ONLY the scope items listed. Do NOT touch anything else.
- Preserve all non-target text verbatim.
- Return the FULL converted document in "convertedText".
- Return individual bibEntries with "converted" fields filled.
- Set "convertedText" to null only if no changes were needed.

ITEM REPLACEMENT CONTRACT (mandatory — do not skip):
  For EVERY span that was changed, include an entry in "items" with:
    { "id": "c-0", "start": <char offset in ORIGINAL text>,
      "end": <char offset in ORIGINAL text>, "text": "<converted span>",
      "type": "inline-apa"|"inline-numeric"|"footnote"|"bibliography"|"ibid"|"quote" }
  "start" and "end" MUST reference byte/character positions in the ORIGINAL
  (unconverted) document, not in convertedText.
  If nothing changed, return "items": [].
  Example — original has "(Smith, 2019)" at chars 120-133, converted to "[1]":
    { "id": "c-0", "start": 120, "end": 133, "text": "[1]", "type": "inline-apa" }

GOST 7.0.5-2008 RULES (apply when targetStyle is "GOST"):
- Author: Фамилия И.О. — surname first, initials with dots
  Multiple authors separated by ", "; if >3 authors use first author + " [и др.]"
- Inline citation: [N] where N is sequential reference number
- Book:     Фамилия И.О. Название. — Место : Издательство, Год. — N с.
- Journal:  Фамилия И.О. Название статьи // Журнал. — Год. — Т. N, № N. — С. N–N. — DOI: 10.xxx
- Web:      Фамилия И.О. Название [Электронный ресурс]. — URL: https://... (дата обращения: ДД.ММ.ГГГГ).
- Thesis:   Фамилия И.О. Название : дис. … канд./д-р наук / Учреждение. — Место, Год. — N с.
- Conf:     Фамилия И.О. Название // Сборник трудов конф. — Место, Год. — С. N–N.
- Use em-dash (—) as separator between bibliographic fields
- Use Russian guillemets «» for titles when language is Russian
- City abbreviations: Москва → М., Санкт-Петербург → СПб., Ленинград → Л.
- If DOI is present, always include it as last field: DOI: 10.xxxx/xxxx

Return ONLY valid JSON — no markdown fences:
{
  "detectedStyle": "APA"|"Chicago"|"MLA"|"IEEE"|"Vancouver"|"Harvard"|"GOST"|"Unknown",
  "confidence": 0.0-1.0,
  "summary": "one-sentence description of what was done",
  "convertedText": "full converted document or null",
  "items": [
    {
      "id": "c-0",
      "type": "inline-apa",
      "start": 120,
      "end": 133,
      "text": "[1]"
    }
  ],
  "bibEntries": [
    {
      "raw": "original entry",
      "style": "string",
      "converted": "reformatted entry",
      "fields": {
        "author": "", "year": "", "title": "", "source": "",
        "publisher": "", "place": "", "pages": "",
        "doi": "", "url": "", "volume": "", "issue": "", "type": ""
      },
      "startLine": 1
    }
  ]
}`;

// ── POST /api/ai-analyze ───────────────────────────────────────────────────
export async function handleAiAnalyze(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: "GEMINI_API_KEY не задан. Установите переменную окружения для AI-анализа.",
    });
    return;
  }

  const isEvidencePack = (
    typeof req.body?.heuristicSummary === "object" ||
    Array.isArray(req.body?.evidence)
  );

  let userMsg: string;
  let language: string;

  if (isEvidencePack) {
    language = req.body?.heuristicSummary?.language ?? "ru";
    userMsg  = [
      `Language hint: ${language}`,
      buildEvidencePackMsg(req.body as Record<string, unknown>),
    ].join("\n\n");
  } else {
    const rawText = typeof req.body?.text === "string" ? req.body.text : "";
    if (!rawText.trim()) {
      res.status(400).json({ error: "Текст не передан." });
      return;
    }
    language = typeof req.body?.language === "string" ? req.body.language : detectLang(rawText);
    const text = truncate(rawText);
    userMsg = [`Language hint: ${language}`, "---BEGIN---", text, "---END---"].join("\n");
  }

  try {
    const { raw, model, label } = await runGemini(ANALYZE_PROMPT, userMsg, apiKey);
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
      structure:     Array.isArray(parsed.structure)  ? parsed.structure  : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      language:      (parsed.language as string) ?? language,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: null,
      _model:        model,
      _label:        label,
    });
  } catch (err) {
    const msg = friendlyError(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: msg });
  }
}

// ── POST /api/ai-convert ───────────────────────────────────────────────────
export async function handleAiConvert(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "GEMINI_API_KEY не задан." });
    return;
  }

  const targetStyle: string =
    typeof req.body?.targetStyle === "string" ? req.body.targetStyle : "";
  const scope: string[] = Array.isArray(req.body?.scope)
    ? req.body.scope
    : ["citations", "bibliography"];

  if (!targetStyle.trim()) {
    res.status(400).json({ error: "Целевой стиль не указан." });
    return;
  }

  const isEvidencePack = (
    typeof req.body?.heuristicSummary === "object" ||
    Array.isArray(req.body?.evidence)
  );

  let userMsg: string;
  let language: string;

  if (isEvidencePack) {
    language = req.body?.heuristicSummary?.language ?? "ru";
    const packMsg = buildEvidencePackMsg(req.body as Record<string, unknown>);
    const langInstruction = language === "ru"
      ? "The document is in Russian. Apply Russian academic conventions."
      : language === "mixed"
      ? "The document mixes Russian and English. Handle both scripts correctly."
      : "The document is in English.";
    userMsg = [
      `Language hint: ${language}`,
      langInstruction,
      `Target style: ${targetStyle}`,
      `Scope: ${scope.join(", ")}`,
      packMsg,
    ].join("\n\n");
  } else {
    const rawText = typeof req.body?.text === "string" ? req.body.text : "";
    if (!rawText.trim()) {
      res.status(400).json({ error: "Текст не передан." });
      return;
    }
    language = typeof req.body?.language === "string" ? req.body.language : detectLang(rawText);
    const text = truncate(rawText);
    const langInstruction = language === "ru"
      ? "The document is in Russian. Apply Russian academic conventions: " +
        "guillemets «» for quotations, em-dash (—) as bibliographic separator, Cyrillic initials format."
      : language === "mixed"
      ? "The document mixes Russian and English. Handle both scripts correctly."
      : "The document is in English.";
    userMsg = [
      `Language hint: ${language}`,
      langInstruction,
      `Target style: ${targetStyle}`,
      `Scope: ${scope.join(", ")}`,
      "---BEGIN---",
      text,
      "---END---",
    ].join("\n");
  }

  try {
    const { raw, model, label } = await runGemini(CONVERT_PROMPT, userMsg, apiKey);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Gemini вернул ответ в неожиданном формате.");
    }
    res.json({
      items:         Array.isArray(parsed.items)      ? parsed.items      : [],
      bibEntries:    Array.isArray(parsed.bibEntries) ? parsed.bibEntries : [],
      detectedStyle: parsed.detectedStyle ?? "Unknown",
      confidence:    typeof parsed.confidence === "number" ? parsed.confidence : 0,
      summary:       typeof parsed.summary === "string" ? parsed.summary : "",
      convertedText: typeof parsed.convertedText === "string" ? parsed.convertedText : null,
      _model:        model,
      _label:        label,
    });
  } catch (err) {
    const msg = friendlyError(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: msg });
  }
}

// ── Model info endpoint helper (for debugging / health checks) ─────────────
export function getModelInfo(): { models: { id: string; label: string }[] } {
  return {
    models: MODEL_REGISTRY.map((m) => ({ id: m.id, label: m.label })),
  };
}

import { MODEL_REGISTRY } from "./geminiRouter.js";
