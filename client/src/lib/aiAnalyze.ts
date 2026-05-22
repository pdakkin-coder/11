/**
 * useAiAnalyze / useAiConvert — React hooks for AI-assisted citation analysis.
 *
 * Evidence-Pack Pipeline:
 *   analyze.ts → buildEvidencePack() → sendEvidencePack() → POST /api/ai-analyze
 *
 * AI receives a compact JSON packet instead of the full document text.
 * Token cost is reduced 5-10x for an average document (30 KB → 3-5 KB JSON).
 *
 * Key features:
 *  - useAiAnalyze: analyzes document, returns FoundItems + style detection
 *  - useAiConvert:  converts citations to a target style (scope=["convert"])
 *  - CLIENT_RETRY:  automatic retry on transient 429/503 errors (2 attempts)
 *  - activeModel:   exposes which Gemini model responded (for UI badge)
 *  - mergeFoundItems: near-overlap merge (heuristic ±5 chars vs. AI exact)
 */

import { useState, useCallback, useRef } from "react";
import type {
  FoundItem,
  CitationStyle,
  EvidenceSnippet,
  StructureCandidate,
  EvidenceSource,
} from "./analyze";

/** Client-side timeout per single attempt (ms) */
const CLIENT_TIMEOUT_MS = 100_000;
/** Max automatic retries on transient errors (429, 503) */
const CLIENT_MAX_RETRIES = 2;
/** Base delay between retries (ms) — doubles each attempt */
const CLIENT_RETRY_BASE_MS = 3_000;
/** Near-overlap tolerance in characters for mergeFoundItems */
const NEAR_OVERLAP_TOL = 5;

// ── Request / Response types ────────────────────────────────────────────────────────

export interface AiAnalyzeRequest {
  heuristicSummary: {
    style: CitationStyle;
    confidence: number;
    citationCount: number;
    bibCount: number;
    language: "ru" | "en" | "mixed";
  };
  evidence: EvidenceSnippet[];
  bibliographyCandidates: FoundItem[];
  structureCandidates: StructureCandidate[];
  /** Optional: user-selected fragment for focused analysis/conversion */
  selectedFragment?: {
    text: string;
    charStart: number;
    charEnd: number;
  };
  scope: ("analyze" | "convert" | "validate")[];
  targetStyle?: CitationStyle;
}

export interface AiConvertRequest extends AiAnalyzeRequest {
  scope: ("analyze" | "convert" | "validate")[];
}

export interface AiBibEntry {
  raw: string;
  style: string;
  converted?: string | null;
  fields: {
    author?: string;
    year?: string;
    title?: string;
    source?: string;
    publisher?: string;
    place?: string;
    pages?: string;
    doi?: string;
    url?: string;
    volume?: string;
    issue?: string;
    type?: string;
    [key: string]: string | undefined;
  };
  startLine: number;
}

export interface AiAnalyzeResponse {
  items: FoundItem[];
  bibEntries: AiBibEntry[];
  detectedStyle: CitationStyle;
  confidence: number;
  language: "ru" | "en" | "mixed";
  summary: string;
  /** Full document text with citations converted to the requested targetStyle, or null */
  convertedText: string | null;
  /** Gemini model ID that produced the response (e.g. 'gemini-2.5-flash') */
  _model?: string;
  /** Human-readable model label (e.g. 'Gemini 2.5 Flash') */
  _label?: string;
  error?: string;
}

export interface AiAnalyzeState {
  data:        AiAnalyzeResponse | null;
  loading:     boolean;
  error:       string | null;
  /** Gemini model label shown in the UI (e.g. 'Gemini 2.5 Flash ✓') */
  activeModel: string | null;
  /** Number of retry attempts performed for the last request */
  retryCount:  number;
}

// ── Error humaniser ──────────────────────────────────────────────────────────────────

/** Translate raw server/browser error strings into user-friendly Russian messages. */
function humaniseError(raw: string, retries = 0): string {
  if (
    raw.includes("fetch failed") ||
    raw.includes("Failed to fetch") ||
    raw.includes("NetworkError")
  ) return "Не удалось подключиться к серверу. Убедитесь, что приложение запущено (npm run dev).";

  if (raw.includes("ENOTFOUND") || raw.includes("ECONNREFUSED"))
    return "Нет соединения с сервером. Проверьте, что сервер запущен на порту 5000.";

  if (raw.includes("Квота исчерпана") || raw.includes("полночь") || raw.includes("aistudio.google.com"))
    return raw;

  if (raw.includes("429")) {
    const retryMsg = retries > 0 ? ` (повторных попыток: ${retries})` : "";
    return `Достигнут лимит запросов к Gemini. Подождите минуту и повторите${retryMsg}.`;
  }

  if (raw.includes("503") || raw.includes("Service Unavailable"))
    return "Сервер Gemini временно недоступен. Запрос будет автоматически повторён.";

  if (raw.includes("501"))
    return "AI-модуль недоступен: GEMINI_API_KEY не настроен. Анализ выполняется эвристически.";

  if (raw.includes("AbortError") || raw.includes("отменён"))
    return "AI-анализ отменён (превышено время ожидания 100 с).";

  if (raw.includes("400") || raw.includes("Bad Request"))
    return "Некорректный запрос: проверьте данные документа.";

  return raw;
}

