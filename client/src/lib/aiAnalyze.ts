/**
 * Client-side hooks for AI analysis and AI conversion.
 *
 * useAiAnalyze  → POST /api/ai-analyze  (structure + citation markup)
 * useAiConvert  → POST /api/ai-convert  (targeted style conversion)
 *
 * buildHeuristicPayload() prepares heuristic fragments for AI analysis,
 * so the server receives compact snippets instead of the full document.
 */

import { useState } from "react";
import { apiRequest } from "./queryClient";
import type { CitationStyle, FoundItem as HeuristicFoundItem, CitationFragment } from "./analyze";
import { buildContextFragments } from "./analyze";

export type { CitationFragment };

export interface AiAnalyzeRequest {
  text: string;
  language?: string;
  /** Pre-extracted citation fragments from heuristic engine. When provided,
   *  the server builds a compact prompt from snippets instead of full text. */
  fragments?: CitationFragment[];
}

export interface AiConvertRequest {
  text: string;
  targetStyle: CitationStyle;
  language?: string;
  scopes: ConvertScope[];
}

export type ConvertScope = "citations" | "bibliography" | "structure" | "typos" | "syntax";

export const CONVERT_SCOPE_LABELS: Record<ConvertScope, string> = {
  citations:    "Цитаты",
  bibliography: "Библиография",
  structure:    "Структура",
  typos:        "Опечатки",
  syntax:       "Синтаксис",
};

export interface FoundItem {
  id: string;
  type: "inline-apa" | "inline-numeric" | "footnote" | "bibliography" | "ibid" | "quote";
  text: string;
  line: number;
  start: number;
  end: number;
  confidence?: number;
  note?: string;
}

export interface BibEntry {
  raw: string;
  style?: string;
  converted?: string;
  fields: Record<string, string>;
  startLine?: number;
  issues?: string[];
}

export interface StructureBlock {
  type: "heading" | "abstract" | "body" | "conclusion" | "bibliography" | "footnotes";
  startLine: number;
  endLine: number;
  title?: string;
}

export interface AiAnalyzeResponse {
  items: FoundItem[];
  bibEntries: BibEntry[];
  structureBlocks?: StructureBlock[];
  detectedStyle: string;
  confidence: number;
  language: string;
  summary: string;
  structureSummary?: string;
  convertedText: string | null;
  _model?: string;
  error?: string;
}

export interface AiConvertResponse {
  bibEntries: BibEntry[];
  detectedStyle: string;
  confidence: number;
  language: string;
  summary: string;
  convertedText: string | null;
  _model?: string;
  error?: string;
}

/**
 * Build a heuristic payload for AI analysis.
 * Extracts citation context fragments from already-found heuristic items.
 * Returns null if no inline citations found (fallback to full-text mode).
 */
export function buildHeuristicPayload(
  text: string,
  heuristicFound: HeuristicFoundItem[],
): CitationFragment[] | null {
  const fragments = buildContextFragments(text, heuristicFound, 60);
  return fragments.length > 0 ? fragments : null;
}

// ── useAiAnalyze ──────────────────────────────────────────────────────────────
export function useAiAnalyze() {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<AiAnalyzeResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function analyze(req: AiAnalyzeRequest): Promise<AiAnalyzeResponse | null> {
    setLoading(true); setError(null);
    try {
      const res  = await apiRequest("POST", "/api/ai-analyze", req);
      const json = await res.json() as AiAnalyzeResponse;
      if (!res.ok || json.error) {
        const msg = json.error ?? `HTTP ${res.status}`;
        setError(msg); setData(null); return { ...json, error: msg };
      }
      setData(json); return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, error };
}

// ── useAiConvert ──────────────────────────────────────────────────────────────
export function useAiConvert() {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<AiConvertResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function convert(req: AiConvertRequest): Promise<AiConvertResponse | null> {
    setLoading(true); setError(null);
    try {
      const res  = await apiRequest("POST", "/api/ai-convert", req);
      const json = await res.json() as AiConvertResponse;
      if (!res.ok || json.error) {
        const msg = json.error ?? `HTTP ${res.status}`;
        setError(msg); setData(null); return { ...json, error: msg } as AiConvertResponse;
      }
      setData(json); return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { convert, loading, data, error };
}

// ── mergeFoundItems ───────────────────────────────────────────────────────────
export function mergeFoundItems(
  heuristic: FoundItem[],
  ai: FoundItem[]
): FoundItem[] {
  const merged = [...heuristic];
  for (const aiItem of ai) {
    const overlap = heuristic.some(
      (h) => h.start < aiItem.end && h.end > aiItem.start
    );
    if (!overlap) merged.push(aiItem);
  }
  return merged.sort((a, b) => a.start - b.start);
}
