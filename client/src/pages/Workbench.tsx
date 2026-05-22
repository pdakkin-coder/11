import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
  Zap, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CodexLogo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { DEMO_DOCS, SAMPLE_DOC, SAMPLE_DOC_TITLE, type DemoId } from "@/lib/sampleDoc";
import {
  analyzeStructure, convertCitations, countChars, countWords,
  detectStyle, findCitations, findEditorIssues,
  DEFAULT_SOURCE_TYPES, SOURCE_TYPE_FIELD_LABELS, renderSourceTemplate,
  type CitationStyle, type CustomCitationRules, type FoundItem,
  type EditorIssue, type SourceTypeTemplate,
} from "@/lib/analyze";
import { importFile } from "@/lib/importDoc";
import { exportDocument, type ExportFormat } from "@/lib/exportDoc";
import { apiRequest } from "@/lib/queryClient";
import { useAiAnalyze, mergeFoundItems, type AiAnalyzeResponse } from "@/lib/aiAnalyze";

type Panel = "structure" | "citations" | "style" | "convert" | "editor" | "stats" | "demos";

const PANEL_LABELS: Record<Panel, { label: string; icon: typeof FileText }> = {
  structure: { label: "Структура",        icon: Layers },
  citations: { label: "Цитаты и сноски",  icon: BookOpen },
  style:     { label: "Стиль цитирования", icon: Wand2 },
  convert:   { label: "Конвертация",       icon: ArrowLeftRight },
  editor:    { label: "Редактура",          icon: PenSquare },
  stats:     { label: "Статистика",         icon: Hash },
  demos:     { label: "Демо-документы",     icon: FolderOpen },
};

const TYPE_LABELS: Record<FoundItem["type"], string> = {
  "inline-apa":     "APA-вставка",
  "inline-numeric": "Числовая сноска",
  footnote:         "Сноска",
  bibliography:     "Библиография",
  ibid:             "Ibid./Там же",
  quote:            "Цитата",
};

function annotationCSSClass(kind: "citation" | "issue", type: string): string {
  if (kind === "issue") return "ann-issue";
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

function legendDotClass(type: FoundItem["type"]): string {
  switch (type) {
    case "inline-apa":     return "legend-dot-apa";
    case "inline-numeric": return "legend-dot-numeric";
    case "footnote":       return "legend-dot-footnote";
    case "bibliography":   return "legend-dot-bib";
    case "ibid":           return "legend-dot-ibid";
    case "quote":          return "legend-dot-quote";
    default:               return "legend-dot-apa";
  }
}

const ISSUE_LABELS: Record<EditorIssue["type"], string> = {
  "длинное-предложение":      "Длинное предложение",
  "пассив":                   "Пассивная конструкция",
  "разговорный-маркер":       "Разговорный оборот",
  "слабая-формулировка":      "Слабая формулировка",
  "повтор":                   "Повтор",
  "неопределённый-указатель": "Неопределённый указатель",
  "пунктуация":               "Пунктуация",
  "канцелярит":               "Канцеляризм",
};

// ── Drag-to-resize hook ───────────────────────────────────────────────────────
function useDragResize(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
  direction: "right" | "left" = "right"
) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = direction === "right"
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, startW.current + delta)));
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [direction, minWidth, maxWidth]);

  return { width, onMouseDown };
}