/** Returns true if the error string signals a transient condition worth retrying. */
function isTransient(raw: string, status?: number): boolean {
  if (status === 429 || status === 503) return true;
  if (raw.includes("429") || raw.includes("503")) return true;
  if (raw.includes("Service Unavailable")) return true;
  return false;
}

// ── Core fetch with retry ───────────────────────────────────────────────────────────

interface FetchWithRetryResult {
  data: AiAnalyzeResponse;
  retryCount: number;
}

async function fetchWithRetry(
  url: string,
  body: AiAnalyzeRequest,
  signal: AbortSignal,
  onRetry?: (attempt: number, delayMs: number) => void,
): Promise<FetchWithRetryResult> {
  let lastError = "";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= CLIENT_MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

    if (attempt > 0) {
      const delayMs = CLIENT_RETRY_BASE_MS * attempt;
      onRetry?.(attempt, delayMs);
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
      });
    }

    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal,
      });

      const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
      const payload = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        lastStatus = res.status;
        lastError =
          typeof payload === "string"
            ? payload || `HTTP ${res.status}`
            : (payload as { error?: string })?.error || `HTTP ${res.status}`;

        if (isTransient(lastError, res.status) && attempt < CLIENT_MAX_RETRIES) continue;

        // Non-transient or exhausted retries — return error response
        const msg = humaniseError(lastError, attempt);
        return {
          data: {
            items: [], bibEntries: [], detectedStyle: "Unknown",
            confidence: 0, language: body.heuristicSummary.language,
            summary: "", convertedText: null, error: msg,
          },
          retryCount: attempt,
        };
      }

      return { data: payload as AiAnalyzeResponse, retryCount: attempt };

    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransient(lastError) || attempt >= CLIENT_MAX_RETRIES) throw err;
      // transient network error — retry
    }
  }

  // Exhausted all retries
  const msg = humaniseError(lastError, CLIENT_MAX_RETRIES);
  return {
    data: {
      items: [], bibEntries: [], detectedStyle: "Unknown",
      confidence: 0, language: body.heuristicSummary.language,
      summary: "", convertedText: null, error: msg,
    },
    retryCount: CLIENT_MAX_RETRIES,
  };
}

// ── useAiAnalyze ───────────────────────────────────────────────────────────────────────

export function useAiAnalyze() {
  const [state, setState] = useState<AiAnalyzeState>({
    data: null, loading: false, error: null, activeModel: null, retryCount: 0,
  });
  const abortRef   = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analyze = useCallback(async (req: AiAnalyzeRequest) => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const ctrl = new AbortController();
    abortRef.current   = ctrl;
    timeoutRef.current = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);

    setState({ data: null, loading: true, error: null, activeModel: null, retryCount: 0 });

    try {
      const { data, retryCount } = await fetchWithRetry(
        "/api/ai-analyze",
        req,
        ctrl.signal,
        (attempt, delay) => {
          // Surface retry status to the state so UI can show a spinner message
          setState((prev) => ({
            ...prev,
            error: `Повторная попытка ${attempt}/${CLIENT_MAX_RETRIES} через ${delay / 1000} с…`,
            retryCount: attempt,
          }));
        },
      );

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const activeModel = data._label ?? data._model ?? null;
      const errorMsg = data.error ?? null;

      setState({ data, loading: false, error: errorMsg, activeModel, retryCount });
      return data;

    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const raw = err instanceof Error ? err.message : String(err);
      const msg = (err as Error).name === "AbortError"
        ? "AI-анализ отменён (превышено время ожидания 100 с)."
        : humaniseError(raw);

      const errorResponse: AiAnalyzeResponse = {
        items: [], bibEntries: [], detectedStyle: "Unknown",
        confidence: 0, language: req.heuristicSummary.language,
        summary: "", convertedText: null, error: msg,
      };
      setState({ data: errorResponse, loading: false, error: msg, activeModel: null, retryCount: 0 });
      return errorResponse;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ data: null, loading: false, error: null, activeModel: null, retryCount: 0 });
  }, []);

  return { ...state, analyze, reset };
}

// ── useAiConvert ───────────────────────────────────────────────────────────────────────

