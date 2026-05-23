import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Search, BookOpen, Wand2, PenSquare, Layers, Sun, Moon,
  Upload, Download, Link2, RefreshCw, CheckCircle2, Hash, Type,
  AlignLeft, ArrowLeftRight, AlertTriangle, Pencil, Save,
  RotateCcw, Bold, Italic, Underline as UnderlineIcon, List, Sparkles,
  Zap, Settings2, ChevronDown, Cpu,
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
import { CitaDexLogo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { DEMO_DOCS, SAMPLE_DOC, SAMPLE_DOC_TITLE, type DemoId } from "@/lib/sampleDoc";
import {
  analyzeStructure, buildEvidencePack, convertCitations, countChars, countWords,
  detectStyle, findCitations, findEditorIssues,
  DEFAULT_SOURCE_TYPES, SOURCE_TYPE_FIELD_LABELS, renderSourceTemplate,
  type CitationStyle, type CustomCitationRules, type FoundItem,
  type EditorIssue, type SourceTypeTemplate,
} from "@/lib/analyze";
import { importFile } from "@/lib/importDoc";
import { exportDocument, type ExportFormat } from "@/lib/exportDoc";
import { apiRequest } from "@/lib/queryClient";
import {
  useAiAnalyze, useAiConvert, mergeFoundItems, applySelectiveConversion,
  type AiAnalyzeResponse, type AiAnalyzeRequest,
} from "@/lib/aiAnalyze";

type Panel = "structure" | "citations" | "style" | "convert" | "editor" | "stats";

const PANEL_LABELS: Record<Panel, { label: string; icon: typeof FileText }> = {
  structure: { label: "Структура",        icon: Layers },
  citations: { label: "Цитаты и сноски",  icon: BookOpen },
  style:     { label: "Стиль цитирования", icon: Wand2 },
  convert:   { label: "Конвертация",       icon: ArrowLeftRight },
  editor:    { label: "Редактура",         icon: PenSquare },
  stats:     { label: "Статистика",        icon: Hash },
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

const CONVERT_SCOPE_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "citations",    label: "Цитаты",          description: "Внутритекстовые ссылки" },
  { id: "bibliography", label: "Библиография",     description: "Список литературы" },
  { id: "structure",    label: "Структура",        description: "Заголовки разделов" },
  { id: "typos",        label: "Опечатки",         description: "Орфография и типографика" },
  { id: "syntax",       label: "Синтаксис",        description: "Знаки препинания, тире, кавычки" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section entry — normalised shape used in Structure panel
// ─────────────────────────────────────────────────────────────────────────────
interface SectionEntry {
  heading: string;
  level: number;
  startLine: number;
  source: "heuristic" | "ai";
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotation segmenter
// ─────────────────────────────────────────────────────────────────────────────

type AnnotationKind = "citation" | "issue";

interface AnnotationSegment {
  kind: "plain" | "annotation";
  text: string;
  start: number;
  end: number;
  annClass?: string;
  itemId?: string;
  itemType?: string;
  annKind?: AnnotationKind;
}

function buildAnnotationSegments(
  text: string,
  found: FoundItem[],
  issues: EditorIssue[],
): AnnotationSegment[] {
  type RangeEntry = {
    start: number; end: number;
    annClass: string; itemId: string; itemType: string; annKind: AnnotationKind;
  };

  const ranges: RangeEntry[] = [
    ...found.map((f) => ({
      start: Math.max(0, f.start),
      end:   Math.min(text.length, f.end),
      annClass: annotationCSSClass("citation", f.type),
      itemId:   f.id,
      itemType: f.type,
      annKind:  "citation" as AnnotationKind,
    })),
    ...issues.map((iss) => ({
      start: Math.max(0, iss.start),
      end:   Math.min(text.length, iss.end),
      annClass: "ann-issue",
      itemId:   "issue-" + iss.id,
      itemType: iss.type,
      annKind:  "issue" as AnnotationKind,
    })),
  ].filter((r) => r.start < r.end && r.start < text.length);

  ranges.sort((a, b) =>
    a.start !== b.start
      ? a.start - b.start
      : (a.annKind === "citation" ? -1 : 1)
  );

  const segments: AnnotationSegment[] = [];
  let cursor = 0;

  for (const r of ranges) {
    if (r.start < cursor) continue;
    if (r.start > cursor) {
      segments.push({ kind: "plain", text: text.slice(cursor, r.start), start: cursor, end: r.start });
    }
    segments.push({
      kind:      "annotation",
      text:      text.slice(r.start, r.end),
      start:     r.start,
      end:       r.end,
      annClass:  r.annClass,
      itemId:    r.itemId,
      itemType:  r.itemType,
      annKind:   r.annKind,
    });
    cursor = r.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: "plain", text: text.slice(cursor), start: cursor, end: text.length });
  }

  return segments;
}

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
  const [aiSetupOpen, setAiSetupOpen]   = useState(false);
  const [aiTargetStyle, setAiTargetStyle] = useState<CitationStyle | null>(null);
  const [convertScope, setConvertScope] = useState<string[]>(["citations", "bibliography"]);
  const [convertTargetStyle, setConvertTargetStyle] = useState<CitationStyle>("APA");
  const [aiSections, setAiSections] = useState<SectionEntry[] | null>(null);

  // AI hooks
  const {
    analyze: runAiAnalysis,
    loading: aiLoading,
    data: aiData,
    error: aiError,
    activeModel: aiAnalyzeModel,
    retryCount: aiAnalyzeRetries,
  } = useAiAnalyze();

  const {
    convert: runAiConvert,
    loading: aiConvertLoading,
    data: aiConvertData,
    error: aiConvertError,
    activeModel: aiConvertModel,
    retryCount: aiConvertRetries,
  } = useAiConvert();

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

  const spanRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

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

  const displaySections = useMemo((): SectionEntry[] => {
    const heuristicSections: SectionEntry[] = structure.sections.map((h) => ({
      heading:   h.text,
      level:     h.level,
      startLine: h.line,
      source:    "heuristic" as const,
    }));

    if (!aiSections || aiSections.length === 0) return heuristicSections;

    const hLines = new Set(heuristicSections.map((s) => s.startLine));
    const merged: SectionEntry[] = [...heuristicSections];

    for (const aiSec of aiSections) {
      if (!hLines.has(aiSec.startLine)) {
        merged.push({ ...aiSec, source: "ai" });
      } else {
        const idx = merged.findIndex((s) => s.startLine === aiSec.startLine);
        if (idx !== -1 && aiSec.heading && aiSec.heading.length > merged[idx].heading.length) {
          merged[idx] = { ...merged[idx], heading: aiSec.heading, source: "ai" };
        }
      }
    }

    return merged.sort((a, b) => a.startLine - b.startLine);
  }, [structure.sections, aiSections]);

  const currentText = preview?.text ?? text;
  const annotationSegments = useMemo(
    () => buildAnnotationSegments(currentText, found, issues),
    [currentText, found, issues],
  );

  const aiStatusOk      = !aiLoading && !!aiData && !aiError;
  const activeModelLabel = aiConvertModel ?? aiAnalyzeModel;
  const activeRetries    = aiConvertRetries > 0 ? aiConvertRetries : aiAnalyzeRetries;

  function scrollToItem(itemId: string) {
    const el = spanRefs.current.get(itemId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }

  // ── AI: analysis — Evidence-Pack pipeline ────────────────────────────────
  async function handleAiAnalyze() {
    if (!text.trim()) return;

    const pack = typeof buildEvidencePack === "function"
      ? buildEvidencePack(text, heuristicFound)
      : null;

    const req: AiAnalyzeRequest = pack
      ? {
          heuristicSummary: {
            style:         detected.style,
            confidence:    detected.confidence,
            citationCount: heuristicFound.length,
            bibCount:      heuristicFound.filter((f) => f.type === "bibliography").length,
            language:      structure.language as "ru" | "en" | "mixed",
          },
          evidence:               pack.evidenceSnippets,
          bibliographyCandidates: pack.bibliographyCandidates,
          structureCandidates:    pack.structureCandidates,
          scope: ["analyze"],
        }
      : { text, language: structure.language, scope: ["analyze"] } as unknown as AiAnalyzeRequest;

    const result = await runAiAnalysis(req);
    if (!result) return;

    if (result.items?.length) setAiFound(result.items as FoundItem[]);

    const rawSections: unknown =
      (result as Record<string, unknown>).sections ??
      (result as Record<string, unknown>).structureSections ?? null;

    if (Array.isArray(rawSections) && rawSections.length > 0) {
      const normalised: SectionEntry[] = (rawSections as Record<string, unknown>[]).map((s) => ({
        heading:   String(s.heading ?? s.title ?? s.text ?? ""),
        level:     typeof s.level === "number" ? s.level : 1,
        startLine: typeof s.startLine === "number" ? s.startLine
                 : typeof s.line      === "number" ? s.line : 0,
        source:    "ai" as const,
      })).filter((s) => s.heading.length > 0);

      if (normalised.length > 0) setAiSections(normalised);
    }

    if (result.error) {
      const msg = result.error;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("501") || msg.includes("не задан")) {
        setAiSetupOpen(true);
      }
      toast({ title: "AI недоступен", description: msg, variant: "destructive" });
      return;
    }

    const modelNote = result._label ? ` (✓ ${result._label})` : "";
    toast({
      title: `AI-анализ завершён${modelNote}`,
      description:
        result.summary ||
        `Найдено ${result.items?.length ?? 0} элементов` +
        (result.confidence
          ? ` (уверенность ${Math.round(result.confidence * 100)}%)`
          : "") + ".",
    });

    setPanel("structure");
  }

  // ── AI: conversion ────────────────────────────────────────────────────────
  //
  // Strategy (в порядке приоритета):
  //
  // 1. Точечная замена через applySelectiveConversion — используется когда
  //    сервер вернул items[] с заменами (start/end/text). Изменяются только
  //    найденные фрагменты, остальной текст не трогается.
  //
  // 2. Прямое применение convertedText — fallback когда items[] пуст, но
  //    convertedText присутствует (случай bibliography-only scope: сервер
  //    переписывает весь документ целиком и не возвращает items).
  //    Документ показывается через setPreview → пользователь видит жёлтую
  //    полосу «Предпросмотр» и может принять или отменить.
  //
  // Без этого fallback конвертация была «успешной» (200 OK), но текст в UI
  // оставался неизменным, т.к. applySelectiveConversion([]) возвращает
  // оригинал как есть.
  async function handleAiConvert() {
    if (!text.trim() || convertScope.length === 0) return;

    const pack = typeof buildEvidencePack === "function"
      ? buildEvidencePack(text, heuristicFound)
      : null;

    const baseReq = pack
      ? {
          heuristicSummary: {
            style:         detected.style,
            confidence:    detected.confidence,
            citationCount: heuristicFound.length,
            bibCount:      heuristicFound.filter((f) => f.type === "bibliography").length,
            language:      structure.language as "ru" | "en" | "mixed",
          },
          evidence:               pack.evidenceSnippets,
          bibliographyCandidates: pack.bibliographyCandidates,
          structureCandidates:    pack.structureCandidates,
        }
      : { text, language: structure.language } as unknown as Omit<AiAnalyzeRequest, "scope">;

    const result = await runAiConvert(
      baseReq as Omit<AiAnalyzeRequest, "scope">,
      convertTargetStyle,
    );
    if (!result) return;

    if (result.error) {
      if (result.error.includes("GEMINI_API_KEY") || result.error.includes("501")) {
        setAiSetupOpen(true);
      }
      toast({ title: "AI-конвертация не удалась", description: result.error, variant: "destructive" });
      return;
    }

    if (result.items?.length) setAiFound(result.items as FoundItem[]);

    if (!result.convertedText?.trim()) {
      // Сервер ответил 200 но не вернул текст — информируем
      toast({
        title: "AI-конвертация завершена",
        description: result.summary || "Изменений не потребовалось или Gemini не вернул текст.",
      });
      return;
    }

    const modelNote = result._label ? ` — ${result._label}` : "";

    // ── Путь 1: точечная замена через items[] ──────────────────────────────
    const replacements = (result.items ?? []).map((aiItem) => {
      const match = found.find(
        (item) =>
          item.start === aiItem.start &&
          item.end   === aiItem.end   &&
          typeof aiItem.text === "string" &&
          aiItem.text.trim() &&
          aiItem.text !== item.text,
      );
      return match
        ? { start: match.start, end: match.end, text: aiItem.text as string }
        : null;
    }).filter((x): x is { start: number; end: number; text: string } => x !== null);

    if (replacements.length > 0) {
      // Есть конкретные замены — применяем хирургически
      const patched = applySelectiveConversion(text, replacements);
      setText(patched);
      setDraft(patched);
      setPreview(null);
      setAiTargetStyle(convertTargetStyle);
      toast({
        title: "AI-конвертация применена",
        description:
          `Заменено элементов: ${replacements.length}. Стиль → ${convertTargetStyle}${modelNote}.`,
      });
      return;
    }

    // ── Путь 2: fallback — показываем convertedText через Preview ─────────
    // items[] пуст (bibliography-scope, full-rewrite и т.п.) — показываем
    // весь переписанный документ в режиме предпросмотра, не применяя сразу.
    setPreview({ target: convertTargetStyle, text: result.convertedText });
    setAiTargetStyle(convertTargetStyle);
    toast({
      title: `Предпросмотр конвертации → ${convertTargetStyle}${modelNote}`,
      description:
        (result.summary ?? `Документ переконвертирован: ${convertScope.join(", ")}.`) +
        " Нажмите «Применить» в жёлтой полосе чтобы сохранить изменения.",
    });
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
    setPreview(null); setSelected(null); setAiFound(null); setAiTargetStyle(null); setAiSections(null);
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
      setPreview(null); setSelected(null); setLinkDialogOpen(false); setLinkUrl(""); setAiFound(null); setAiTargetStyle(null); setAiSections(null);
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
    const exportText = preview?.text ?? text;
    try {
      await exportDocument(exportText, docName, exportFormat);
      toast({ title: "Файл подготовлен", description: `Экспорт в ${exportFormat.toUpperCase()} запущен.` });
    } catch (error) {
      toast({ title: "Экспорт не удался", description: error instanceof Error ? error.message : "Попробуйте другой формат." });
    }
  }

  async function handleDriveExport() {
    const exportText = preview?.text ?? text;
    const ok = window.confirm("Экспорт создаст новый файл в вашем Google Drive. Продолжить?");
    if (!ok) return;
    setDriveLoading(true);
    try {
      const res = await apiRequest("POST", "/api/export-drive", { text: exportText, docName, format: exportFormat });
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
    setPreview(null); setSelected(null); setSearch(""); setTypeFilter("all"); setWarnings([]); setAiFound(null); setAiTargetStyle(null); setAiSections(null);
    spanRefs.current.clear();
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

  function handlePanelItemClick(itemId: string, start: number, end: number) {
    setSelected({ start, end });
    scrollToItem(itemId);
  }

  function handleSpanClick(seg: AnnotationSegment) {
    if (!seg.itemId) return;
    setSelected({ start: seg.start, end: seg.end });
    if (seg.annKind === "citation") setPanel("citations");
    if (seg.annKind === "issue")    setPanel("editor");
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground" data-testid="workbench">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="h-14 border-b flex items-center px-4 gap-3 shrink-0 bg-background/80 backdrop-blur"
        data-testid="header"
      >
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-primary">
            <CitaDexLogo size={30} />
          </span>
          <div className="leading-none select-none">
            <div className="text-[15px] font-bold tracking-normal text-foreground leading-tight">
              CitaDex
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
              Academic Citation Workspace
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate max-w-[28ch]" data-testid="text-docname">
            {docName}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <input
            ref={fileInput}
            type="file"
            accept=".docx,.txt,.md"
            onChange={handleFile}
            className="hidden"
            data-testid="input-file"
          />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-1.5" />Импорт
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)} data-testid="button-import-link">
            <Link2 className="h-4 w-4 mr-1.5" />Ссылка
          </Button>
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
            <SelectTrigger className="h-9 w-[112px]" data-testid="select-export-format">
              <SelectValue />
            </SelectTrigger>
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
          <Button
            variant="outline" size="sm"
            onClick={handleDriveExport}
            disabled={driveLoading}
            data-testid="button-export-drive"
          >
            <Upload className="h-4 w-4 mr-1.5" />{driveLoading ? "Drive…" : "В Drive"}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleAiAnalyze}
            disabled={aiLoading || !text.trim()}
            data-testid="button-ai-analyze"
            title="Анализ структуры и цитирования через Gemini AI"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />{aiLoading ? "AI…" : "AI-анализ"}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── AI Status bar ───────────────────────────────────────────────────── */}
      {(aiLoading || aiConvertLoading || aiData || aiConvertData || aiError || aiConvertError) && (
        <div className="h-7 border-b px-4 flex items-center gap-2 text-[11px] bg-muted/40">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />

          {(aiLoading || aiConvertLoading) && (
            <span className="text-muted-foreground">
              {aiConvertLoading ? "AI-конвертация…" : "AI-анализ…"}
              {activeRetries > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  (повторная попытка {activeRetries})
                </span>
              )}
            </span>
          )}

          {aiStatusOk && !aiConvertLoading && !aiLoading && (
            <span className="flex items-center gap-1.5 min-w-0">
              <span>
                AI‑анализ активен: {aiData!.items.length} эл. — {aiData!.detectedStyle}
                {" "}({Math.round((aiData!.confidence ?? 0) * 100)}%)
              </span>
              {aiSections && aiSections.length > 0 && (
                <span className="text-muted-foreground"> · {aiSections.length} разд. из AI</span>
              )}
              {aiTargetStyle && (
                <span> · конвертация в <strong>{aiTargetStyle}</strong> применена.</span>
              )}
              {activeModelLabel && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 gap-1 shrink-0">
                  <Cpu className="h-2.5 w-2.5" />{activeModelLabel}
                </Badge>
              )}
            </span>
          )}

          {!aiLoading && !aiConvertLoading && (aiError || aiConvertError) && (
            <button
              type="button"
              className="text-destructive underline-offset-2 hover:underline truncate"
              onClick={() => setAiSetupOpen(true)}
            >
              AI недоступен: {aiConvertError ?? aiError}
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
            <p>1. Получите бесплатный ключ на{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                aistudio.google.com
              </a>.
            </p>
            <p>2. Установите переменную окружения:{" "}
              <code className="bg-muted px-1 rounded">GEMINI_API_KEY=ваш_ключ</code>
            </p>
            <p>3. Перезапустите сервер (<code className="bg-muted px-1 rounded">npm run dev</code>).</p>
            <p className="text-[11px] pt-1">
              Модельный каскад:{" "}
              {["Gemini 2.5 Flash", "Gemini 3.5 Flash", "Gemini 3.1 Flash Lite"].join(" → ")}
            </p>
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
                {key === "structure" && displaySections.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 shrink-0">{displaySections.length}</Badge>
                )}
                {key === "citations" && found.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 shrink-0">{found.length}</Badge>
                )}
                {key === "editor" && issues.length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 shrink-0">{issues.length}</Badge>
                )}
              </button>
            ))}
          </nav>

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

          <div
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
            style={{ left: sidebar.width - 1 }}
            onMouseDown={sidebar.onMouseDown}
          />
        </aside>

        {/* ── Document area ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 relative">

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

          {preview && (
            <div className="h-9 border-b flex items-center gap-3 px-4 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm shrink-0">
              <RefreshCw className="h-4 w-4" />
              <span>Предпросмотр конвертации в <strong>{preview.target}</strong></span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400" onClick={() => setPreview(null)}>Отмена</Button>
                <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={applyConversion}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Применить
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            {!editMode && (
              <div
                className={`p-6 min-h-full font-mono text-sm leading-relaxed whitespace-pre-wrap select-text ${
                  preview ? "opacity-90" : ""
                }`}
                data-testid="document-area"
              >
                {annotationSegments.map((seg, idx) => {
                  if (seg.kind === "plain") {
                    return <span key={idx}>{seg.text}</span>;
                  }
                  const itemId = seg.itemId!;
                  const isHovered  = hoveredId === itemId;
                  const isSelected = selected !== null && selected.start === seg.start && selected.end === seg.end;
                  const classes = [
                    seg.annClass!,
                    isHovered  ? "ann-focused"  : "",
                    isSelected ? "ann-selected" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <span
                      key={idx}
                      ref={(el) => {
                        if (el) spanRefs.current.set(itemId, el);
                        else spanRefs.current.delete(itemId);
                      }}
                      className={classes}
                      data-item-id={itemId}
                      data-start={seg.start}
                      data-end={seg.end}
                      tabIndex={0}
                      role="mark"
                      aria-label={`${seg.annKind === "issue" ? "Замечание" : "Аннотация"}: ${seg.text}`}
                      onMouseEnter={() => setHoveredId(itemId)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => handleSpanClick(seg)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSpanClick(seg); } }}
                    >
                      {seg.text}
                    </span>
                  );
                })}
              </div>
            )}

            {editMode && (
              <div
                className="p-6 min-h-full font-mono text-sm leading-relaxed outline-none whitespace-pre-wrap cursor-text"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setDraft((e.target as HTMLDivElement).innerText)}
                data-testid="document-area-edit"
              >
                {text}
              </div>
            )}
          </ScrollArea>

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
                    <Badge variant="outline" className="text-[10px]">{displaySections.length} разд.</Badge>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Type className="h-3 w-3" />{structure.language === "ru" ? "RU" : structure.language === "en" ? "EN" : "RU+EN"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <AlignLeft className="h-3 w-3" />{structure.paragraphs} абз.
                    </Badge>
                    {aiSections && aiSections.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1 text-primary border-primary/30">
                        <Sparkles className="h-3 w-3" />AI
                      </Badge>
                    )}
                  </div>

                  {displaySections.length === 0 ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Явные заголовки не обнаружены — документ может быть сплошным текстом.
                      </p>
                      {!aiData && (
                        <p className="text-[11px] text-muted-foreground">
                          Запустите <span className="font-medium text-foreground">AI-анализ</span> для уточнённого распознавания разделов.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {displaySections.map((sec, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-default transition-colors group"
                          style={{ paddingLeft: `${(sec.level - 1) * 12 + 8}px` }}
                          title={`Строка ${sec.startLine}${sec.source === "ai" ? " · AI" : ""}`}
                        >
                          <span
                            className="text-[10px] text-muted-foreground mt-0.5 shrink-0 w-3 text-right select-none"
                            aria-label={`Уровень ${sec.level}`}
                          >
                            {sec.level}
                          </span>
                          <span className="text-xs leading-snug break-words min-w-0 flex-1 text-foreground">
                            {sec.heading}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {sec.source === "ai" && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 text-primary border-primary/30"
                                title="Обнаружен AI-анализом"
                              >
                                AI
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              стр. {sec.startLine}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Citations panel ─────────────────────────────────────── */}
              {panel === "citations" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Цитаты и сноски</h2>
                    <Badge variant="outline" className="text-[10px]">{found.length} эл.</Badge>
                  </div>

                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Поиск…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Все типы</SelectItem>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredFound.length === 0 ? (
                    <p className="text-xs text-muted-foreground pt-1">
                      {found.length === 0
                        ? "Цитат не обнаружено. Попробуйте загрузить другой документ."
                        : "Нет совпадений с фильтром."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredFound.map((item) => {
                        const isSelected = selected?.start === item.start && selected?.end === item.end;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors border ${
                              isSelected
                                ? "bg-primary/10 border-primary/30"
                                : "hover:bg-muted border-transparent hover:border-border"
                            }`}
                            onClick={() => handlePanelItemClick(item.id, item.start, item.end)}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`legend-dot ${legendDotClass(item.type)}`} />
                              <span className="font-medium">{TYPE_LABELS[item.type]}</span>
                              {item.source && item.source !== "heuristic" && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                                  {item.source === "ai" ? "AI" : "✓"}
                                </Badge>
                              )}
                              {item.confidence !== undefined && (
                                <span className="ml-auto text-[10px] text-muted-foreground">
                                  {Math.round(item.confidence * 100)}%
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground truncate">{item.text}</div>
                            {item.note && (
                              <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{item.note}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Style panel ─────────────────────────────────────────── */}
              {panel === "style" && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold">Стиль цитирования</h2>

                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Обнаруженный стиль</span>
                      <Badge>{detected.style}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.round(detected.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {Math.round(detected.confidence * 100)}%
                      </span>
                    </div>
                    {aiData && (
                      <p className="text-[10px] text-muted-foreground">
                        AI: {aiData.detectedStyle} ({Math.round((aiData.confidence ?? 0) * 100)}%)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Быстрая конвертация (эвристика)</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["APA", "Chicago", "MLA", "GOST"] as CitationStyle[]).map((style) => (
                        <Button
                          key={style}
                          variant={detected.style === style ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            const converted = convertCitations(text, found, style, customRules);
                            setPreview({ target: style, text: converted });
                          }}
                        >
                          {style}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Convert panel ───────────────────────────────────────── */}
              {panel === "convert" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">AI-конвертация</h2>
                    {aiConvertModel && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Cpu className="h-2.5 w-2.5" />{aiConvertModel}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Целевой стиль</Label>
                    <Select
                      value={convertTargetStyle}
                      onValueChange={(v) => setConvertTargetStyle(v as CitationStyle)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["APA", "Chicago", "MLA", "GOST", "IEEE", "Vancouver", "Harvard"] as CitationStyle[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Область конвертации</Label>
                    <div className="space-y-1.5">
                      {CONVERT_SCOPE_OPTIONS.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`scope-${opt.id}`}
                            checked={convertScope.includes(opt.id)}
                            onCheckedChange={() => toggleScope(opt.id)}
                            className="h-3.5 w-3.5"
                          />
                          <label htmlFor={`scope-${opt.id}`} className="text-xs cursor-pointer flex-1">
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-muted-foreground ml-1">— {opt.description}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full h-9 text-sm"
                    onClick={handleAiConvert}
                    disabled={aiConvertLoading || convertScope.length === 0 || !text.trim()}
                  >
                    {aiConvertLoading ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Конвертация…</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Конвертировать через Gemini</>
                    )}
                  </Button>

                  {aiConvertData && !aiConvertLoading && (
                    <div className="rounded-md border p-3 space-y-1.5 text-xs">
                      <p className="font-medium">Результат конвертации</p>
                      {aiConvertData.summary && (
                        <p className="text-muted-foreground">{aiConvertData.summary}</p>
                      )}
                      {aiConvertData.bibEntries?.length > 0 && (
                        <p className="text-muted-foreground">
                          Библиография: {aiConvertData.bibEntries.length} записей
                          {aiConvertData.bibEntries.filter((e) => e.converted).length > 0 &&
                            ` (${aiConvertData.bibEntries.filter((e) => e.converted).length} сконвертировано)`
                          }
                        </p>
                      )}
                      {aiConvertData._label && (
                        <p className="text-[10px] text-muted-foreground/70">Модель: {aiConvertData._label}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Editor panel ────────────────────────────────────────── */}
              {panel === "editor" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Редактура</h2>
                    <Badge variant={issues.length > 0 ? "destructive" : "secondary"} className="text-[10px]">
                      {issues.length} замеч.
                    </Badge>
                  </div>

                  {issues.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Замечаний не обнаружено.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {issues.map((iss) => {
                        const isSelected = selected?.start === iss.start && selected?.end === iss.end;
                        return (
                          <button
                            key={iss.id}
                            type="button"
                            className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors border ${
                              isSelected
                                ? "bg-destructive/10 border-destructive/30"
                                : "hover:bg-muted border-transparent hover:border-border"
                            }`}
                            onClick={() => handlePanelItemClick("issue-" + iss.id, iss.start, iss.end)}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                              <span className="font-medium">{ISSUE_LABELS[iss.type]}</span>
                            </div>
                            <div className="text-muted-foreground truncate">{iss.text}</div>
                            {iss.suggestion && (
                              <div className="text-[10px] text-primary/80 mt-0.5 truncate">→ {iss.suggestion}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Stats panel ─────────────────────────────────────────── */}
              {panel === "stats" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold">Статистика</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Слов",          value: stats.words },
                      { label: "Знаков (с пр.)", value: stats.charsWithSpaces },
                      { label: "Знаков (без)",   value: stats.charsNoSpaces },
                      { label: "Абзацев",        value: stats.paragraphs },
                      { label: "Строк",          value: stats.lines },
                      { label: "Мин. чтения",    value: stats.readingMinutes },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-md border p-2.5 text-center">
                        <div className="text-lg font-bold tabular-nums">{value.toLocaleString("ru")}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Цитат найдено: <span className="text-foreground font-medium">{found.length}</span></p>
                    <p>Замечаний редактора: <span className="text-foreground font-medium">{issues.length}</span></p>
                    <p>Разделов: <span className="text-foreground font-medium">{displaySections.length}</span></p>
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
