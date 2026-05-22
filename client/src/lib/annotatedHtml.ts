/**
 * annotatedHtml.ts
 * Builds a safe HTML string from plain text + FoundItem[] + EditorIssue[].
 * Spans are injected in document order; overlapping regions use the
 * highest-confidence item to avoid nesting conflicts.
 *
 * Output is consumed by RichEditor via dangerouslySetInnerHTML.
 * NEVER used for server-rendered content — client-only.
 */

import type { FoundItem, EditorIssue } from "./analyze";

export interface AnnotationSpan {
  start: number;
  end: number;
  cssClass: string;
  itemId: string;
  kind: "citation" | "issue";
}

/** Escape HTML entities in plain text segments. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function citationClass(type: FoundItem["type"]): string {
  switch (type) {
    case "inline-apa":     return "ann-apa";
    case "inline-numeric": return "ann-numeric";
    case "footnote":       return "ann-footnote";
    case "bibliography":   return "ann-bib";
    case "ibid":           return "ann-ibid";
    case "quote":          return "ann-quote";
    default:               return "ann-apa";
  }
}

/**
 * Merge found items and editor issues into a flat, non-overlapping list of
 * annotation spans, sorted by start position.
 * When two spans overlap the one with higher confidence wins.
 */
export function buildSpans(
  found: FoundItem[],
  issues: EditorIssue[],
  showIssues: boolean,
): AnnotationSpan[] {
  const raw: AnnotationSpan[] = [
    ...found.map((f) => ({
      start: f.start,
      end: f.end,
      cssClass: citationClass(f.type),
      itemId: f.id,
      kind: "citation" as const,
    })),
    ...(showIssues
      ? issues.map((iss) => ({
          start: iss.start,
          end: iss.end,
          cssClass: "ann-issue",
          itemId: iss.id,
          kind: "issue" as const,
        }))
      : []),
  ].sort((a, b) => a.start - b.start || b.end - a.end);

  // Greedy non-overlap: skip any span that starts inside the current one
  const result: AnnotationSpan[] = [];
  let cursor = 0;
  for (const span of raw) {
    if (span.start < cursor) continue; // overlaps previous → skip
    result.push(span);
    cursor = span.end;
  }
  return result;
}

/**
 * Build an HTML string with annotation <span> elements injected.
 * Plain-text segments between spans are HTML-escaped.
 * Newlines are preserved as-is (the container uses white-space: pre-wrap).
 *
 * @param text        Raw document text
 * @param spans       Non-overlapping sorted annotation spans (from buildSpans)
 * @param selectedId  item id currently selected in the right panel
 * @param hoveredId   item id currently hovered in the right panel
 */
export function buildAnnotatedHtml(
  text: string,
  spans: AnnotationSpan[],
  selectedId: string | null,
  hoveredId: string | null,
): string {
  let html = "";
  let pos = 0;

  for (const span of spans) {
    // Plain text before this span
    if (span.start > pos) {
      html += escHtml(text.slice(pos, span.start));
    }

    const extra =
      span.itemId === selectedId
        ? " ann-selected"
        : span.itemId === hoveredId
        ? " ann-focused"
        : "";

    const spanText = escHtml(text.slice(span.start, span.end));
    html += `<span class="${span.cssClass}${extra}" data-ann-id="${span.itemId}">${spanText}</span>`;
    pos = span.end;
  }

  // Remaining plain text
  if (pos < text.length) {
    html += escHtml(text.slice(pos));
  }

  return html;
}
