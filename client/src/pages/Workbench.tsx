import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, Filter, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAiAnalyze, mergeFoundItems } from "@/lib/aiAnalyze";

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

/** CSS class per annotation type — uses the named classes defined in index.css */
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

/** Dot colour class for the legend */
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
  "длинное-предложение":     "Длинное предложение",
  "пассив":                  "Пассивная конструкция",
  "разговорный-маркер":      "Разговорный оборот",
  "слабая-формулировка":     "Слабая формулировка",
  "повтор":                  "Повтор",
  "неопределённый-указатель":"Неопределённый указатель",
  "пунктуация":              "Пунктуация",
  "канцелярит":              "Канцелярит",
};

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
  const { analyze: runAiAnalysis, loading: aiLoading } = useAiAnalyze();
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

  async function handleAiAnalyze() {
    if (!text.trim()) return;
    const result = await runAiAnalysis({ text, language: structure.language });
    if (result && result.items?.length) {
      setAiFound(result.items as FoundItem[]);
      toast({
        title: "AI-анализ завершён",
        description: result.summary || `Найдено ${result.items.length} элементов (уверенность ${Math.round((result.confidence ?? 0) * 100)}%).`,
      });
    } else if (result?.error) {
      toast({ title: "AI недоступен", description: result.error, variant: "destructive" });
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
    setWarnings(imported.warnings);
    setPreview(null);
    setSelected(null);
    setAiFound(null);
  }

  async function handleUrlImport() {
    if (!linkUrl.trim()) return;
    setLinkLoading(true);
    try {
      const res = await apiRequest("POST", "/api/import-url", { url: linkUrl });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Ошибка импорта", description: data.message ?? "Неизвестная ошибка.", variant: "destructive" }); return; }
      setDocName(data.name ?? "документ.txt");
      setText(data.text ?? "");
      setWarnings(data.warnings ?? []);
      setPreview(null); setSelected(null); setLinkDialogOpen(false); setLinkUrl(""); setAiFound(null);
      if (data.warnings?.length) toast({ title: "Импорт завершён с предупреждениями", description: data.warnings[0] });
    } catch (err) {
      toast({ title: "Ошибка сети", description: String(err), variant: "destructive" });
    } finally { setLinkLoading(false); }
  }

  function loadDemo(id: DemoId) {
    const doc = DEMO_DOCS.find((d) => d.id === id);
    if (!doc) return;
    setText(doc.text);
    setDocName(doc.label + ".txt");
    setPreview(null); setSelected(null); setSearch(""); setTypeFilter("all"); setWarnings([]); setAiFound(null);
  }

  async function handleExport() {
    const blob = await exportDocument(text, docName, exportFormat);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = docName.replace(/\.[^.]+$/, "") + "." + exportFormat;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleDriveExport() {
    setDriveLoading(true);
    try {
      const res = await apiRequest("POST", "/api/export-drive", { text, docName, format: exportFormat });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Ошибка экспорта", description: data.message ?? "Неизвестная ошибка.", variant: "destructive" }); return; }
      toast({ title: "Экспорт в Drive", description: data.message ?? "Файл загружен." });
    } catch (err) {
      toast({ title: "Ошибка сети", description: String(err), variant: "destructive" });
    } finally { setDriveLoading(false); }
  }

  function applyConversion() {
    if (!preview) return;
    setText(preview.text);
    setPreview(null);
    setAiFound(null);
    toast({ title: "Конвертация применена", description: `Документ переформатирован в ${preview.target}.` });
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground" data-testid="workbench">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
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
          <Button variant="outline" size="sm" onClick={handleAiAnalyze} disabled={aiLoading || !text.trim()} data-testid="button-ai-analyze"
            title="Анализ цитирования через AI (OpenAI GPT-4o). Требует OPENAI_API_KEY.">
            <Sparkles className="h-4 w-4 mr-1.5" />{aiLoading ? "AI…" : "AI-анализ"}
          </Button>
          <Select onValueChange={(v) => loadDemo(v as DemoId)}>
            <SelectTrigger className="h-9 w-[180px]" data-testid="select-demo"><SelectValue placeholder="Демо-документ" /></SelectTrigger>
            <SelectContent>{DEMO_DOCS.map((d) => (<SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>))}</SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── Import-by-link dialog ──────────────────────────────────────────────── */}
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
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} data-testid="button-cancel-link">Отмена</Button>
            <Button onClick={handleUrlImport} disabled={linkLoading} data-testid="button-load-link">{linkLoading ? "Загрузка…" : "Загрузить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 border-r bg-sidebar/60 flex flex-col" data-testid="sidebar">
          <nav className="p-2 space-y-0.5">
            {(Object.keys(PANEL_LABELS) as Panel[]).map((k) => {
              const Icon = PANEL_LABELS[k].icon;
              const active = panel === k;
              return (
                <button key={k} onClick={() => setPanel(k)} data-testid={`nav-${k}`}
                  className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover-elevate active-elevate-2 text-left ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
                  }`}>
                  <Icon className="h-4 w-4" />
                  {PANEL_LABELS[k].label}
                  {k === "citations" && <span className="ml-auto text-[10px] font-mono text-muted-foreground">{found.length}</span>}
                  {k === "editor" && issues.length > 0 && <span className="ml-auto text-[10px] font-mono text-muted-foreground">{issues.length}</span>}
                </button>
              );
            })}
          </nav>
          {/* Annotation legend */}
          <div className="mt-4 px-3 pb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5">Легенда</div>
            <div className="space-y-1">
              {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).map(([t, l]) => (
                <div key={t} className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                  <span className={`legend-dot ${legendDotClass(t)}`} />
                  {l}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                <span className="legend-dot legend-dot-issue" style={{ background: "hsl(22 90% 52%)" }} />
                Замечание редактуры
              </div>
            </div>
          </div>
          <div className="mt-auto p-3 text-[11px] text-muted-foreground leading-snug border-t">
            Прототип. Преобразования эвристические — проверяйте вручную.
          </div>
        </aside>

        {/* ── Workspace ────────────────────────────────────────────────────── */}
