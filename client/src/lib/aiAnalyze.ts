/**
 * useAiAnalyze — React hook for POST /api/ai-analyze
 *
 * Sends document text to the AI endpoint and returns enriched citation data.
 * If the endpoint is unavailable (501/502) the caller should fall back to
 * the heuristic-only path.
 */

import { useState, useCallback, useRef } from "react";
import type { FoundItem, CitationStyle } from "./analyze";

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
  error?: string;
}

export interface AiAnalyzeState {
  data:    AiAnalyzeResponse | null;
  loading: boolean;
  error:   string | null;
}

export function useAiAnalyze() {
  const [state, setState] = useState<AiAnalyzeState>({ data: null, loading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (req: AiAnalyzeRequest) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ data: null, loading: true, error: null });

    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data: AiAnalyzeResponse = await res.json();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      const msg = err instanceof Error ? err.message : String(err);
      setState({ data: null, loading: false, error: msg });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
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
