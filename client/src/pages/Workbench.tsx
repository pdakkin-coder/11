import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, Filter, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List,
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

  const found     = useMemo(() => findCitations(text), [text]);
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
    toast({ title: "Документ загружен", description: imported.name });
  }

  async function handleUrlImport() {
    const url = linkUrl.trim();
    if (!url) {
      toast({ title: "Нужна ссылка", description: "Вставьте публичную ссылку." });
      return;
    }
    setLinkLoading(true);
    try {
      const res = await apiRequest("POST", "/api/import-url", { url });
      const imported = await res.json() as { name: string; text: string; warnings?: string[] };
      if (!imported.text) throw new Error("Документ пуст или недоступен.");
      setDocName(imported.name);
      setText(imported.text);
      setWarnings(imported.warnings ?? []);
      setPreview(null);
      setSelected(null);
      setLinkDialogOpen(false);
      setLinkUrl("");
      toast({ title: "Документ загружен по ссылке", description: imported.name });
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
    try {
      await exportDocument(currentText, docName, exportFormat);
      toast({ title: "Файл подготовлен", description: `Экспорт в ${exportFormat.toUpperCase()} запущен.` });
    } catch (error) {
      toast({
        title: "Экспорт не удался",
        description: error instanceof Error ? error.message : "Попробуйте другой формат.",
      });
    }
  }

  async function handleDriveExport() {
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

  function loadDemo(which: DemoId) {
    const demo = DEMO_DOCS.find((d) => d.id === which);
    if (!demo) return;
    setText(demo.text);
    setDocName(demo.title + ".txt");
    setWarnings([]);
    setPreview(null);
    setSelected(null);
    setEditMode(false);
    toast({ title: "Демо-документ загружен", description: demo.label });
  }

  function runConvert(target: CitationStyle) {
    const result = convertCitations(text, target, customRules);
    setPreview({ target, text: result.preview });
    toast({
      title: `Предпросмотр преобразования → ${target}`,
      description: `Найдено изменений: ${result.changes.length}. Просмотрите и примените.`,
    });
  }

  function applyPreview() {
    if (!preview) return;
    setText(preview.text);
    setPreview(null);
    toast({ title: "Изменения применены", description: "Документ обновлён согласно предпросмотру." });
  }

  const currentText = preview?.text ?? text;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground" data-testid="app-root">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-14 border-b bg-sidebar min-w-0" data-testid="topbar">
        <div className="flex items-center gap-2.5 text-primary shrink-0">
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
          <Select onValueChange={(v) => loadDemo(v as DemoId)}>
            <SelectTrigger className="h-9 w-[180px]" data-testid="select-demo"><SelectValue placeholder="Демо-документ" /></SelectTrigger>
            <SelectContent>{DEMO_DOCS.map((d) => (<SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>))}</SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── Import-by-link dialog ─────────────────────────────────────────── */}
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
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
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
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 px-4 h-11 border-b bg-card/40" data-testid="document-toolbar">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {preview ? `ПРЕДПРОСМОТР → ${preview.target}` : editMode ? "РЕДАКТИРОВАНИЕ" : "ПРОСМОТР"}
            </Badge>
            {preview && (
              <>
                <Button size="sm" onClick={applyPreview} data-testid="button-apply">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />Применить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreview(null)} data-testid="button-discard">Отменить</Button>
              </>
            )}
            {!preview && !editMode && (
              <Button size="sm" variant="outline" onClick={() => { setDraft(text); setEditMode(true); setSelected(null); }} data-testid="button-edit">
                <Pencil className="h-4 w-4 mr-1.5" />Редактировать
              </Button>
            )}
            {editMode && (
              <>
                <Button size="sm" onClick={() => { setText(draft); setEditMode(false); setSelected(null); setPreview(null); toast({ title: "Изменения сохранены" }); }} data-testid="button-save-edit">
                  <Save className="h-4 w-4 mr-1.5" />Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDraft(text); setEditMode(false); }} data-testid="button-cancel-edit">
                  <RotateCcw className="h-4 w-4 mr-1.5" />Сбросить
                </Button>
              </>
            )}
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1"><Type className="h-3.5 w-3.5" />{stats.words} слов</span>
              <span className="inline-flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5" />{stats.paragraphs} абз.</span>
              <span>≈ {stats.readingMinutes} мин чтения</span>
            </div>
          </div>

          {editMode ? (
            <RichEditor draft={draft} onChange={setDraft} />
          ) : (
            <DocumentView
              text={currentText}
              selected={selected}
              annotations={found}
              issues={issues}
              hoveredId={hoveredId}
              onAnnotationClick={(it) => setSelected({ start: it.start, end: it.end })}
            />
          )}

          {warnings.length > 0 && (
            <div className="border-t bg-secondary/40 px-4 py-2 text-xs text-muted-foreground flex items-start gap-2" data-testid="warnings">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--chart-2))]" />
              <div className="space-y-0.5">{warnings.map((w, i) => <div key={i}>{w}</div>)}</div>
            </div>
          )}
        </main>

        {/* ── Inspector ────────────────────────────────────────────────────── */}
        <aside className="w-[380px] shrink-0 border-l flex flex-col bg-card/30" data-testid="inspector">
          {panel === "citations" && (
            <CitationsPanel items={filteredFound} total={found.length}
              search={search} setSearch={setSearch}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              onSelect={(it) => setSelected({ start: it.start, end: it.end })}
              onHover={setHoveredId}
            />
          )}
          {panel === "style"   && <StylePanel detected={detected} />}
          {panel === "convert" && (
            <ConvertPanel detected={detected.style} onRun={runConvert} text={text}
              customRules={customRules} setCustomRules={setCustomRules}
              previewActive={!!preview} applyPreview={applyPreview}
              onDiscard={() => setPreview(null)}
            />
          )}
          {panel === "structure" && (
            <StructurePanel structure={structure} onJump={(line) => {
              const lines = text.split("\n");
              let pos = 0;
              for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
              setSelected({ start: pos, end: pos + (lines[line - 1]?.length ?? 0) });
            }} />
          )}
          {panel === "editor" && (
            <EditorPanel issues={issues} onSelect={(i) => setSelected({ start: i.start, end: i.end })} />
          )}
          {panel === "stats" && <StatsPanel stats={stats} found={found} issues={issues} detected={detected} />}
        </aside>
      </div>
    </div>
  );
}

