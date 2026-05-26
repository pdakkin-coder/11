import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
  Zap, ChevronDown, FlaskConical,
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  useAiAnalyze, useAiConvert, mergeFoundItems,
  type AiAnalyzeResponse, type AiConvertResponse,
  type ConvertScope, CONVERT_SCOPE_LABELS,
} from "@/lib/aiAnalyze";

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

  const { analyze: runAiAnalysis, loading: aiAnalyzeLoading, data: aiAnalyzeData, error: aiAnalyzeError } = useAiAnalyze();
  const { convert: runAiConvert, loading: aiConvertLoading, data: aiConvertData, error: aiConvertError } = useAiConvert();

  const aiLoading = aiAnalyzeLoading || aiConvertLoading;
  const aiData    = aiAnalyzeData;
  const aiError   = aiAnalyzeError || aiConvertError;

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
  const [convertScopes, setConvertScopes] = useState<ConvertScope[]>(["citations", "bibliography"]);

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

  // ── AI Analyze (structure + citation markup) ──────────────────────────────
  async function handleAiAnalyze() {
    if (!text.trim()) return;
    const result = await runAiAnalysis({ text, language: structure.language });
    if (!result) return;

    if (result.items?.length) setAiFound(result.items as FoundItem[]);

    if (result.error) {
      const msg = result.error;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("501") || msg.includes("не задан")) setAiSetupOpen(true);
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

  // ── AI Convert (targeted conversion) ─────────────────────────────────────
  async function handleAiConvert(targetStyle: CitationStyle, scopes: ConvertScope[]) {
    if (!text.trim()) return;
    const result = await runAiConvert({ text, targetStyle, language: structure.language, scopes });
    if (!result) return;

    if (result.error) {
      const msg = result.error;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("501") || msg.includes("не задан")) setAiSetupOpen(true);
      toast({ title: "AI недоступен", description: msg, variant: "destructive" });
      return;
    }

    if (result.convertedText && result.convertedText.trim()) {
      setText(result.convertedText);
      setDraft(result.convertedText);
      setPreview(null);
      setAiTargetStyle(targetStyle);
      toast({
        title: "AI-конвертация применена",
        description: result.summary || `Документ переформатирован в ${targetStyle}. Проверьте вручную.`,
      });
    } else {
      setAiTargetStyle(targetStyle);
      toast({
        title: "AI-конвертация",
        description: "Gemini не вернул изменений — документ уже в нужном формате или изменения не найдены.",
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
      setText(data.text ?? ""); setDraft(data.text ?? "");
      setWarnings(data.warnings ?? []);
      setPreview(null); setSelected(null); setLinkDialogOpen(false); setLinkUrl(""); setAiFound(null); setAiTargetStyle(null);
      if (data.warnings?.length) toast({ title: "Импорт завершён с предупреждениями", description: data.warnings[0] });
    } catch (error) {
      toast({ title: "Не удалось загрузить ссылку", description: error instanceof Error ? error.message : "Проверьте, что документ доступен публично." });
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

  const currentText = preview?.text ?? text;
  const aiAnalyzeOk = !aiAnalyzeLoading && !!aiAnalyzeData && !aiAnalyzeError;

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
            title="Анализ структуры, блоков и цитирования через Gemini AI">
            <Sparkles className="h-4 w-4 mr-1.5" />{aiAnalyzeLoading ? "Анализ…" : "AI-анализ"}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── AI Status bar ───────────────────────────────────────────────────── */}
      {(aiLoading || aiAnalyzeData || aiError) && (
        <div className="h-7 border-b px-4 flex items-center gap-2 text-[11px] bg-muted/40">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {aiLoading && <span>{aiAnalyzeLoading ? "AI-анализ" : "AI-конвертация"} выполняется…</span>}
          {aiAnalyzeOk && !aiLoading && (
            <span>
              AI-анализ: {aiAnalyzeData!.items.length} элементов, стиль {aiAnalyzeData!.detectedStyle}{" "}
              ({Math.round((aiAnalyzeData!.confidence ?? 0) * 100)}%).
              {aiAnalyzeData!.structureSummary && <> · {aiAnalyzeData!.structureSummary}</>}
            </span>
          )}
          {aiConvertData && !aiLoading && aiTargetStyle && (
            <span className="ml-2 text-primary">
              · Конвертация в <strong>{aiTargetStyle}</strong> применена.
            </span>
          )}
          {!aiLoading && aiError && (
            <button type="button" className="text-destructive underline-offset-2 hover:underline" onClick={() => setAiSetupOpen(true)}>
              AI недоступен: {aiError}
            </button>
          )}
        </div>
      )}

      {/* ── Import-by-link dialog ──────────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-xl" data-testid="dialog-import-link">
          <DialogHeader>
            <DialogTitle>Импорт документа по ссылке</DialogTitle>
            <DialogDescription>Поддерживаются публичные ссылки на DOCX/TXT/MD/HTML, Google Docs и Google Drive.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…" data-testid="input-import-link" />
            <p className="text-xs text-muted-foreground leading-snug">Для закрытых документов сначала откройте доступ по ссылке.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUrlImport} disabled={linkLoading}>{linkLoading ? "Загрузка…" : "Загрузить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Setup dialog ────────────────────────────────────────────────── */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-ai-setup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />Настройка AI-анализа
            </DialogTitle>
            <DialogDescription>AI-анализ использует Google Gemini для точного распознавания цитат и стилей.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[13px]">
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 space-y-1.5">
              <div className="font-semibold text-yellow-600 dark:text-yellow-400">Требуется GEMINI_API_KEY</div>
              <div className="text-muted-foreground leading-snug">
                Переменная окружения <code className="font-mono bg-muted px-1 rounded text-[12px]">GEMINI_API_KEY</code> не задана на сервере.
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="font-medium">Как активировать:</div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-snug">
                <li>Получите ключ на <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com/apikey</a></li>
                <li>Создайте файл <code className="font-mono bg-muted px-1 rounded text-[12px]">.env</code> в корне проекта</li>
                <li>Добавьте строку:<br /><code className="font-mono bg-muted px-1.5 py-1 rounded text-[12px] mt-1 block">GEMINI_API_KEY=AIza…ваш_ключ…</code></li>
                <li>Перезапустите сервер: <code className="font-mono bg-muted px-1 rounded text-[12px]">npm run dev</code></li>
              </ol>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setAiSetupOpen(false)}>Понятно</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside
          className="shrink-0 border-r bg-sidebar/60 flex flex-col min-h-0 overflow-hidden"
          style={{ width: sidebar.width }}
          data-testid="sidebar"
        >
          <nav className="p-2 space-y-0.5 shrink-0">
            {(Object.keys(PANEL_LABELS) as Panel[]).map((k) => {
              const Icon = PANEL_LABELS[k].icon;
              const active = panel === k;
              return (
                <button key={k} onClick={() => setPanel(k)} data-testid={`nav-${k}`}
                  className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover-elevate active-elevate-2 text-left ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{PANEL_LABELS[k].label}</span>
                  {k === "citations" && <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0">{found.length}</span>}
                  {k === "editor" && issues.length > 0 && <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0">{issues.length}</span>}
                </button>
              );
            })}
          </nav>

          {/* Demo document selector — relocated from header */}
          <div className="px-2 pt-1 pb-2 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1 px-1">Демо</div>
            <Select onValueChange={(v) => loadDemo(v as DemoId)}>
              <SelectTrigger className="h-8 w-full text-[12px]" data-testid="select-demo">
                <FlaskConical className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Загрузить документ…" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_DOCS.map((d) => (<SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="mt-3 px-3 pb-2 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5">Легенда</div>
            <div className="space-y-1">
              {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).map(([t, l]) => (
                <div key={t} className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                  <span className={`legend-dot ${legendDotClass(t)} shrink-0`} />
                  <span className="truncate">{l}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                <span className="legend-dot legend-dot-issue shrink-0" />
                <span className="truncate">Замечание редактуры</span>
              </div>
            </div>
          </div>
          <div className="mt-auto p-3 text-[11px] text-muted-foreground leading-snug border-t shrink-0">
            Прототип. Преобразования эвристические — проверяйте вручную.
          </div>
        </aside>

        {/* ── Sidebar resize handle ─────────────────────────────────────────── */}
        <div
          onMouseDown={sidebar.onMouseDown}
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          title="Потяните, чтобы изменить ширину"
        />

        {/* ── Workspace ─────────────────────────────────────────────────────── */}
        <main className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
          <section className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            <div className="h-10 border-b flex items-center px-4 gap-3 shrink-0 bg-muted/30">
              <AlignLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground font-medium">
                {preview ? `ПРЕДПРОСМОТР → ${preview.target}` : editMode ? "РЕДАКТИРОВАНИЕ" : "ПРОСМОТР"}
              </span>
              {warnings.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-warning ml-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warnings[0]}
                </div>
              )}
              {!preview && !editMode && (
                <Button variant="ghost" size="sm" className="ml-auto h-7 text-[12px]" onClick={() => setEditMode(true)} data-testid="button-edit">
                  <Pencil className="h-3.5 w-3.5 mr-1" />Редактировать
                </Button>
              )}
              {editMode && (
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" onClick={() => { setText(draft); setEditMode(false); setSelected(null); setPreview(null); setAiFound(null); toast({ title: "Изменения сохранены" }); }} data-testid="button-save-edit">
                    <Save className="h-3.5 w-3.5 mr-1" />Сохранить
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setDraft(text); setEditMode(false); }} data-testid="button-cancel-edit">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />Отменить
                  </Button>
                </div>
              )}
              {preview && (
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" onClick={applyConversion} data-testid="button-apply-preview">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Применить
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPreview(null)} data-testid="button-discard-preview">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />Отменить
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              {editMode ? (
                <RichEditor draft={draft} onChange={setDraft} />
              ) : (
                <DocumentView
                  text={currentText}
                  annotations={found}
                  issues={editMode ? [] : issues}
                  selected={selected}
                  hoveredId={hoveredId}
                  onAnnotationClick={(item) => { setSelected({ start: item.start, end: item.end }); setPanel("citations"); }}
                />
              )}
            </ScrollArea>
          </section>

          {/* ── Right panel resize handle ─────────────────────────────────── */}
          <div
            onMouseDown={rightPanel.onMouseDown}
            className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors border-l"
            title="Потяните, чтобы изменить ширину"
          />

          <section
            className="shrink-0 flex flex-col min-h-0 overflow-hidden"
            style={{ width: rightPanel.width }}
            data-testid="right-panel"
          >
            <div className="h-10 border-b flex items-center px-4 shrink-0 bg-muted/30">
              <Type className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <span className="text-[13px] text-muted-foreground font-medium uppercase tracking-wide truncate">{PANEL_LABELS[panel].label}</span>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {panel === "citations" && <CitationsPanel items={filteredFound} total={found.length}
                  search={search} setSearch={setSearch}
                  typeFilter={typeFilter} setTypeFilter={setTypeFilter}
                  onSelect={(item) => setSelected({ start: item.start, end: item.end })}
                  onHover={setHoveredId} />}
                {panel === "style" && <StylePanel detected={detected} />}
                {panel === "convert" && (
                  <ConvertPanel
                    detected={detected} text={text}
                    customRules={customRules} setCustomRules={setCustomRules}
                    previewActive={!!preview} applyPreview={applyConversion}
                    onDiscard={() => setPreview(null)}
                    onRun={(target, converted) => setPreview({ target, text: converted })}
                    aiLoading={aiConvertLoading}
                    convertScopes={convertScopes}
                    setConvertScopes={setConvertScopes}
                    onAiConvert={handleAiConvert}
                  />
                )}
                {panel === "structure" && <StructurePanel structure={structure} onJump={() => {}} />}
                {panel === "editor" && <EditorPanel issues={issues} onSelect={(i) => { setSelected({ start: i.start, end: i.end }); }} />}
                {panel === "stats" && <StatsPanel stats={stats} found={found} issues={issues} detected={detected} />}
              </div>
            </ScrollArea>
          </section>
        </main>
      </div>
    </div>
  );
}

// ── DocumentView ──────────────────────────────────────────────────────────────
function DocumentView({ text, annotations, issues, selected, hoveredId, onAnnotationClick }: {
  text: string;
  annotations: FoundItem[];
  issues: EditorIssue[];
  selected: { start: number; end: number } | null;
  hoveredId: string | null;
  onAnnotationClick: (item: FoundItem) => void;
}) {
  type Ann = { id: string; start: number; end: number; kind: "citation" | "issue"; type: string };
  type Seg = { text: string; ann: Ann | null; isSelected: boolean };

  const merged: Ann[] = useMemo(() => [
    ...annotations.map((a) => ({ id: a.id, start: a.start, end: a.end, kind: "citation" as const, type: a.type })),
    ...issues.map((i) => ({ id: i.id, start: i.start, end: i.end, kind: "issue" as const, type: i.type })),
  ].sort((a, b) => a.start - b.start), [annotations, issues]);

  const segments: Seg[] = useMemo(() => {
    const segs: Seg[] = [];
    let cursor = 0;
    for (