// ── DemosPanel ────────────────────────────────────────────────────────────────
function DemosPanel({ onLoad }: { onLoad: (id: DemoId) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-[13px] font-semibold">Демо-документы</h3>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Готовые примеры для тестирования анализа и конвертации.
        </p>
      </div>
      <div className="space-y-1.5">
        {DEMO_DOCS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onLoad(d.id)}
            className="w-full text-left rounded-md border px-3 py-2 text-[12.5px] hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium text-[12px] truncate">{d.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Workbench() {
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [docName, setDocName]           = useState<string>(SAMPLE_DOC_TITLE + ".txt");
  const [text, setText]                 = useState<string>(SAMPLE_DOC);
  const [warnings, setWarnings]         = useState<string[]>([]);
  const [panel, setPanel]               = useState<Panel>("citations");
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState<string>("all");
  const [selected, setSelected]         = useState<{ start: number; end: number } | null>(null);
  const [preview, setPreview]           = useState<{ target: CitationStyle; text: string } | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("docx");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl]           = useState("");
  const [linkLoading, setLinkLoading]   = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [aiFound, setAiFound]           = useState<FoundItem[] | null>(null);
  const { analyze: runAiAnalysis, loading: aiLoading, data: aiData, error: aiError } = useAiAnalyze();
  const [aiSetupOpen, setAiSetupOpen]   = useState(false);
  const [aiTargetStyle, setAiTargetStyle] = useState<CitationStyle | null>(null);
  const [customRules, setCustomRules]   = useState<CustomCitationRules>({
    name: "Авторский стандарт",
    mode: "author-date",
    inlineTemplate: "({author}, {year})",
    bibliographyTemplate: "{author}. {title}. {source}, {year}.",
    footnoteTemplate: "{n}. {author}. {title}. {source}, {year}.",
    separator: "; ",
  });
  const [hoveredId, setHoveredId]       = useState<string | null>(null);
  const [editMode, setEditMode]         = useState(false);
  const [draft, setDraft]               = useState<string>(SAMPLE_DOC);

  const sidebar    = useDragResize(224, 160, 320, "right");
  const rightPanel = useDragResize(360, 260, 560, "left");

  const heuristicFound = useMemo(() => findCitations(text), [text]);
  const found = useMemo(
    () => aiFound ? mergeFoundItems(heuristicFound, aiFound) : heuristicFound,
    [heuristicFound, aiFound],
  );
  const detected  = useMemo(() => detectStyle(text, found), [text, found]);
  const structure = useMemo(() => analyzeStructure(text), [text]);
  const issues    = useMemo(() => findEditorIssues(text), [text]);
  const stats     = useMemo(() => ({
    words:            countWords(text),
    charsWithSpaces:  countChars(text, true),
    charsNoSpaces:    countChars(text, false),
    paragraphs:       structure.paragraphs,
    lines:            text.split("\n").length,
    readingMinutes:   Math.max(1, Math.round(countWords(text) / 180)),
  }), [text, structure.paragraphs]);

  async function handleAiAnalyze(targetStyle?: CitationStyle) {
    if (!text.trim()) return;
    const req = {
      text,
      language: structure.language,
      ...(targetStyle ? { targetStyle } : {}),
    };
    const result = await runAiAnalysis(req);
    if (!result) return;

    if (result.items?.length) {
      setAiFound(result.items as FoundItem[]);
    }

    if (result.error) {
      const msg = result.error;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("501") || msg.includes("не задан")) {
        setAiSetupOpen(true);
      }
      toast({ title: "AI недоступен", description: msg, variant: "destructive" });
      return;
    }

    if (result.convertedText && result.convertedText.trim()) {
      const converted = result.convertedText;
      setText(converted);
      setDraft(converted);
      setPreview(null);
      if (targetStyle) setAiTargetStyle(targetStyle);
      toast({
        title: "AI-конвертация применена",
        description: targetStyle
          ? `Документ переформатирован в ${targetStyle} (Gemini). Проверьте вручную.`
          : "Документ нормализован Gemini. Проверьте вручную.",
      });
      return;
    }

    if (targetStyle) {
      setAiTargetStyle(targetStyle);
      toast({
        title: "AI-анализ завершён",
        description: "Gemini не вернул преобразованный текст. Используйте эвристическую конвертацию.",
      });
    } else {
      toast({
        title: "AI-анализ завершён",
        description:
          result.summary ||
          `Найдено ${result.items?.length ?? 0} элементов` +
          (result.confidence ? ` (уверенность ${Math.round(result.confidence * 100)}%)` : "") + ".",
      });
    }
  }

  const filteredFound = useMemo(() => {
    const q = search.trim().toLowerCase();
    return found.filter((f) => {
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (!q) return true;
      return f.text.toLowerCase().includes(q) || (f.note ?? "").toLowerCase().includes(q);
    });
  }, [found, search, typeFilter]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const imported = await importFile(f);
    if (!imported.text) {
      setWarnings(imported.warnings);
      toast({ title: "Импорт не удался", description: imported.warnings[0] ?? "Файл пуст." });
      return;
    }
    setDocName(imported.name);
    setText(imported.text);
    setDraft(imported.text);
    setWarnings(imported.warnings);
    setPreview(null); setSelected(null); setAiFound(null); setAiTargetStyle(null);
    if (imported.warnings.length > 0) {
      toast({ title: "Файл загружен с предупреждениями", description: imported.warnings[0] });
    }
  }

  async function handleUrlImport() {
    if (!linkUrl.trim()) return;
    setLinkLoading(true);
    try {
      const res = await apiRequest("POST", "/api/import-url", { url: linkUrl });
      const data = await res.json() as { text?: string; name?: string; warnings?: string[]; message?: string };
      if (!res.ok) {
        toast({ title: "Не удалось загрузить ссылку", description: data.message ?? "Проверьте, что документ доступен публично.", variant: "destructive" });
        return;
      }
      setDocName(data.name ?? "документ.txt");
      setText(data.text ?? "");
      setDraft(data.text ?? "");
      setWarnings(data.warnings ?? []);
      setPreview(null); setSelected(null); setLinkDialogOpen(false); setLinkUrl(""); setAiFound(null); setAiTargetStyle(null);
      if (data.warnings?.length) {
        toast({ title: "Импорт завершён с предупреждениями", description: data.warnings[0] });
      }
    } catch (error) {
      toast({
        title: "Не удалось загрузить ссылку",
        description: error instanceof Error ? error.message : "Проверьте, что документ доступен публично.",
      });
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleExport() {
    const currentText = preview?.text ?? text;
    try {
      await exportDocument(currentText, docName, exportFormat);
      toast({ title: "Файл подготовлен", description: `Экспорт в ${exportFormat.toUpperCase()} запущен.` });
    } catch (error) {
      toast({ title: "Экспорт не удался", description: error instanceof Error ? error.message : "Попробуйте другой формат." });
    }
  }

  async function handleDriveExport() {
    const currentText = preview?.text ?? text;
    const ok = window.confirm("Экспорт создаст новый файл в вашем Google Drive. Продолжить?");
    if (!ok) return;
    setDriveLoading(true);
    try {
      const res = await apiRequest("POST", "/api/export-drive", { text: currentText, docName, format: exportFormat });
      const payload = await res.json() as { url?: string; message?: string; name?: string };
      toast({ title: "Файл отправлен в Google Drive", description: payload.url || payload.name || payload.message || "Проверьте Google Drive." });
    } catch (error) {
      toast({ title: "Экспорт в Drive не удался", description: error instanceof Error ? error.message : "Проверьте подключение." });
    } finally {
      setDriveLoading(false);
    }
  }

  function loadDemo(id: DemoId) {
    const doc = DEMO_DOCS.find((d) => d.id === id);
    if (!doc) return;
    setText(doc.text); setDraft(doc.text); setDocName(doc.label + ".txt");
    setPreview(null); setSelected(null); setSearch(""); setTypeFilter("all"); setWarnings([]); setAiFound(null); setAiTargetStyle(null);
    toast({ title: "Демо загружено", description: doc.label });
  }

  function applyConversion() {
    if (!preview) return;
    const t = preview.target;
    setText(preview.text); setDraft(preview.text); setPreview(null); setAiFound(null); setAiTargetStyle(null);
    toast({ title: "Конвертация применена", description: `Документ переформатирован в ${t}.` });
  }

  const currentText = preview?.text ?? text;
  const aiStatusOk = !aiLoading && !!aiData && !aiError;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground" data-testid="workbench">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b flex items-center px-4 gap-3 shrink-0 bg-background/80 backdrop-blur" data-testid="header">
        <div className="flex items-center gap-2.5">
          <CodexLogo size={28} />
          <div className="leading-none select-none">
            <div className="text-[15px] font-semibold tracking-tight text-foreground">CitaDex</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">Academic Citation Workspace</div>
          </div>
        </div>
        <Separator orientation="vertical" className="h-7 mx-2" />
        <div className="flex items-center gap-2 text-sm min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium truncate max-w-[28ch]" data-testid="text-docname">{docName}</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide ml-1">демо</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0 overflow-x-auto">
          <input ref={fileInput} type="file" accept=".docx,.txt,.md" onChange={handleFile} className="hidden" data-testid="input-file" />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-1.5" />Импорт
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)} data-testid="button-import-link">
            <Link2 className="h-4 w-4 mr-1.5" />Ссылка
          </Button>
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
            <SelectTrigger className="h-9 w-[112px]" data-testid="select-export-format"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="docx">DOCX</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="md">Markdown</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-1.5" />Экспорт
          </Button>
          <Button variant="outline" size="sm" onClick={handleDriveExport} disabled={driveLoading} data-testid="button-export-drive">
            <Upload className="h-4 w-4 mr-1.5" />{driveLoading ? "Drive…" : "В Drive"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAiAnalyze()} disabled={aiLoading || !text.trim()} data-testid="button-ai-analyze"
            title="Анализ цитирования через Gemini AI. Требует GEMINI_API_KEY.">
            <Sparkles className="h-4 w-4 mr-1.5" />{aiLoading ? "AI…" : "AI-анализ"}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── AI Status bar ───────────────────────────────────────────────────── */}
      {(aiLoading || aiData || aiError) && (
        <div className="h-7 border-b px-4 flex items-center gap-2 text-[11px] bg-muted/40">
          <Sparkles className="h-3 w-3 text-primary" />
          {aiLoading && <span className="text-muted-foreground animate-pulse">Gemini анализирует документ…</span>}
          {!aiLoading && aiData && !aiError && (
            <span className="text-muted-foreground">
              Gemini: {aiData.detectedStyle ?? "?"} · {aiData.items?.length ?? 0} элементов
              {aiData._model ? ` · ${aiData._model}` : ""}
              {aiData.convertedText ? " · конвертация применена ✓" : ""}
            </span>
          )}
          {!aiLoading && aiError && (
            <span className="text-destructive">{aiError}</span>
          )}
        </div>
      )}

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar */}
        <aside
          className="shrink-0 border-r bg-sidebar flex flex-col min-h-0 select-none"
          style={{ width: sidebar.width }}
          data-testid="sidebar"
        >
          <ScrollArea className="flex-1 py-2">
            <nav className="px-2 space-y-0.5">
              {(Object.entries(PANEL_LABELS) as [Panel, typeof PANEL_LABELS[Panel]][]).map(([key, { label, icon: Icon }]) => (
                <button
                  key={key}
                  onClick={() => setPanel(key)}
                  className={[
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] transition-colors",
                    panel === key
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                  ].join(" ")}
                  data-testid={`nav-${key}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </nav>
          </ScrollArea>

          <div className="border-t px-3 py-2 text-[10.5px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Слов</span><span className="font-medium text-foreground">{stats.words.toLocaleString("ru")}</span>
            </div>
            <div className="flex justify-between">
              <span>Цитат</span><span className="font-medium text-foreground">{found.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Стиль</span><span className="font-medium text-foreground">{detected.style}</span>
            </div>
          </div>
        </aside>

        {/* Sidebar resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors"
          onMouseDown={sidebar.onMouseDown}
        />

        {/* ── Centre: document view ──────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden" data-testid="main">
          {preview && (
            <div className="border-b bg-amber-50 dark:bg-amber-950/30 px-4 py-2 flex items-center gap-3 text-[12px] shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">
                Предпросмотр конвертации → <strong>{preview.target}</strong>. Исходный документ не изменён.
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setPreview(null)}>Отмена</Button>
                <Button size="sm" className="h-7 text-[11px]" onClick={applyConversion}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Применить
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            <div className="max-w-3xl mx-auto px-10">
              {editMode ? (
                <div className="relative">
                  <textarea
                    className="rich-editor w-full resize-none bg-transparent focus:outline-none"
                    style={{ minHeight: "calc(100vh - 180px)" }}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    data-testid="editor-textarea"
                  />
                  <div className="sticky bottom-4 flex justify-end gap-2 pb-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { setDraft(text); setEditMode(false); }}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Отмена
                    </Button>
                    <Button size="sm" className="h-8" onClick={() => { setText(draft); setEditMode(false); setAiFound(null); setPreview(null); }}>
                      <Save className="h-3.5 w-3.5 mr-1" />Сохранить
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="rich-editor"
                  data-testid="document-view"
                  dangerouslySetInnerHTML={{ __html: buildAnnotatedHtml(currentText, found, issues, selected, hoveredId) }}
                  onClick={(e) => {
                    const span = (e.target as HTMLElement).closest("[data-ann-id]");
                    if (!span) { setSelected(null); return; }
                    const id = span.getAttribute("data-ann-id")!;
                    const item = found.find((f) => f.id === id);
                    if (item) setSelected({ start: item.start, end: item.end });
                  }}
                />
              )}
            </div>
          </div>

          {!editMode && (
            <div className="border-t h-9 flex items-center px-4 gap-2 bg-background/60 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setDraft(text); setEditMode(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Редактировать
              </Button>
              {warnings.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />{warnings.length} предупрежд.
                </Badge>
              )}
            </div>
          )}
        </main>

        {/* Right panel resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors"
          onMouseDown={rightPanel.onMouseDown}
        />

        {/* ── Right panel ────────────────────────────────────────────────────── */}
        <aside
          className="shrink-0 border-l bg-background flex flex-col min-h-0 overflow-hidden"
          style={{ width: rightPanel.width }}
          data-testid="right-panel"
        >
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-4">

              {panel === "structure" && <StructurePanel structure={structure} />}

              {panel === "citations" && (
                <CitationsPanel
                  found={filteredFound}
                  allFound={found}
                  search={search}
                  setSearch={setSearch}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                  selected={selected}
                  setSelected={setSelected}
                />
              )}

              {panel === "style" && (
                <StylePanel
                  detected={detected}
                  found={found}
                  customRules={customRules}
                  setCustomRules={setCustomRules}
                />
              )}

              {panel === "convert" && (
                <ConvertPanel
                  text={text}
                  found={found}
                  detected={detected}
                  customRules={customRules}
                  preview={preview}
                  setPreview={setPreview}
                  aiLoading={aiLoading}
                  onAiConvert={(style) => handleAiAnalyze(style)}
                  aiTargetStyle={aiTargetStyle}
                />
              )}

              {panel === "editor" && (
                <EditorPanel
                  issues={issues}
                  text={text}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
              )}

              {panel === "stats" && <StatsPanel stats={stats} found={found} />}

              {panel === "demos" && <DemosPanel onLoad={loadDemo} />}

            </div>
          </ScrollArea>
        </aside>
      </div>

      {/* ── Link import dialog ──────────────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт по ссылке</DialogTitle>
            <DialogDescription>Вставьте URL публичного документа (.docx, .txt, .md или веб-страница).</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUrlImport} disabled={linkLoading}>
              {linkLoading ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI setup hint dialog ────────────────────────────────────────────── */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройка Gemini AI</DialogTitle>
            <DialogDescription>
              Для работы AI-анализа укажите переменную окружения <code className="font-mono text-[12px] bg-muted px-1 rounded">GEMINI_API_KEY</code> на сервере.
            </DialogDescription>
          </DialogHeader>
          <div className="text-[13px] text-muted-foreground space-y-2">
            <p>1. Получите ключ на <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com</a>.</p>
            <p>2. Добавьте в файл <code className="font-mono text-[12px] bg-muted px-1 rounded">.env</code>:</p>
            <pre className="bg-muted rounded p-2 text-[11px] font-mono">GEMINI_API_KEY=ваш_ключ</pre>
            <p>3. Перезапустите сервер.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAiSetupOpen(false)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-panels
// ─────────────────────────────────────────────────────────────────────────────

function PanelHeader({ title, hint, badge }: { title: string; hint?: string; badge?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

function StructurePanel({ structure }: { structure: ReturnType<typeof analyzeStructure> }) {
  const metrics = [
    { label: "Язык",       value: structure.language === "ru" ? "RU" : structure.language === "en" ? "EN" : "Mixed" },
    { label: "Разделов",   value: structure.sections.length },
    { label: "Параграфов", value: structure.paragraphs },
    { label: "Сносок",     value: structure.footnoteCount },
  ];

  return (
    <div className="space-y-4">
      <PanelHeader title="Структура документа" hint="Разделы и аннотированные блоки." />

      {/* Metrics grid — 2 cols, no overflow */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-card p-2 overflow-hidden">
            <div className="text-[20px] font-bold text-primary tabular-nums leading-none truncate">{value}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Sections list */}
      {structure.sections.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Разделы</div>
          <div className="space-y-0.5">
            {structure.sections.map((s, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 min-w-0 overflow-hidden rounded px-1 py-0.5 hover:bg-accent/40 transition-colors"
              >
                {/* line number — fixed width, never shrinks */}
                <span className="text-[10.5px] text-muted-foreground tabular-nums shrink-0 w-6 text-right">
                  {s.line}
                </span>
                {/* section text — truncates, never overflows */}
                <span
                  className="text-[12px] truncate min-w-0 flex-1"
                  title={s.text}
                >
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CitationsPanel({
  found, allFound, search, setSearch, typeFilter, setTypeFilter,
  hoveredId, setHoveredId, selected, setSelected,
}: {
  found: FoundItem[]; allFound: FoundItem[];
  search: string; setSearch: (s: string) => void;
  typeFilter: string; setTypeFilter: (s: string) => void;
  hoveredId: string | null; setHoveredId: (id: string | null) => void;
  selected: { start: number; end: number } | null;
  setSelected: (s: { start: number; end: number } | null) => void;
}) {
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    allFound.forEach((f) => { m[f.type] = (m[f.type] ?? 0) + 1; });
    return m;
  }, [allFound]);

  return (
    <div className="space-y-3">
      <PanelHeader
        title="Найденные элементы"
        badge={`${allFound.length}`}
        hint="Цитаты, сноски и библиографические записи, найденные в тексте."
      />

      {allFound.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).filter(([t]) => typeCounts[t]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={`flex items-center gap-1 text-[10.5px] transition-opacity ${
                typeFilter !== "all" && typeFilter !== t ? "opacity-40" : ""
              }`}
            >
              <span className={`legend-dot ${legendDotClass(t)}`} />
              {label} ({typeCounts[t]})
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Поиск по тексту..."
          className="pl-8 h-8 text-[12px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        {found.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            {allFound.length === 0 ? "Цитирования не найдены." : "Нет совпадений."}
          </p>
        )}
        {found.map((f) => (
          <button
            key={f.id}
            onMouseEnter={() => setHoveredId(f.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setSelected(selected?.start === f.start ? null : { start: f.start, end: f.end })}
            className={[
              "w-full text-left rounded-md border px-2.5 py-2 transition-colors text-[12px]",
              selected?.start === f.start
                ? "border-primary/60 bg-primary/5"
                : hoveredId === f.id
                ? "bg-accent/50"
                : "hover:bg-accent/30",
            ].join(" ")}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`legend-dot ${legendDotClass(f.type)}`} />
              <span className="text-[10.5px] text-muted-foreground">{TYPE_LABELS[f.type]}</span>
              {f.confidence !== undefined && (
                <span className="ml-auto text-[10px] text-muted-foreground/70">
                  {Math.round(f.confidence * 100)}%
                </span>
              )}
            </div>
            <div className="line-clamp-2 text-[12px]">{f.text}</div>
            {f.note && <div className="text-[10.5px] text-muted-foreground mt-0.5">{f.note}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function StylePanel({
  detected, found, customRules, setCustomRules,
}: {
  detected: ReturnType<typeof detectStyle>;
  found: FoundItem[];
  customRules: CustomCitationRules;
  setCustomRules: (r: CustomCitationRules) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-4">
      <PanelHeader title="Стиль цитирования" hint="Автоматическое определение стандарта оформления." />

      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">{detected.style}</span>
          <Badge variant="outline" className="text-[10px]">
            {Math.round(detected.confidence * 100)}% уверенность
          </Badge>
        </div>
        {detected.evidence.length > 0 && (
          <ul className="space-y-0.5">
            {detected.evidence.map((e, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <button
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowCustom(!showCustom)}
        >
          {showCustom ? "▾" : "▸"} Авторские правила цитирования
        </button>
        {showCustom && (
          <div className="space-y-2 rounded-md border p-3">
            {([
              ["name",                  "Название стандарта"],
              ["inlineTemplate",        "Шаблон вставки"],
              ["bibliographyTemplate",  "Шаблон библиографии"],
              ["footnoteTemplate",      "Шаблон сноски"],
              ["separator",            "Разделитель"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-0.5">
                <Label className="text-[10.5px]">{label}</Label>
                <Input
                  className="h-7 text-[11px] font-mono"
                  value={customRules[field]}
                  onChange={(e) => setCustomRules({ ...customRules, [field]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConvertPanel({
  text, found, detected, customRules, preview, setPreview, aiLoading, onAiConvert, aiTargetStyle,
}: {
  text: string;
  found: FoundItem[];
  detected: ReturnType<typeof detectStyle>;
  customRules: CustomCitationRules;
  preview: { target: CitationStyle; text: string } | null;
  setPreview: (p: { target: CitationStyle; text: string } | null) => void;
  aiLoading: boolean;
  onAiConvert: (style: CitationStyle) => void;
  aiTargetStyle: CitationStyle | null;
}) {