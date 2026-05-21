/**
 * useAiAnalyze — React hook for POST /api/ai-analyze
 *
 * Sends document text to the AI endpoint and returns enriched citation data.
 * If the endpoint is unavailable (501/502) the caller should fall back to
 * the heuristic-only path.
 */

import { useState, useCallback, useRef } from "react";
import type { FoundItem, CitationStyle } from "./analyze";

const CLIENT_TIMEOUT_MS = 95_000;

export interface AiAnalyzeRequest {
  text: string;
  targetStyle?: CitationStyle;
  language?: "ru" | "en" | "mixed";
}

export interface AiBibEntry {
  raw: string;
  style: string;
  converted?: string;
  fields: Record<string, string>;
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
  /** Which Gemini model was actually used (informational) */
  _model?: string;
  error?: string;
}

export interface AiAnalyzeState {
  data:    AiAnalyzeResponse | null;
  loading: boolean;
  error:   string | null;
}

/** Humanise raw error strings coming from the server or browser */
function humaniseError(raw: string): string {
  if (raw.includes("fetch failed") || raw.includes("Failed to fetch") || raw.includes("NetworkError"))
    return "Не удалось подключиться к серверу. Убедитесь, что приложение запущено (npm run dev).";
  if (raw.includes("ENOTFOUND") || raw.includes("ECONNREFUSED"))
    return "Нет соединения с сервером. Проверьте, что сервер запущен на порту 5000.";
  if (raw.includes("Квота исчерпана") || raw.includes("429"))
    return raw; // already friendly from server
  if (raw.includes("AbortError") || raw.includes("отменён"))
    return "AI-анализ отменён (превышено время ожидания 95 с).";
  return raw;
}

export function useAiAnalyze() {
  const [state, setState] = useState<AiAnalyzeState>({ data: null, loading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analyze = useCallback(async (req: AiAnalyzeRequest) => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    timeoutRef.current = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);

    setState({ data: null, loading: true, error: null });

    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const isJson = (res.headers.get("content-type") || "").includes("application/json");
      const payload = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const rawMsg = typeof payload === "string"
          ? payload || `HTTP ${res.status}`
          : (payload as { error?: string })?.error || `HTTP ${res.status}`;
        const msg = humaniseError(rawMsg);
        const errorResponse: AiAnalyzeResponse = {
          items: [], bibEntries: [], detectedStyle: "Unknown",
          confidence: 0, language: req.language ?? "mixed", summary: "",
          convertedText: null, error: msg,
        };
        setState({ data: errorResponse, loading: false, error: msg });
        return errorResponse;
      }

      const data = payload as AiAnalyzeResponse;
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const raw = err instanceof Error ? err.message : String(err);
      const msg = (err as Error).name === "AbortError"
        ? "AI-анализ отменён (превышено время ожидания 95 с)."
        : humaniseError(raw);

      const errorResponse: AiAnalyzeResponse = {
        items: [], bibEntries: [], detectedStyle: "Unknown",
        confidence: 0, language: req.language ?? "mixed", summary: "",
        convertedText: null, error: msg,
      };
      setState({ data: errorResponse, loading: false, error: msg });
      return errorResponse;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, analyze, reset };
}

/** Merge heuristic FoundItems with AI FoundItems (AI takes priority at same offset). */
export function mergeFoundItems(heuristic: FoundItem[], ai: FoundItem[]): FoundItem[] {
  const result = [...ai];
  for (const h of heuristic) {
    const dup = ai.some(a => Math.abs(a.start - h.start) < 10 && a.type === h.type);
    if (!dup) result.push(h);
  }
  return result.sort((a, b) => a.start - b.start);
}