/**
 * Dedicated hook for citation conversion (POST /api/ai-convert).
 * Mirrors useAiAnalyze but always sets scope=["convert"] and requires
 * a targetStyle. Uses the same retry logic.
 */
export function useAiConvert() {
  const [state, setState] = useState<AiAnalyzeState>({
    data: null, loading: false, error: null, activeModel: null, retryCount: 0,
  });
  const abortRef   = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const convert = useCallback(async (
    req: Omit<AiAnalyzeRequest, "scope">,
    targetStyle: CitationStyle,
  ) => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const ctrl = new AbortController();
    abortRef.current   = ctrl;
    timeoutRef.current = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);

    const fullReq: AiAnalyzeRequest = { ...req, scope: ["convert"], targetStyle };

    setState({ data: null, loading: true, error: null, activeModel: null, retryCount: 0 });

    try {
      const { data, retryCount } = await fetchWithRetry(
        "/api/ai-convert",
        fullReq,
        ctrl.signal,
        (attempt, delay) => {
          setState((prev) => ({
            ...prev,
            error: `Повторная попытка ${attempt}/${CLIENT_MAX_RETRIES} через ${delay / 1000} с…`,
            retryCount: attempt,
          }));
        },
      );

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const activeModel = data._label ?? data._model ?? null;
      const errorMsg = data.error ?? null;

      setState({ data, loading: false, error: errorMsg, activeModel, retryCount });
      return data;

    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const raw = err instanceof Error ? err.message : String(err);
      const msg = (err as Error).name === "AbortError"
        ? "AI-конвертация отменена (превышено время ожидания 100 с)."
        : humaniseError(raw);

      const errorResponse: AiAnalyzeResponse = {
        items: [], bibEntries: [], detectedStyle: "Unknown",
        confidence: 0, language: req.heuristicSummary.language,
        summary: "", convertedText: null, error: msg,
      };
      setState({ data: errorResponse, loading: false, error: msg, activeModel: null, retryCount: 0 });
      return errorResponse;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ data: null, loading: false, error: null, activeModel: null, retryCount: 0 });
  }, []);

  return { ...state, convert, reset };
}

// ── mergeFoundItems ────────────────────────────────────────────────────────────────────

/**
 * Merge heuristic FoundItems with AI FoundItems.
 *
 * Strategy:
 *  1. Heuristic items are the base layer (source: "heuristic").
 *  2. AI items at the EXACT same [start, end] override type/confidence (source: "merged").
 *  3. AI items that are NEAR-OVERLAP (±NEAR_OVERLAP_TOL chars) are also merged
 *     into the heuristic item closest to them — AI type/confidence win if higher.
 *     This handles DOCX import off-by-N-char offsets.
 *  4. AI-only items with no near match are appended (source: "ai").
 *
 * Result is sorted by start offset.
 */
export function mergeFoundItems(
  heuristic: FoundItem[],
  ai: FoundItem[],
): FoundItem[] {
  // Build mutable map keyed by "start:end"
  const merged = new Map<string, FoundItem>();

  for (const h of heuristic) {
    merged.set(`${h.start}:${h.end}`, { ...h, source: "heuristic" as EvidenceSource });
  }

  const heuristicArr = [...merged.values()];

  for (const a of ai) {
    const exactKey = `${a.start}:${a.end}`;

    // 1. Exact match
    if (merged.has(exactKey)) {
      const existing = merged.get(exactKey)!;
      merged.set(exactKey, {
        ...existing,
        type: (a.confidence ?? 0) > (existing.confidence ?? 0) ? a.type : existing.type,
        confidence: Math.max(a.confidence ?? 0, existing.confidence ?? 0),
        source: "merged" as EvidenceSource,
      });
      continue;
    }

    // 2. Near-overlap: find closest heuristic item within tolerance
    const near = heuristicArr.find(
      (h) =>
        Math.abs(h.start - a.start) <= NEAR_OVERLAP_TOL &&
        Math.abs(h.end - a.end) <= NEAR_OVERLAP_TOL,
    );
    if (near) {
      const nearKey = `${near.start}:${near.end}`;
      const existing = merged.get(nearKey)!;
      merged.set(nearKey, {
        ...existing,
        type: (a.confidence ?? 0) > (existing.confidence ?? 0) ? a.type : existing.type,
        confidence: Math.max(a.confidence ?? 0, existing.confidence ?? 0),
        note: existing.note ?? a.note,
        source: "merged" as EvidenceSource,
      });
      continue;
    }

    // 3. AI-only — append
    merged.set(exactKey, { ...a, source: "ai" as EvidenceSource });
  }

  return [...merged.values()].sort((a, b) => a.start - b.start);
}
