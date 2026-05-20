import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
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
  "длинное-предложение":     "Длинное предложение",
  "пассив":                  "Пассивная конструкция",
  "разговорный-маркер":      "Разговорный оборот",
  "слабая-формулировка":     "Слабая формулировка",
  "повтор":                  "Повтор",
  "неопределённый-указатель":"Неопределённый указатель",
  "пунктуация":              "Пунктуация",
  "канцеляризм":             "Канцеляризм",
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
  const [aiSetupOpen, setAiSetupOpen]   = useState(false);
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
      if (result.error.includes("OPENAI_API_KEY") || result.error.includes("501") || result.error.includes("не задан")) {
        setAiSetupOpen(true);
      } else {
        toast({ title: "AI недоступен", description: result.error, variant: "destructive" });
      }
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
    setPreview(null); setSelected(null); setAiFound(null);
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
      setPreview(null); setSelected(null); setLinkDialogOpen(false); setLinkUrl(""); setAiFound(null);
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
    setPreview(null); setSelected(null); setSearch(""); setTypeFilter("all"); setWarnings([]); setAiFound(null);
  }

  function applyConversion() {
    if (!preview) return;
    const t = preview.target;
    setText(preview.text); setDraft(preview.text); setPreview(null); setAiFound(null);
    toast({ title: "Конвертация применена", description: `Документ переформатирован в ${t}.` });
  }

  const currentText = preview?.text ?? text;

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
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} data-testid="button-cancel-link">Отмена</Button>
            <Button onClick={handleUrlImport} disabled={linkLoading} data-testid="button-load-link">{linkLoading ? "Загрузка…" : "Загрузить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Setup dialog ────────────────────────────────────────────────── */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-ai-setup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Настройка AI-анализа
            </DialogTitle>
            <DialogDescription>
              AI-анализ использует OpenAI GPT-4o для точного распознавания цитат и стилей.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[13px]">
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 space-y-1.5">
              <div className="font-semibold text-yellow-600 dark:text-yellow-400">Требуется OPENAI_API_KEY</div>
              <div className="text-muted-foreground leading-snug">
                Переменная окружения <code className="font-mono bg-muted px-1 rounded text-[12px]">OPENAI_API_KEY</code> не задана на сервере.
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="font-medium">Как активировать:</div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-snug">
                <li>Получите ключ на <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">platform.openai.com/api-keys</a></li>
                <li>Создайте файл <code className="font-mono bg-muted px-1 rounded text-[12px]">.env</code> в корне проекта</li>
                <li>Добавьте строку:<br /><code className="font-mono bg-muted px-1.5 py-1 rounded text-[12px] mt-1 block">OPENAI_API_KEY=sk-…ваш_ключ…</code></li>
                <li>Перезапустите сервер: <code className="font-mono bg-muted px-1 rounded text-[12px]">npm run dev</code></li>
              </ol>
            </div>
            <div className="rounded-md border p-3 bg-muted/20 text-[12px] text-muted-foreground">
              <span className="font-medium">Без ключа</span> — работает эвристический анализ. AI добавляет точность распознавания стилей и полей библиографии.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAiSetupOpen(false)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
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
                <span className="legend-dot legend-dot-issue" />
                Замечание редактуры
              </div>
            </div>
          </div>
          <div className="mt-auto p-3 text-[11px] text-muted-foreground leading-snug border-t">
            Прототип. Преобразования эвристические — проверяйте вручную.
          </div>
        </aside>

        {/* ── Workspace ─────────────────────────────────────────────────────── */}
        <main className="flex flex-1 min-w-0 min-h-0 divide-x">
          <section className="flex flex-col flex-1 min-w-0 min-h-0">
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
            <ScrollArea className="flex-1">
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

          <section className="w-[360px] shrink-0 flex flex-col min-h-0" data-testid="right-panel">
            <div className="h-10 border-b flex items-center px-4 shrink-0 bg-muted/30">
              <Type className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-[13px] text-muted-foreground font-medium uppercase tracking-wide">{PANEL_LABELS[panel].label}</span>
            </div>
            <ScrollArea className="flex-1">
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
    for (const ann of merged) {
      if (ann.start > cursor) segs.push({ text: text.slice(cursor, ann.start), ann: null, isSelected: false });
      if (ann.end > ann.start) {
        segs.push({ text: text.slice(ann.start, ann.end), ann, isSelected: !!selected && selected.start === ann.start && selected.end === ann.end });
      }
      cursor = Math.max(cursor, ann.end);
    }
    if (cursor < text.length) segs.push({ text: text.slice(cursor), ann: null, isSelected: false });
    return segs;
  }, [text, merged, selected]);

  const paragraphs: Seg[][] = useMemo(() => {
    const result: Seg[][] = [];
    let current: Seg[] = [];
    for (const seg of segments) {
      for (const part of seg.text.split(/(\n)/)) {
        if (part === "\n") { result.push(current); current = []; }
        else if (part) current.push({ ...seg, text: part });
      }
    }
    if (current.length) result.push(current);
    return result;
  }, [segments]);

  return (
    <div className="p-6 font-serif text-[14.5px] leading-[1.85] text-foreground/90 max-w-3xl mx-auto" data-testid="document-view">
      {paragraphs.map((para, pi) => (
        <p key={pi} className="mb-[0.6em]">
          {para.map((seg, si) => {
            if (!seg.ann) return <span key={si}>{seg.text}</span>;
            const cls = annotationCSSClass(seg.ann.kind, seg.ann.type);
            return (
              <mark key={si}
                className={`${cls} cursor-pointer rounded-[2px] px-[1px] transition-all ${
                  seg.isSelected ? "ring-2 ring-primary/60" : ""
                } ${hoveredId === seg.ann.id ? "brightness-90" : ""}`}
                onClick={() => seg.ann && onAnnotationClick(seg.ann as unknown as FoundItem)}
                title={seg.ann.type}>
                {seg.text}
              </mark>
            );
          })}
        </p>
      ))}
    </div>
  );
}