// ─── Document view ──────────────────────────────────────────────────────────

interface Annotation {
  start: number; end: number;
  kind: "citation" | "issue";
  type: string; id: string; note?: string; label: string;
}

function DocumentView({
  text, selected, annotations, issues, hoveredId, onAnnotationClick,
}: {
  text: string;
  selected: { start: number; end: number } | null;
  annotations: FoundItem[];
  issues: EditorIssue[];
  hoveredId: string | null;
  onAnnotationClick: (it: FoundItem) => void;
}) {
  const merged: Annotation[] = useMemo(() => {
    const all: Annotation[] = [
      ...annotations.map(f => ({ start: f.start, end: f.end, kind: "citation" as const, type: f.type, id: f.id, note: f.note, label: f.type })),
      ...issues.map(i     => ({ start: i.start, end: i.end, kind: "issue"    as const, type: i.type, id: i.id, note: i.suggestion, label: i.type })),
    ];
    all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const cleaned: Annotation[] = [];
    let lastEnd = -1;
    for (const a of all) { if (a.start >= lastEnd) { cleaned.push(a); lastEnd = a.end; } }
    return cleaned;
  }, [annotations, issues]);

  type Seg = { start: number; end: number; ann?: Annotation };
  const segments: Seg[] = useMemo(() => {
    const segs: Seg[] = [];
    let cursor = 0;
    for (const a of merged) {
      if (a.start > cursor) segs.push({ start: cursor, end: a.start });
      segs.push({ start: a.start, end: a.end, ann: a });
      cursor = a.end;
    }
    if (cursor < text.length) segs.push({ start: cursor, end: text.length });
    return segs;
  }, [merged, text.length]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-[78ch] px-10 py-10 font-serif text-[16px] leading-[1.85] text-foreground/90" data-testid="document-view">
        <DocumentBlocks text={text} segments={segments} selected={selected} hoveredId={hoveredId}
          onAnnotationClick={(ann) => { const it = annotations.find(x => x.id === ann.id); if (it) onAnnotationClick(it); }}
        />
      </div>
    </ScrollArea>
  );
}

