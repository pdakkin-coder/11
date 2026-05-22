/**
 * RichEditor.tsx
 * Dual-mode document display:
 *   - view mode  : dangerouslySetInnerHTML with annotation spans (ann-* classes)
 *   - edit mode  : plain contenteditable so the user types raw text
 *
 * Props:
 *   text          – raw document text (source of truth)
 *   spans         – pre-computed AnnotationSpan[] from buildSpans()
 *   selectedId    – annotation id selected in the right panel
 *   hoveredId     – annotation id hovered in the right panel
 *   editMode      – when true, switch to contenteditable plain-text
 *   onTextChange  – called with new plain text on input (edit mode)
 *   onAnnClick    – called with annotation item id when a span is clicked
 *   onAnnHover    – called with item id | null on mouseenter/leave
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { buildAnnotatedHtml, type AnnotationSpan } from "@/lib/annotatedHtml";

interface RichEditorProps {
  text: string;
  spans: AnnotationSpan[];
  selectedId: string | null;
  hoveredId: string | null;
  editMode: boolean;
  showDiff?: boolean;
  diffText?: string;
  onTextChange: (t: string) => void;
  onAnnClick: (id: string, start: number, end: number) => void;
  onAnnHover: (id: string | null) => void;
}

export function RichEditor({
  text,
  spans,
  selectedId,
  hoveredId,
  editMode,
  showDiff,
  diffText,
  onTextChange,
  onAnnClick,
  onAnnHover,
}: RichEditorProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // Build annotated HTML in view mode
  const annotatedHtml = useMemo(
    () =>
      buildAnnotatedHtml(
        showDiff && diffText ? diffText : text,
        spans,
        selectedId,
        hoveredId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, diffText, showDiff, spans, selectedId, hoveredId],
  );

  // Scroll selected annotation into view
  useEffect(() => {
    if (!selectedId || editMode) return;
    const el = viewRef.current?.querySelector(
      `[data-ann-id="${selectedId}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedId, editMode]);

  // Sync edit-mode contenteditable text → state
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      onTextChange((e.currentTarget as HTMLDivElement).innerText);
    },
    [onTextChange],
  );

  // When switching TO edit mode, seed the contenteditable with plain text
  useEffect(() => {
    if (editMode && editRef.current) {
      const current = editRef.current.innerText;
      if (current !== text) {
        editRef.current.innerText = text;
      }
    }
  }, [editMode, text]);

  // Annotation click handler (view mode)
  const handleViewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-ann-id]");
      if (!target) return;
      const id = target.getAttribute("data-ann-id");
      if (!id) return;
      // find the span to get start/end
      e.stopPropagation();
      onAnnClick(id, 0, 0); // positions resolved in parent via found[]
    },
    [onAnnClick],
  );

  // Annotation hover handler (view mode)
  const handleMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-ann-id]");
      onAnnHover(target ? (target.getAttribute("data-ann-id") ?? null) : null);
    },
    [onAnnHover],
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-ann-id]");
      if (!target) onAnnHover(null);
    },
    [onAnnHover],
  );

  if (editMode) {
    return (
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="rich-editor p-6 min-h-full outline-none whitespace-pre-wrap cursor-text"
        data-placeholder="Введите или вставьте текст документа…"
        data-testid="document-area-edit"
        spellCheck={false}
      />
    );
  }

  return (
    <div
      ref={viewRef}
      className="rich-editor p-6 min-h-full outline-none whitespace-pre-wrap select-text"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: annotatedHtml }}
      onClick={handleViewClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      data-testid="document-area"
    />
  );
}
