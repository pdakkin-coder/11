import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
  Zap, Settings2, ChevronDown,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Panel = "structure" | "citations" | "style" | "convert" | "editor" | "stats";

const PANEL_LABELS: Record<Panel, { label: string; icon: typeof FileText }> = {
  structure: { label: "Структура", icon: Layers },
  citations: { label: "Цитаты и сноски", icon: BookOpen },
  style:     { label: "Стиль цитирования", icon: Wand2 },
  convert:   { label: "Конвертация", icon: ArrowLeftRight },
  editor:    { label: "Редактура", icon: PenSquare },
  stats:     { label: "Статистика", icon: Hash },
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

// Convert scope options
const CONVERT_SCOPE_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "citations",    label: "Цитаты",          description: "Внутритекстовые ссылки" },
  { id: "bibliography", label: "Библиография",     description: "Список литературы" },
  { id: "structure",    label: "Структура",        description: "Заголовки разделов" },
  { id: "typos",        label: "Опечатки",         description: "Орфография и типографика" },
  { id: "syntax",       label: "Синтаксис",        description: "Знаки препинания, тире, кавычки" },
];

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
  const [aiConvertLoading, setAiConvertLoading] = useState(false);
  const [aiSetupOpen, setAiSetupOpen]   = useState(false);
  const [aiTargetStyle, setAiTargetStyle] = useState<CitationStyle | null>(null);
  // Convert scope state
  const [convertScope, setConvertScope] = useState<string[]>(["citations", "bibliography"]);
  const [convertTargetStyle, setConvertTargetStyle] = useState<CitationStyle>("APA");

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

  // ── AI: analysis only (structure + citation detection) ───────────────────
  async function handleAiAnalyze() {
    if (!text.trim()) return;
    const result = await runAiAnalysis({ text, language: structure.language });
    if (!result) return;

    if (result.items?.length) setAiFound(result.items as FoundItem[]);

    if (result.error) {
      const msg = result.error;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("501") || msg.includes("не задан")) {
        setAiSetupOpen(true);
      }
      toast({ title: "AI недоступен", description: msg, variant: "destructive" });
      return;
    }

    toast({
      title: "AI-анализ завершён",
      description: result.summary ||
        `Найдено ${result.items?.length ?? 0} элементов` +
        (result.confidence ? ` (уверенность ${Math.round(result.confidence * 100)}%)` : "") + ".",
    });
  }

  // ── AI: conversion with scope ─────────────────────────────────────────────
  async function handleAiConvert() {
    if (!text.trim() || convertScope.length === 0) return;
    setAiConvertLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai-convert", {
        text,
        targetStyle: convertTargetStyle,
        scope: convertScope,
        language: structure.language,
      });
      const result = await res.json() as {
        convertedText?: string | null;
        summary?: string;
        error?: string;
        items?: FoundItem[];
        confidence?: number;
        _model?: string;
      };

      if (result.error) {
        if (result.error.includes("GEMINI_API_KEY") || result.error.includes("501")) {
          setAiSetupOpen(true);
        }
        toast({ title: "AI-конвертация не удалась", description: result.error, variant: "destructive" });
        return;
      }

      if (result.items?.length) setAiFound(result.items as FoundItem[]);

      if (result.convertedText && result.convertedText.trim()) {
        setText(result.convertedText);
        setDraft(result.convertedText);
        setPreview(null);
        setAiTargetStyle(convertTargetStyle);
        toast({
          title: "AI-конвертация применена",
          description: `Документ переформатирован: ${convertScope.join(", ")} → ${convertTargetStyle}${result._model ? ` (${result._model})` : ""}. Проверьте вручную.`,
        });
      } else {
        toast({
          title: "AI-конвертация завершена",
          description: result.summary || "Изменений не потребовалось или Gemini не вернул текст.",
        });
      }
    } catch (err) {
      toast({
        title: "AI-конвертация не удалась",
        description: err instanceof Error ? err.message : "Проверьте подключение.",
        variant: "destructive",
      });
    } finally {
      setAiConvertLoading(false);
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
  }

  function applyConversion() {
    if (!preview) return;
    const t = preview.target;
    setText(preview.text); setDraft(preview.text); setPreview(null); setAiFound(null); setAiTargetStyle(null);
    toast({ title: "Конвертация применена", description: `Документ переформатирован в ${t}.` });
  }

  function toggleScope(id: string) {
    setConvertScope((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const currentText = preview?.text ?? text;
  const aiStatusOk = !aiLoading && !!aiData && !aiError;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground" data-testid="workbench">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b flex items-center px-4 gap-3 shrink-0 bg-background/80 backdrop-blur" data-testid="header">
        <div className="flex items-center gap-2.5 shrink-0">
          <CodexLogo size={28} />
          <div className="leading-none select-none">
            <div className="text-[15px] font-semibold tracking-tight text-foreground">CitaDex</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">Academic Citation Workspace</div>
          </div>
        </div>
        <Separator orientation="vertical" className="h-7 mx-2" />
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate max-w-[28ch]" data-testid="text-docname">{docName}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
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
          <Button variant="outline" size="sm" onClick={handleAiAnalyze} disabled={aiLoading || !text.trim()} data-testid="button-ai-analyze"
            title="Анализ структуры и цитирования через Gemini AI">
            <Sparkles className="h-4 w-4 mr-1.5" />{aiLoading ? "AI…" : "AI-анализ"}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── AI Status bar ───────────────────────────────────────────────────── */}
      {(aiLoading || aiConvertLoading || aiData || aiError) && (
        <div className="h-7 border-b px-4 flex items-center gap-2 text-[11px] bg-muted/40">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {(aiLoading || aiConvertLoading) && <span>{aiConvertLoading ? "AI-конвертация выполняется…" : "AI-анализ выполняется…"}</span>}
          {aiStatusOk && !aiConvertLoading && (
            <span>
              AI‑анализ активен: {aiData!.items.length} элементов, стиль{" "}
              {aiData!.detectedStyle} ({Math.round((aiData!.confidence ?? 0) * 100)}%).
              {aiTargetStyle && <> · конвертация в <strong>{aiTargetStyle}</strong> применена.</>}
            </span>
          )}
          {!aiLoading && !aiConvertLoading && aiError && (
            <button
              type="button"
              className="text-destructive underline-offset-2 hover:underline"
              onClick={() => setAiSetupOpen(true)}
            >
              AI недоступен: {aiError}
            </button>
          )}
        </div>
      )}

      {/* ── Import-by-link dialog ──────────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Импорт по ссылке</DialogTitle>
            <DialogDescription>Укажите публичную ссылку на документ (.docx, .txt, .md или Google Docs).</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://docs.google.com/document/d/…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUrlImport} disabled={linkLoading || !linkUrl.trim()}>
              {linkLoading ? "Загрузка…" : "Импортировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Setup hint dialog ───────────────────────────────────────────── */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройка Gemini AI</DialogTitle>
            <DialogDescription>Для AI-анализа и AI-конвертации необходим ключ Gemini API.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>1. Получите бесплатный ключ на <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com</a>.</p>
            <p>2. Установите переменную окружения: <code className="bg-muted px-1 rounded">GEMINI_API_KEY=ваш_ключ</code></p>
            <p>3. Перезапустите сервер (<code className="bg-muted px-1 rounded">npm run dev</code>).</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAiSetupOpen(false)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left sidebar ──────────────────────────────────────────────────── */}
        <aside
          className="flex flex-col border-r bg-muted/30 shrink-0"
          style={{ width: sidebar.width }}
          data-testid="sidebar"
        >
          <nav className="flex flex-col gap-1 p-2 flex-1">
            {(Object.entries(PANEL_LABELS) as [Panel, { label: string; icon: typeof FileText }][]).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full text-left transition-colors ${
                  panel === key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                {key === "citations" && found.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 shrink-0">{found.length}</Badge>
                )}
                {key === "editor" && issues.length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 shrink-0">{issues.length}</Badge>
                )}
              </button>
            ))}
          </nav>

          {/* Demo selector — at the bottom of the sidebar */}
          <div className="p-2 border-t">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-1 mb-1.5">Демо-документы</p>
            <Select onValueChange={(v) => loadDemo(v as DemoId)}>
              <SelectTrigger className="h-8 w-full text-xs" data-testid="select-demo">
                <SelectValue placeholder="Загрузить демо…" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_DOCS.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resize handle */}
          <div
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
            style={{ left: sidebar.width - 1 }}
            onMouseDown={sidebar.onMouseDown}
          />
        </aside>

        {/* ── Document editor ───────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Toolbar */}
          {editMode && (
            <div className="h-9 border-b flex items-center gap-1 px-3 bg-muted/20 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("bold")}><Bold className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("italic")}><Italic className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("underline")}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("insertUnorderedList")}><List className="h-3.5 w-3.5" /></Button>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setDraft(text); setEditMode(false); }}>
                  <RotateCcw className="h-3 w-3 mr-1" />Отмена
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => { setText(draft); setEditMode(false); toast({ title: "Изменения сохранены" }); }}>
                  <Save className="h-3.5 w-3.5 mr-1" />Сохранить
                </Button>
              </div>
            </div>
          )}

          {/* Preview banner */}
          {preview && (
            <div className="h-9 border-b flex items-center gap-3 px-4 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm shrink-0">
              <RefreshCw className="h-4 w-4" />
              <span>Предпросмотр конвертации в <strong>{preview.target}</strong></span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400" onClick={() => setPreview(null)}>Отмена</Button>
                <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={applyConversion}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Применить</Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div
              className={`p-6 min-h-full font-mono text-sm leading-relaxed outline-none whitespace-pre-wrap ${
                editMode ? "cursor-text" : ""
              } ${
                preview ? "opacity-90" : ""
              }`}
              contentEditable={editMode}
              suppressContentEditableWarning
              onInput={(e) => setDraft((e.target as HTMLDivElement).innerText)}
              data-testid="document-area"
            >
              {currentText}
            </div>
          </ScrollArea>

          {/* Edit mode toggle */}
          {!editMode && (
            <button
              type="button"
              className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
              onClick={() => setEditMode(true)}
              title="Редактировать документ"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </main>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div
          className="flex flex-col border-l bg-background shrink-0 relative"
          style={{ width: rightPanel.width }}
          data-testid="right-panel"
        >
          {/* Resize handle */}
          <div
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
            style={{ left: 0 }}
            onMouseDown={rightPanel.onMouseDown}
          />

          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* ── Structure panel ─────────────────────────────────────── */}
              {panel === "structure" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Структура документа</h2>
                    <Badge variant="outline" className="text-[10px]">{structure.sections.length} разд.</Badge>
                  </div>

                  {/* Language + paragraph count */}
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Type className="h-3 w-3" />{structure.language === "ru" ? "RU" : structure.language === "en" ? "EN" : "RU+EN"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <AlignLeft className="h-3 w-3" />{structure.paragraphs} абз.
                    </Badge>
                  </div>

                  {/* Sections list */}
                  {structure.sections.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Разделы не обнаружены.</p>
                  ) : (
                    <div className="space-y-1">
                      {structure.sections.map((sec, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
                          style={{ paddingLeft: `${(sec.level ?? 1) * 0.5 + 0.5}rem` }}
                        >
                          <span className="text-[10px] text-muted-foreground mt-0.5 shrink-0 w-4 text-right">{sec.level ?? 1}</span>
                          <span className="text-xs leading-snug break-words min-w-0 flex-1">{sec.heading}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">{sec.startLine}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI structure hint */}
                  {!aiData && (
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Запустите <span className="font-medium">AI-анализ</span> для уточнённого распознавания разделов.
                    </p>
                  )}
                </div>
              )}

              {/* ── Citations panel ─────────────────────────────────────── */}
              {panel === "citations" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Цитаты и сноски</h2>
                    <Badge variant="outline" className="text-[10px]">{found.length}</Badge>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Поиск…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {/* Type filter */}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все типы</SelectItem>
                      {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).map(([type, label]) => (
                        <SelectItem key={type} value={type}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).map(([type, label]) => (
                      <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${legendDotClass(type)}`} />
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* List */}
                  {filteredFound.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ничего не найдено.</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredFound.map((item) => (
                        <div
                          key={item.id}
                          className={`p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                            selected?.start === item.start
                              ? "border-primary bg-primary/5"
                              : hoveredId === item.id
                              ? "border-muted-foreground/40 bg-muted/40"
                              : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/20"
                          }`}
                          onMouseEnter={() => setHoveredId(item.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => setSelected({ start: item.start, end: item.end })}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${legendDotClass(item.type)}`} />
                            <span className="font-medium text-[10px] uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[item.type]}</span>
                            {item.confidence !== undefined && (
                              <span className="ml-auto text-[10px] text-muted-foreground">{Math.round(item.confidence * 100)}%</span>
                            )}
                          </div>
                          <p className="truncate">{item.text}</p>
                          {item.note && <p className="text-muted-foreground truncate">{item.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Style panel ─────────────────────────────────────────── */}
              {panel === "style" && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold">Стиль цитирования</h2>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Обнаруженный стиль</p>
                    <p className="text-sm font-semibold">{detected.style}</p>
                    <p className="text-xs text-muted-foreground">Уверенность: {Math.round(detected.confidence * 100)}%</p>
                  </div>
                  {detected.notes.length > 0 && (
                    <div className="space-y-1">
                      {detected.notes.map((n, i) => (
                        <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-primary mt-0.5">•</span>{n}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Convert panel ───────────────────────────────────────── */}
              {panel === "convert" && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold">Конвертация</h2>

                  {/* Heuristic conversion */}
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Эвристическая</p>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(v) => {
                          const result = convertCitations(text, v as CitationStyle);
                          setPreview({ target: v as CitationStyle, text: result });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Выберите стиль…" /></SelectTrigger>
                        <SelectContent>
                          {(["APA", "Chicago", "MLA", "IEEE", "Vancouver", "Harvard", "GOST"] as CitationStyle[]).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {preview && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Предпросмотр активен — подтвердите в документе.
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* AI conversion */}
                  <div className="space-y-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">AI-конвертация (Gemini)</p>

                    {/* Target style */}
                    <div className="space-y-1">
                      <Label className="text-xs">Целевой стиль</Label>
                      <Select value={convertTargetStyle} onValueChange={(v) => setConvertTargetStyle(v as CitationStyle)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["APA", "Chicago", "MLA", "IEEE", "Vancouver", "Harvard", "GOST"] as CitationStyle[]).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Scope checkboxes */}
                    <div className="space-y-1">
                      <Label className="text-xs">Что конвертировать</Label>
                      <div className="space-y-1.5">
                        {CONVERT_SCOPE_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-start gap-2">
                            <Checkbox
                              id={`scope-${opt.id}`}
                              checked={convertScope.includes(opt.id)}
                              onCheckedChange={() => toggleScope(opt.id)}
                              className="mt-0.5"
                            />
                            <label htmlFor={`scope-${opt.id}`} className="text-xs cursor-pointer">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-muted-foreground"> — {opt.description}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={handleAiConvert}
                      disabled={aiConvertLoading || !text.trim() || convertScope.length === 0}
                      data-testid="button-ai-convert"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      {aiConvertLoading ? "Конвертация…" : `AI-конвертация (${convertScope.length})`}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      Gemini переформатирует выбранные блоки. Результат применяется к документу — проверьте вручную.
                    </p>
                  </div>

                  <Separator />

                  {/* Custom rules */}
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Авторский шаблон</p>
                    <div className="space-y-1.5">
                      <div>
                        <Label className="text-[10px]">Название стиля</Label>
                        <Input className="h-7 text-xs mt-0.5" value={customRules.name} onChange={(e) => setCustomRules((r) => ({ ...r, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Шаблон вставки</Label>
                        <Input className="h-7 text-xs mt-0.5 font-mono" value={customRules.inlineTemplate} onChange={(e) => setCustomRules((r) => ({ ...r, inlineTemplate: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Шаблон библиографии</Label>
                        <Input className="h-7 text-xs mt-0.5 font-mono" value={customRules.bibliographyTemplate} onChange={(e) => setCustomRules((r) => ({ ...r, bibliographyTemplate: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Editor panel ────────────────────────────────────────── */}
              {panel === "editor" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Редактура</h2>
                    <Badge variant={issues.length > 0 ? "destructive" : "secondary"} className="text-[10px]">{issues.length}</Badge>
                  </div>
                  {issues.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Замечаний не найдено.</p>
                  ) : (
                    <div className="space-y-1">
                      {issues.map((issue, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-md border border-transparent hover:border-destructive/30 hover:bg-destructive/5 cursor-pointer transition-colors"
                          onClick={() => setSelected({ start: issue.start, end: issue.end })}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                            <span className="text-[10px] uppercase tracking-wide font-medium text-destructive">{ISSUE_LABELS[issue.type]}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">стр. {issue.line}</span>
                          </div>
                          <p className="text-xs truncate">{issue.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Stats panel ─────────────────────────────────────────── */}
              {panel === "stats" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold">Статистика</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["Слов",              stats.words],
                      ["Знаков (с пробелами)", stats.charsWithSpaces],
                      ["Знаков (без пробелов)", stats.charsNoSpaces],
                      ["Абзацев",           stats.paragraphs],
                      ["Строк",             stats.lines],
                      ["Время чтения",      `~${stats.readingMinutes} мин`],
                    ] as [string, string | number][]).map(([label, val]) => (
                      <div key={label} className="p-2 rounded-md bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
