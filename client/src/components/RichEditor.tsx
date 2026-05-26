import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, RemoveFormatting, Heading1, Heading2, Heading3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface RichEditorHandle {
  getHtml: () => string;
  getText: () => string;
  setHtml: (html: string) => void;
}

interface Props {
  /** Initial HTML content of the editor */
  html?: string;
  /** Plain-text fallback when no html provided */
  draft?: string;
  onChange?: (html: string) => void;
  className?: string;
}

const TOOLBAR_GROUPS: Array<Array<{
  icon: React.ElementType;
  label: string;
  cmd?: string;
  arg?: string;
  custom?: (root: HTMLElement) => void;
}>> = [
  [
    { icon: Undo2,            label: "Отменить",      cmd: "undo" },
    { icon: Redo2,            label: "Повторить",     cmd: "redo" },
  ],
  [
    { icon: Bold,             label: "Жирный",        cmd: "bold" },
    { icon: Italic,           label: "Курсив",        cmd: "italic" },
    { icon: UnderlineIcon,    label: "Подчёркнутый",  cmd: "underline" },
    { icon: Strikethrough,    label: "Зачёркнутый",   cmd: "strikeThrough" },
  ],
  [
    {
      icon: Heading1, label: "Заголовок 1",
      custom: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const parent = sel.getRangeAt(0).startContainer.parentElement;
        const tag = parent?.tagName?.toLowerCase();
        document.execCommand("formatBlock", false, tag === "h1" ? "p" : "h1");
      },
    },
    {
      icon: Heading2, label: "Заголовок 2",
      custom: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const parent = sel.getRangeAt(0).startContainer.parentElement;
        const tag = parent?.tagName?.toLowerCase();
        document.execCommand("formatBlock", false, tag === "h2" ? "p" : "h2");
      },
    },
    {
      icon: Heading3, label: "Заголовок 3",
      custom: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const parent = sel.getRangeAt(0).startContainer.parentElement;
        const tag = parent?.tagName?.toLowerCase();
        document.execCommand("formatBlock", false, tag === "h3" ? "p" : "h3");
      },
    },
  ],
  [
    { icon: List,        label: "Маркированный список", cmd: "insertUnorderedList" },
    { icon: ListOrdered, label: "Нумерованный список",  cmd: "insertOrderedList" },
  ],
  [
    { icon: AlignLeft,   label: "По левому краю",  cmd: "justifyLeft" },
    { icon: AlignCenter, label: "По центру",        cmd: "justifyCenter" },
    { icon: AlignRight,  label: "По правому краю", cmd: "justifyRight" },
  ],
  [
    { icon: RemoveFormatting, label: "Убрать форматирование", cmd: "removeFormat" },
  ],
];

const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor(
  { html, draft, onChange, className },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    getHtml: () => editorRef.current?.innerHTML ?? "",
    getText: () => editorRef.current?.innerText ?? "",
    setHtml: (h: string) => {
      if (editorRef.current) editorRef.current.innerHTML = h;
    },
  }));

  // Seed initial content once
  useEffect(() => {
    if (!editorRef.current) return;
    if (html) {
      editorRef.current.innerHTML = html;
    } else if (draft) {
      // Plain text → wrap paragraphs in <p>
      editorRef.current.innerHTML = draft
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    onChange?.(editorRef.current?.innerHTML ?? "");
  }, [onChange]);

  const exec = useCallback((cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
  }, [handleInput]);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      {/* Toolbar */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b bg-background/95 backdrop-blur shrink-0"
        data-testid="rich-editor-toolbar"
        onMouseDown={(e) => e.preventDefault()} // prevent blur
      >
        {TOOLBAR_GROUPS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <Separator orientation="vertical" className="h-5 mx-1" />}
            {group.map((btn) => {
              const Icon = btn.icon;
              return (
                <Button
                  key={btn.label}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title={btn.label}
                  aria-label={btn.label}
                  onClick={() => {
                    if (btn.custom) btn.custom(editorRef.current!);
                    else if (btn.cmd) exec(btn.cmd, btn.arg);
                    handleInput();
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-testid="rich-editor-content"
        onInput={handleInput}
        className={cn(
          // Base
          "flex-1 min-h-[400px] outline-none px-8 py-6 text-[15px] leading-relaxed",
          // Headings
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:leading-tight",
          "[&_h2]:text-xl  [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
          "[&_h3]:text-lg  [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5",
          // Paragraphs
          "[&_p]:mb-3 [&_p:last-child]:mb-0",
          // Lists
          "[&_ul]:list-disc   [&_ul]:pl-6 [&_ul]:mb-3",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3",
          "[&_li]:mb-1",
          // Blockquote
          "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4",
          // Table
          "[&_table]:w-full [&_table]:border-collapse [&_table]:mb-4",
          "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm",
          "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-sm [&_th]:font-semibold [&_th]:bg-muted/40",
          // Inline
          "[&_strong]:font-semibold [&_em]:italic",
        )}
      />
    </div>
  );
});

export default RichEditor;