function DocumentBlocks({ text, segments, selected, hoveredId, onAnnotationClick }: {
  text: string;
  segments: { start: number; end: number; ann?: Annotation }[];
  selected: { start: number; end: number } | null;
  hoveredId: string | null;
  onAnnotationClick: (ann: Annotation) => void;
}) {
  const paragraphs = useMemo(() => {
    const out: { start: number; end: number; text: string }[] = [];
    const re = /[^\n]+(?:\n[^\n]+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    return out;
  }, [text]);

  return (
    <>
      {paragraphs.map((p, i) => {
        const trimmed = p.text.trim();
        const isHeading = trimmed.length > 0 && trimmed.length < 90 && !/[.!?:]$/.test(trimmed) && /^[A-ZА-ЯЁ]/u.test(trimmed);
        const inside = segments
          .map(s => ({ ...s, start: Math.max(s.start, p.start), end: Math.min(s.end, p.end) }))
          .filter(s => s.end > s.start);

        const content = inside.map((s, j) => {
          const segText = text.slice(s.start, s.end);
          const isSelected = !!selected && s.start >= selected.start && s.end <= selected.end;
          if (!s.ann) {
            return (
              <span key={j}
                className={isSelected ? "bg-primary/30 ring-1 ring-primary/50 rounded-sm" : undefined}
                ref={isSelected ? (el) => el?.scrollIntoView({ block: "center", behavior: "smooth" }) : undefined}
              >{segText}</span>
            );
          }
          const ann = s.ann;
          const isHovered  = hoveredId === ann.id;
          const isFocused  = isSelected;
          return (
            <span key={j}
              role="button" tabIndex={0}
              title={ann.note || ann.label}
              data-testid={`annotation-${ann.id}`}
              onClick={() => onAnnotationClick(ann)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAnnotationClick(ann); } }}
              ref={isFocused ? (el) => el?.scrollIntoView({ block: "center", behavior: "smooth" }) : undefined}
              className={[
                annotationCSSClass(ann.kind, ann.type),
                isHovered ? "ann-focused" : "",
                isFocused ? "ann-selected" : "",
              ].filter(Boolean).join(" ")}
            >{segText}</span>
          );
        });

        if (isHeading) {
          return <h2 key={i} className="font-sans text-[20px] font-semibold tracking-tight mt-7 mb-3 text-foreground">{content}</h2>;
        }
        return <p key={i} className="mb-4 whitespace-pre-wrap">{content}</p>;
      })}
    </>
  );
}

// ─── Rich text editor ────────────────────────────────────────────────────────
// Uses a contenteditable div so formatted text (bold, italic, headings) is
// preserved. The serialised plain text is extracted on Save and fed back into
// the analysis pipeline.

function RichEditor({ draft, onChange }: { draft: string; onChange: (v: string) => void }) {
  const editorRef  = useRef<HTMLDivElement | null>(null);
  const skipEffect = useRef(false);

  // Initialise once
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Only set innerHTML on first mount to avoid cursor-jump on every keystroke
    if (el.innerHTML === "" || el.dataset.initialised !== "1") {
      el.innerHTML = draftToHtml(draft);
      el.dataset.initialised = "1";
    }
    el.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    skipEffect.current = true;
    // Serialise back to plain text (preserving newlines)
    onChange(htmlToPlain(el.innerHTML));
  }, [onChange]);

  function execCmd(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-card/60">
        <button title="Жирный" onClick={() => execCmd("bold")}
          className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="Bold">
          <Bold className="h-4 w-4" />
        </button>
        <button title="Курсив" onClick={() => execCmd("italic")}
          className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="Italic">
          <Italic className="h-4 w-4" />
        </button>
        <button title="Подчёркивание" onClick={() => execCmd("underline")}
          className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <button title="Заголовок H2" onClick={() => execCmd("formatBlock", "h2")}
          className="px-2 py-1 rounded text-xs font-semibold hover:bg-accent transition-colors" aria-label="Heading">
          H2
        </button>
        <button title="Обычный текст" onClick={() => execCmd("formatBlock", "p")}
          className="px-2 py-1 rounded text-xs hover:bg-accent transition-colors" aria-label="Paragraph">
          ¶
        </button>
        <button title="Список" onClick={() => execCmd("insertUnorderedList")}
          className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="List">
          <List className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <button title="Отменить" onClick={() => execCmd("undo")}
          className="p-1.5 rounded hover:bg-accent transition-colors text-xs font-mono" aria-label="Undo">
          ↩
        </button>
        <button title="Повторить" onClick={() => execCmd("redo")}
          className="p-1.5 rounded hover:bg-accent transition-colors text-xs font-mono" aria-label="Redo">
          ↪
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">Нажмите «Сохранить» для обновления анализа</span>
      </div>

      {/* Editing surface */}
      <ScrollArea className="flex-1 min-h-0">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          spellCheck
          data-testid="rich-editor"
          className="rich-editor mx-auto max-w-[78ch] px-10 outline-none"
          data-placeholder="Начните вводить или вставьте текст…"
        />
      </ScrollArea>
    </div>
  );
}