// ── RichEditor ────────────────────────────────────────────────────────────────
function RichEditor({ draft, onChange }: { draft: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastDraft = useRef(draft);

  useEffect(() => {
    if (ref.current && draft !== lastDraft.current) {
      ref.current.innerHTML = draftToHtml(draft);
      lastDraft.current = draft;
    }
  }, [draft]);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = draftToHtml(draft);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInput() {
    if (!ref.current) return;
    const plain = htmlToPlain(ref.current.innerHTML);
    lastDraft.current = plain;
    onChange(plain);
  }

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    ref.current?.focus();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 flex-wrap">
        {([
          { icon: Bold,          cmd: "bold",      title: "Жирный (Ctrl+B)" },
          { icon: Italic,        cmd: "italic",    title: "Курсив (Ctrl+I)" },
          { icon: UnderlineIcon, cmd: "underline", title: "Подчёркнутый (Ctrl+U)" },
        ] as { icon: typeof Bold; cmd: string; title: string }[]).map(({ icon: Icon, cmd, title }) => (
          <button key={cmd} type="button" title={title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
            className="p-1.5 rounded hover:bg-accent text-foreground/70">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="w-px h-5 bg-border mx-0.5" />
        <button type="button" title="Маркированный список"
          onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
          className="p-1.5 rounded hover:bg-accent text-foreground/70">
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Нумерованный список"
          onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 font-mono font-bold text-[11px] w-6 h-6 flex items-center justify-center leading-none">
          1.
        </button>
        <span className="w-px h-5 bg-border mx-0.5" />
        <button type="button" title="Заголовок (H2)"
          onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", "<h2>"); }}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 font-bold text-[11px] w-6 h-6 flex items-center justify-center leading-none">
          H
        </button>
        <button type="button" title="Обычный абзац"
          onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", "<div>"); }}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 text-[11px] w-6 h-6 flex items-center justify-center leading-none">
          ¶
        </button>
        <span className="w-px h-5 bg-border mx-0.5" />
        <button type="button" title="Очистить форматирование"
          onMouseDown={(e) => { e.preventDefault(); execCmd("removeFormat"); }}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 font-mono text-[10px] px-1.5">
          Aa
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        spellCheck
        className="flex-1 p-6 font-serif text-[14.5px] leading-[1.85] outline-none overflow-auto rich-editor"
        data-testid="rich-editor"
      />
    </div>
  );
}

function draftToHtml(plain: string): string {
  return plain.split("\n").map((line) => `<div>${escHtml(line) || "<br>"}</div>`).join("");
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<div><br><\/div>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Panel helpers ─────────────────────────────────────────────────────────────
function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</div>}
    </div>
  );
}

function CitationsPanel({ items, total, search, setSearch, typeFilter, setTypeFilter, onSelect, onHover }: {
  items: FoundItem[]; total: number; search: string; setSearch: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  onSelect: (item: FoundItem) => void; onHover: (id: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <PanelHeader title="Цитаты и сноски" hint={`Найдено: ${total}. Нажмите на элемент, чтобы выделить его в тексте.`} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…" className="pl-8 h-8 text-[13px]" data-testid="input-search-citations" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[130px] text-[12px]" data-testid="select-filter-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {(Object.entries(TYPE_LABELS) as [FoundItem["type"], string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {items.length === 0 ? (
        <div className="text-[13px] text-muted-foreground text-center py-8">Ничего не найдено.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)} onMouseEnter={() => onHover(item.id)} onMouseLeave={() => onHover(null)}
              className="w-full text-left rounded-md border px-3 py-2 text-[12.5px] hover:bg-accent/50 transition-colors" data-testid="citation-item">
              <div className="flex items-center gap-2 mb-1">
                <span className={`legend-dot ${legendDotClass(item.type)} shrink-0`} />
                <span className="font-medium text-[11px] uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[item.type]}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">стр. {item.line}</span>
              </div>
              <div className="text-foreground/80 leading-snug line-clamp-2">{item.text}</div>
              {item.note && <div className="text-muted-foreground text-[11px] mt-0.5">{item.note}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StylePanel({ detected }: { detected: ReturnType<typeof detectStyle> }) {
  return (
    <div className="space-y-4">
      <PanelHeader title="Стиль цитирования" hint="Автоматическое определение стиля по образцам." />
      <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">{detected.style}</span>
          <Badge variant={detected.confidence > 0.6 ? "default" : "secondary"} className="text-[10px]">
            {Math.round(detected.confidence * 100)}%
          </Badge>
        </div>
        <div className="space-y-2">
          {detected.scores.slice(0, 5).map(({ style, score }) => (
            <Score key={style} label={style} value={score} />
          ))}
        </div>
        {detected.notes.length > 0 && (
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
            {detected.notes.map((n, i) => <div key={i}>• {n}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] w-20 shrink-0 text-foreground/75">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ConvertPanel({ detected, onRun, text, customRules, setCustomRules, previewActive, applyPreview, onDiscard }: {
  detected: ReturnType<typeof detectStyle>; onRun: (target: CitationStyle, converted: string) => void;
  text: string; customRules: CustomCitationRules; setCustomRules: (r: CustomCitationRules) => void;
  previewActive: boolean; applyPreview: () => void; onDiscard: () => void;
}) {
  const [target, setTarget] = useState<CitationStyle>("APA");
  const result = useMemo(() => {
    try {
      return convertCitations(text, target, customRules);
    } catch {
      return { text, converted: 0, warnings: ["Ошибка при конвертации. Проверьте формат документа."] };
    }
  }, [text, target, customRules]);

  return (
    <div className="space-y-4">
      <PanelHeader title="Конвертация стиля" hint={`Обнаружен стиль: ${detected.style}. Выберите целевой формат.`} />
      <div className="space-y-1.5">
        <Label className="text-[12px]">Целевой стиль</Label>
        <Select value={target} onValueChange={(v) => setTarget(v as CitationStyle)}>
          <SelectTrigger className="h-9" data-testid="select-target-style"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["APA", "Chicago", "MLA", "IEEE", "Vancouver", "Harvard", "GOST", "Custom"] as CitationStyle[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {target === "Custom" && (
        <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
          <div className="text-[12px] font-medium mb-1">Пользовательский стиль</div>
          {[
            { label: "Название", key: "name" },
            { label: "Шаблон вставки", key: "inlineTemplate" },
            { label: "Шаблон библиографии", key: "bibliographyTemplate" },
            { label: "Шаблон сноски", key: "footnoteTemplate" },
            { label: "Разделитель", key: "separator" },
          ].map(({ label, key }) => (
            <div key={key} className="space-y-0.5">
              <Label className="text-[11px] text-muted-foreground">{label}</Label>
              <Input value={(customRules as Record<string, string>)[key]} onChange={(e) => setCustomRules({ ...customRules, [key]: e.target.value })}
                className="h-7 text-[12px] font-mono" />
            </div>
          ))}
          <div className="space-y-0.5">
            <Label className="text-[11px] text-muted-foreground">Режим</Label>
            <Select value={customRules.mode} onValueChange={(v) => setCustomRules({ ...customRules, mode: v as CustomCitationRules["mode"] })}>
              <SelectTrigger className="h-7 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="author-date">Автор-год</SelectItem>
                <SelectItem value="numeric">Числовой</SelectItem>
                <SelectItem value="footnote">Сноски</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="rounded-md border p-3 bg-muted/10 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium">Статус конвертации</span>
          <Badge variant="outline" className="text-[10px]">{result.converted} изменений</Badge>
        </div>
        {result.converted === 0 && target === detected.style && (
          <div className="text-[11px] text-muted-foreground">ℹ Документ уже в формате {target} — конвертация не требуется.</div>
        )}
        {result.converted === 0 && target !== detected.style && (
          <div className="text-[11px] text-muted-foreground">ℹ Конвертер не нашёл цитат, подходящих под заданный шаблон. Попробуйте другой стиль или документ.</div>
        )}
        {result.warnings.length > 0 && result.converted > 0 && (
          <div className="text-[11px] text-warning space-y-0.5">
            {result.warnings.slice(0, 3).map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
      </div>
      {previewActive ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={applyPreview} data-testid="button-apply-convert">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Применить
          </Button>
          <Button variant="outline" size="sm" onClick={onDiscard} data-testid="button-discard-convert">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />Отменить
          </Button>
        </div>
      ) : (
        <Button className="w-full" size="sm" onClick={() => onRun(target, result.text)} data-testid="button-run-convert">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Предпросмотр конвертации
        </Button>
      )}
      <Separator />
      <SourceTypeBuilder />
    </div>
  );
}

function StructurePanel({ structure, onJump }: { structure: ReturnType<typeof analyzeStructure>; onJump: (line: number) => void }) {
  return (
    <div className="space-y-3">
      <PanelHeader title="Структура документа" hint="Разделы и аннотированные блоки." />
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Параграфов", value: structure.paragraphs },
          { label: "Разделов", value: structure.sections.length },
          { label: "Сносок", value: structure.footnoteCount },
          { label: "Библ. записей", value: structure.bibCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border px-3 py-2 bg-muted/20 text-center">
            <div className="text-[18px] font-semibold tabular-nums">{value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {structure.sections.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Разделы</div>
          {structure.sections.map((s, i) => (
            <button key={i} onClick={() => onJump(s.line)}
              className="w-full text-left text-[12.5px] px-2 py-1.5 rounded hover:bg-accent/50 flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10px] w-6 shrink-0">{s.line}</span>
              <span className="truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-[12.5px] text-foreground/75">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EditorPanel({ issues, onSelect }: { issues: EditorIssue[]; onSelect: (i: EditorIssue) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);
  return (
    <div className="space-y-3">
      <PanelHeader title="Редактура" hint="Автоматические стилистические замечания." />
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все ({issues.length})</SelectItem>
          {(Object.entries(ISSUE_LABELS) as [EditorIssue["type"], string][]).map(([k, v]) => {
            const cnt = issues.filter((i) => i.type === k).length;
            return cnt > 0 ? <SelectItem key={k} value={k}>{v} ({cnt})</SelectItem> : null;
          })}
        </SelectContent>
      </Select>
      {filtered.length === 0 ? (
        <div className="text-[13px] text-muted-foreground text-center py-8">Замечаний не обнаружено.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((issue) => (
            <button key={issue.id} onClick={() => onSelect(issue)}
              className="w-full text-left rounded-md border px-3 py-2 text-[12.5px] hover:bg-accent/50 transition-colors" data-testid="issue-item">
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                <span className="font-medium text-[11px] uppercase tracking-wide text-muted-foreground">{ISSUE_LABELS[issue.type]}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">стр. {issue.line}</span>
              </div>
              <div className="text-foreground/80 leading-snug line-clamp-2">{issue.text}</div>
              {issue.suggestion && <div className="text-primary/70 text-[11px] mt-0.5">→ {issue.suggestion}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsPanel({ stats, found, issues, detected }: {
  stats: { words: number; charsWithSpaces: number; charsNoSpaces: number; paragraphs: number; lines: number; readingMinutes: number };
  found: FoundItem[]; issues: EditorIssue[]; detected: ReturnType<typeof detectStyle>;
}) {
  return (
    <div className="space-y-4">
      <PanelHeader title="Статистика документа" />
      <div className="space-y-0">
        <Metric label="Слов"                value={stats.words.toLocaleString("ru")} />
        <Metric label="Знаков (с пробелами)" value={stats.charsWithSpaces.toLocaleString("ru")} />
        <Metric label="Знаков (без пробелов)" value={stats.charsNoSpaces.toLocaleString("ru")} />
        <Metric label="Параграфов"          value={stats.paragraphs} />
        <Metric label="Строк"               value={stats.lines} />
        <Metric label="Время чтения"        value={`~${stats.readingMinutes} мин.`} />
        <Metric label="Цитат и сносок"        value={found.length} />
        <Metric label="Замечаний редактуры"  value={issues.length} />
        <Metric label="Определённый стиль"   value={detected.style} />
      </div>
    </div>
  );
}

function SourceTypeBuilder() {
  const [selectedType, setSelectedType] = useState<string>(DEFAULT_SOURCE_TYPES[0].id);
  const [fields, setFields] = useState<Record<string, string>>({});
  const template = DEFAULT_SOURCE_TYPES.find((t) => t.id === selectedType) as SourceTypeTemplate | undefined;
  const previewText = template ? renderSourceTemplate(template, fields) : "";
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-semibold text-foreground">Конструктор источника</div>
      <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setFields({}); }}>
        <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
        <SelectContent>{DEFAULT_SOURCE_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      {template && (
        <div className="space-y-1.5">
          {template.fields.map((field) => (
            <div key={field} className="space-y-0.5">
              <Label className="text-[11px] text-muted-foreground">{SOURCE_TYPE_FIELD_LABELS[field] ?? field}</Label>
              <Input value={fields[field] ?? ""} onChange={(e) => setFields((prev) => ({ ...prev, [field]: e.target.value }))}
                className="h-7 text-[12px]" placeholder={SOURCE_TYPE_FIELD_LABELS[field] ?? field} />
            </div>
          ))}
          {previewText && (
            <div className="rounded-md border p-2.5 bg-muted/20 mt-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Предпросмотр APA</div>
              <div className="text-[12.5px] font-serif leading-snug">{previewText}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