/** Convert plain text (with \n paragraphs) to minimal HTML for contenteditable */
function draftToHtml(plain: string): string {
  return plain
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "<br>";
      // Simple heuristic: short lines without terminal punctuation → heading
      if (t.length < 90 && !/[.!?:,]$/.test(t) && /^[A-ZА-ЯЁ]/u.test(t)) {
        return `<h2>${escHtml(t)}</h2>`;
      }
      return `<p>${escHtml(line)}</p>`;
    })
    .join("");
}

/** Serialise contenteditable HTML back to plain text */
function htmlToPlain(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Replace block elements with newlines
  tmp.querySelectorAll("p, h1, h2, h3, h4, li, br").forEach((el) => {
    if (el.tagName === "BR") { el.replaceWith("\n"); }
    else { el.append("\n"); }
  });
  return tmp.textContent ?? "";
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Inspector panels ────────────────────────────────────────────────────────

function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-mono">Инспектор</div>
      <h3 className="text-[15px] font-semibold mt-1">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

function CitationsPanel({ items, total, search, setSearch, typeFilter, setTypeFilter, onSelect, onHover }: {
  items: FoundItem[]; total: number;
  search: string; setSearch: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  onSelect: (it: FoundItem) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <>
      <PanelHeader title="Найденные элементы"
        hint={`Сноски, цитаты и записи библиографии. Всего: ${total}. После фильтрации: ${items.length}.`}
      />
      <div className="px-4 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по тексту, типу, заметке…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" data-testid="input-search" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9" data-testid="select-typefilter">
            <Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="inline-apa">APA-вставки</SelectItem>
            <SelectItem value="inline-numeric">Числовые сноски</SelectItem>
            <SelectItem value="footnote">Сноски (раскрытые)</SelectItem>
            <SelectItem value="bibliography">Библиография</SelectItem>
            <SelectItem value="ibid">Ibid./Там же</SelectItem>
            <SelectItem value="quote">Цитаты</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-4 space-y-1.5">
          {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">Ничего не найдено.</div>}
          {items.map((it) => (
            <button key={it.id} onClick={() => onSelect(it)}
              onMouseEnter={() => onHover(it.id)} onMouseLeave={() => onHover(null)}
              className="w-full text-left rounded-md border border-card-border bg-card px-3 py-2 hover-elevate active-elevate-2 group"
              data-testid={`citation-${it.id}`}>
              <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`legend-dot ${legendDotClass(it.type)}`} />
                  <Badge variant="outline" className="text-[10px] font-mono shrink min-w-0 truncate">{TYPE_LABELS[it.type]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                  <span>строка {it.line}</span>
                  <span>·</span>
                  <span>{Math.round(it.confidence * 100)}%</span>
                </div>
              </div>
              <div className="text-[13px] leading-snug font-serif text-foreground/95 line-clamp-3 break-words">{it.text}</div>
              {it.note && <div className="mt-1 text-[11px] text-muted-foreground break-words">{it.note}</div>}
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function StylePanel({ detected }: { detected: ReturnType<typeof detectStyle> }) {
  return (
    <>
      <PanelHeader title="Определение стиля цитирования"
        hint="Эвристическая оценка по типу вставок, маркерам и формату библиографии."
      />
      <div className="px-4 pb-4 space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1">Стиль</div>
          <div className="text-2xl font-semibold" data-testid="text-style">{detected.style === "Unknown" ? "Не определён" : detected.style}</div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Уверенность:</span>
            <Badge variant="secondary" data-testid="text-confidence">{Math.round(detected.confidence * 100)}%</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
            <Score label="APA"     value={detected.scores.apa} />
            <Score label="Chicago" value={detected.scores.chicago} />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Объяснение</div>
          <ul className="space-y-1.5 text-sm">
            {detected.reasons.length === 0 && <li className="text-muted-foreground">Признаков стиля не обнаружено.</li>}
            {detected.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 items-start"><span className="text-primary mt-1">•</span><span className="text-foreground/85">{r}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value.toFixed(1)}</div>
    </div>
  );
}

function ConvertPanel({ detected, onRun, text, customRules, setCustomRules, previewActive, applyPreview, onDiscard }: {
  detected: CitationStyle; onRun: (target: CitationStyle) => void; text: string;
  customRules: CustomCitationRules; setCustomRules: (r: CustomCitationRules) => void;
  previewActive: boolean; applyPreview: () => void; onDiscard: () => void;
}) {
  const [target, setTarget] = useState<CitationStyle>(detected === "APA" ? "Chicago" : "APA");
  const result = useMemo(() => convertCitations(text, target, customRules), [text, target, customRules]);
  const updateRule = <K extends keyof CustomCitationRules>(key: K, value: CustomCitationRules[K]) =>
    setCustomRules({ ...customRules, [key]: value });

  return (
    <>
      <PanelHeader title="Конвертация стилей"
        hint="Эвристическое преобразование inline-цитат и записей библиографии. Итог проверяйте вручную."
      />
      <div className="px-4 pb-3 space-y-3">
        <div className="text-xs text-muted-foreground">Текущий стиль: <Badge variant="outline">{detected === "Unknown" ? "не определён" : detected}</Badge></div>
        <div className="flex items-center gap-2">
          <Select value={target} onValueChange={(v) => setTarget(v as CitationStyle)}>
            <SelectTrigger className="h-9" data-testid="select-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="APA">→ APA</SelectItem>
              <SelectItem value="Chicago">→ Chicago</SelectItem>
              <SelectItem value="MLA">→ MLA</SelectItem>
              <SelectItem value="IEEE">→ IEEE</SelectItem>
              <SelectItem value="Vancouver">→ Vancouver</SelectItem>
              <SelectItem value="Harvard">→ Harvard</SelectItem>
              <SelectItem value="GOST">→ ГОСТ</SelectItem>
              <SelectItem value="Custom">→ Авторский</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => onRun(target)} data-testid="button-preview-convert">
            <RefreshCw className="h-4 w-4 mr-1.5" />Предпросмотр
          </Button>
        </div>
        {previewActive && (
          <div className="flex gap-2">
            <Button size="sm" onClick={applyPreview} data-testid="button-apply-side">Применить</Button>
            <Button size="sm" variant="outline" onClick={onDiscard}>Отменить</Button>
          </div>
        )}
        <div className="text-xs text-muted-foreground">Изменений: <span className="font-mono">{result.changes.length}</span></div>
        {target === "Custom" && (
          <div className="rounded-md border bg-card p-3 space-y-3" data-testid="custom-citation-builder">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Конструктор авторской нотации</div>
              <p className="text-xs text-muted-foreground mt-1">Поля: {"{"}author{"}"},  {"{"}year{"}"},  {"{"}title{"}"},  {"{"}source{"}"},  {"{"}n{"}"}.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-style-name">Название</Label>
              <Input id="custom-style-name" value={customRules.name} onChange={(e) => updateRule("name", e.target.value)} data-testid="input-custom-style-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Модель ссылок</Label>
              <Select value={customRules.mode} onValueChange={(v) => updateRule("mode", v as CustomCitationRules["mode"])}>
                <SelectTrigger className="h-9" data-testid="select-custom-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="author-date">Автор–год</SelectItem>
                  <SelectItem value="numeric">Числовая</SelectItem>
                  <SelectItem value="footnote">Сносочная</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-inline">Внутритекстовая ссылка</Label>
              <Input id="custom-inline" value={customRules.inlineTemplate} onChange={(e) => updateRule("inlineTemplate", e.target.value)} data-testid="input-custom-inline" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-bib">Библиография</Label>
              <Textarea id="custom-bib" value={customRules.bibliographyTemplate}
                onChange={(e) => updateRule("bibliographyTemplate", e.target.value)}
                className="min-h-[70px]" data-testid="textarea-custom-bib" />
            </div>
            <div className="text-[11px] text-muted-foreground">Пример: {customRules.inlineTemplate || "—"}; {customRules.bibliographyTemplate || "—"}</div>
            <Separator className="my-2" />
            <SourceTypeBuilder />
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-4 space-y-1.5">
          {result.changes.length === 0 && (
            <div className="text-sm text-muted-foreground px-3 py-6 text-center">Нет автоматически преобразуемых записей. Попробуйте другой целевой стиль.</div>
          )}
          {result.changes.map((c, i) => (
            <div key={i} className="rounded-md border bg-card p-3 text-xs">
              <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                <Badge variant="outline" className="text-[10px] font-mono shrink min-w-0 truncate">{c.type === "inline" ? "Вставка" : "Библиография"}</Badge>
                <span className="text-muted-foreground font-mono shrink-0">строка {c.line}</span>
              </div>
              <div className="font-serif text-[12.5px] min-w-0">
                <div className="text-muted-foreground line-through decoration-1 break-words">{c.before}</div>
                <div className="mt-1 text-foreground/95 break-words">{c.after}</div>
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground break-words">{c.note}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function StructurePanel({ structure, onJump }: { structure: ReturnType<typeof analyzeStructure>; onJump: (line: number) => void }) {
  return (
    <>
      <PanelHeader title="Структура документа" hint="Заголовки, разделы, абзацы." />
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Заголовков" value={structure.headings.length} />
            <Metric label="Абзацев"    value={structure.paragraphs} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Оглавление</div>
            <div className="space-y-0.5">
              {structure.headings.map((h, i) => (
                <button key={i} onClick={() => onJump(h.line)}
                  className="w-full text-left text-sm rounded-md px-2.5 py-1.5 hover-elevate active-elevate-2 min-w-0" data-testid={`heading-${i}`}>
                  <span className="text-muted-foreground font-mono text-[10px] mr-2">{h.line}</span>
                  <span className={`${h.level === 1 ? "font-semibold" : ""} break-words`}>{h.text}</span>
                </button>
              ))}
            </div>
          </div>
          {structure.bibliographySection && (
            <div className="rounded-md border bg-card p-3 text-xs">
              <div className="font-semibold">Раздел библиографии</div>
              <div className="text-muted-foreground mt-1 font-mono">строки {structure.bibliographySection.startLine}–{structure.bibliographySection.endLine}</div>
            </div>
          )}
          {structure.footnotesSection && (
            <div className="rounded-md border bg-card p-3 text-xs">
              <div className="font-semibold">Сноски/Примечания</div>
              <div className="text-muted-foreground mt-1 font-mono">строки {structure.footnotesSection.startLine}–{structure.footnotesSection.endLine}</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function EditorPanel({ issues, onSelect }: { issues: EditorIssue[]; onSelect: (i: EditorIssue) => void }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const filtered = issues.filter(i => typeFilter === "all" || i.type === typeFilter);
  const grouped  = filtered.reduce<Record<string, number>>((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {});
  return (
    <>
      <PanelHeader title="Академическая редактура"
        hint="Длинные предложения, пассив, слабые формулировки, повторы, канцелярит, пунктуация."
      />
      <div className="px-4 pb-2 flex flex-wrap gap-1">
        {Object.entries(grouped).map(([k, v]) => (
          <Badge key={k} variant="secondary" className="text-[10px]">{ISSUE_LABELS[k as EditorIssue["type"]]}: {v}</Badge>
        ))}
      </div>
      <div className="px-4 pb-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9" data-testid="select-issuetype"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {Object.keys(ISSUE_LABELS).map(k => <SelectItem key={k} value={k}>{ISSUE_LABELS[k as EditorIssue["type"]]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-4 space-y-1.5">
          {filtered.length === 0 && <div className="text-sm text-muted-foreground py-10 text-center">Подсказок нет.</div>}
          {filtered.map((i) => (
            <button key={i.id} onClick={() => onSelect(i)}
              className="w-full text-left rounded-md border border-card-border bg-card px-3 py-2 hover-elevate active-elevate-2" data-testid={`issue-${i.id}`}>
              <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                <Badge variant="outline" className="text-[10px] font-mono shrink min-w-0 truncate">{ISSUE_LABELS[i.type]}</Badge>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">строка {i.line}</span>
              </div>
              <div className="text-[12.5px] leading-snug font-serif text-foreground/95 line-clamp-3 italic break-words">«{i.fragment}»</div>
              <div className="mt-1.5 text-[11px] text-foreground/75 break-words">{i.suggestion}</div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function StatsPanel({ stats, found, issues, detected }: {
  stats: { words: number; charsWithSpaces: number; charsNoSpaces: number; paragraphs: number; lines: number; readingMinutes: number };
  found: FoundItem[]; issues: EditorIssue[]; detected: ReturnType<typeof detectStyle>;
}) {
  return (
    <>
      <PanelHeader title="Статистика документа" />
      <div className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Слова"             value={stats.words} />
          <Metric label="Знаки (с проб.)"   value={stats.charsWithSpaces} />
          <Metric label="Знаки (без проб.)" value={stats.charsNoSpaces} />
          <Metric label="Абзацы"            value={stats.paragraphs} />
          <Metric label="Строки"            value={stats.lines} />
          <Metric label="≈ Чтение"          value={`${stats.readingMinutes} мин`} />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Цитат и сносок"        value={found.length} />
          <Metric label="Подсказок редактуры"   value={issues.length} />
          <Metric label="Стиль"                 value={detected.style === "Unknown" ? "—" : detected.style} />
          <Metric label="Уверенность"           value={`${Math.round(detected.confidence * 100)}%`} />
        </div>
      </div>
    </>
  );
}

function SourceTypeBuilder() {
  const [typeId, setTypeId]     = useState<string>(DEFAULT_SOURCE_TYPES[0].id);
  const tpl: SourceTypeTemplate = DEFAULT_SOURCE_TYPES.find(t => t.id === typeId) ?? DEFAULT_SOURCE_TYPES[0];
  const [allFields, setAllFields] = useState<Record<string, Record<string, string>>>({});
  const fields = allFields[typeId] ?? {};
  const setField = (key: string, value: string) =>
    setAllFields(prev => ({ ...prev, [typeId]: { ...(prev[typeId] ?? {}), [key]: value } }));

  const fullNote    = renderSourceTemplate(tpl.fullNote,    fields);
  const shortNote   = renderSourceTemplate(tpl.shortNote,   fields);
  const bibliography = renderSourceTemplate(tpl.bibliography, fields);
  const inText      = renderSourceTemplate(tpl.inText,      fields);

  return (
    <div className="space-y-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Конструктор типов источников</div>
      <div>
        <Label className="text-xs">Тип источника</Label>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger className="h-9 mt-1" data-testid="select-sourcetype"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEFAULT_SOURCE_TYPES.map(t => <SelectItem key={t.id} value={t.id} data-testid={`sourcetype-${t.id}`}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {tpl.fields.map(f => (
          <div key={f}>
            <Label htmlFor={`stf-${f}`} className="text-[11px] text-muted-foreground">{SOURCE_TYPE_FIELD_LABELS[f] ?? f}</Label>
            <Input id={`stf-${f}`} value={fields[f] ?? ""} onChange={e => setField(f, e.target.value)}
              className="h-8 text-xs" placeholder={SOURCE_TYPE_FIELD_LABELS[f] ?? f} data-testid={`input-sourcefield-${f}`} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono pt-1">Предпросмотр шаблонов</div>
        <PreviewRow label="Полная сноска"  value={fullNote}     testid="preview-fullnote" />
        <PreviewRow label="Краткая сноска" value={shortNote}    testid="preview-shortnote" />
        <PreviewRow label="Библиография"   value={bibliography} testid="preview-bib" />
        <PreviewRow label="В тексте"       value={inText}       testid="preview-intext" />
      </div>
    </div>
  );
}

function PreviewRow({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="rounded-md border bg-card px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">{label}</div>
      <div className="text-[12.5px] font-serif text-foreground/95 break-words leading-snug" data-testid={testid}>{value || "—"}</div>
    </div>
  );
}
