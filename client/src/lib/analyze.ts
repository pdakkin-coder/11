// Analysis library for Codex / Citation Desktop
// All logic is heuristic and intended for demonstration purposes.

export type CitationStyle = "APA" | "Chicago" | "MLA" | "IEEE" | "Vancouver" | "Harvard" | "GOST" | "Custom" | "Unknown";

export interface CustomCitationRules {
  name: string;
  mode: "author-date" | "numeric" | "footnote";
  inlineTemplate: string;
  bibliographyTemplate: string;
  footnoteTemplate: string;
  separator: string;
  /** Optional: per-source-type templates for full note / short note / bibliography */
  sourceTypes?: SourceTypeTemplate[];
}

export type SourceTypeId =
  | "book"
  | "book-chapter"
  | "journal-article"
  | "anthology-article"
  | "web"
  | "thesis"
  | "archive"
  | "law"
  | "report"
  | "conference";

export interface SourceTypeTemplate {
  id: SourceTypeId;
  label: string;
  /** Fields, in display order */
  fields: string[];
  /** Full footnote (Chicago-style first occurrence) */
  fullNote: string;
  /** Short footnote (subsequent occurrence) */
  shortNote: string;
  /** Bibliography entry */
  bibliography: string;
  /** In-text citation (e.g. (Author, Year) or [n]) */
  inText: string;
}

/** Default source-type template library. Placeholders use {field} syntax. */
export const DEFAULT_SOURCE_TYPES: SourceTypeTemplate[] = [
  {
    id: "book",
    label: "Книга",
    fields: ["author", "title", "translator", "editor", "place", "publisher", "year", "pages", "doi", "url"],
    fullNote: "{author}. {title}. {place}: {publisher}, {year}. {pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}. {place}: {publisher}, {year}.",
    inText: "({author}, {year})",
  },
  {
    id: "book-chapter",
    label: "Глава в книге",
    fields: ["author", "title", "editor", "container_title", "place", "publisher", "year", "pages", "doi"],
    fullNote: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. С. {pages}.",
    shortNote: "{author}, «{title}», {pages}.",
    bibliography: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. — С. {pages}.",
    inText: "({author}, {year})",
  },
  {
    id: "journal-article",
    label: "Статья в журнале",
    fields: ["author", "title", "container_title", "year", "volume", "issue", "pages", "doi", "url"],
    fullNote: "{author}. {title} // {container_title}. {year}. Т. {volume}, № {issue}. С. {pages}.",
    shortNote: "{author}, «{title}», {pages}.",
    bibliography: "{author}. {title} // {container_title}. — {year}. — Т. {volume}, № {issue}. — С. {pages}.",
    inText: "({author}, {year})",
  },
  {
    id: "anthology-article",
    label: "Статья в сборнике",
    fields: ["author", "title", "container_title", "editor", "place", "publisher", "year", "pages"],
    fullNote: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. С. {pages}.",
    shortNote: "{author}, «{title}», {pages}.",
    bibliography: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. — С. {pages}.",
    inText: "({author}, {year})",
  },
  {
    id: "web",
    label: "Веб-страница",
    fields: ["author", "title", "container_title", "year", "url", "access_date"],
    fullNote: "{author}. {title} [Электронный ресурс] // {container_title}. {year}. URL: {url} (дата обращения: {access_date}).",
    shortNote: "{author}, «{title}».",
    bibliography: "{author}. {title} [Электронный ресурс]. — URL: {url} (дата обращения: {access_date}).",
    inText: "({author}, {year})",
  },
  {
    id: "thesis",
    label: "Диссертация",
    fields: ["author", "title", "degree", "place", "year", "pages"],
    fullNote: "{author}. {title}: дис. … {degree}. {place}, {year}. {pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}: дис. … {degree}. — {place}, {year}. — {pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "archive",
    label: "Архивный источник",
    fields: ["archive", "fond", "opis", "delo", "list", "title", "year"],
    fullNote: "{archive}. Ф. {fond}. Оп. {opis}. Д. {delo}. Л. {list}. ({title}, {year}.)",
    shortNote: "{archive}, Ф. {fond}, Д. {delo}, Л. {list}.",
    bibliography: "{archive}. Ф. {fond}. Оп. {opis}. Д. {delo}. Л. {list}.",
    inText: "({archive}, Ф.{fond}/Д.{delo})",
  },
  {
    id: "law",
    label: "Нормативный акт",
    fields: ["title", "act_number", "act_date", "container_title", "year", "issue", "article"],
    fullNote: "{title}: фед. закон от {act_date} № {act_number} // {container_title}. {year}. № {issue}. Ст. {article}.",
    shortNote: "{title}.",
    bibliography: "{title}: фед. закон от {act_date} № {act_number} // {container_title}. — {year}. — № {issue}. — Ст. {article}.",
    inText: "({title}, {act_date})",
  },
  {
    id: "report",
    label: "Отчёт",
    fields: ["author", "title", "organization", "place", "year", "pages", "url"],
    fullNote: "{author}. {title}: отчёт / {organization}. {place}, {year}. {pages} с.",
    shortNote: "{author}, «{title}».",
    bibliography: "{author}. {title}: отчёт / {organization}. — {place}, {year}. — {pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "conference",
    label: "Конференционный доклад",
    fields: ["author", "title", "container_title", "place", "year", "pages", "doi"],
    fullNote: "{author}. {title} // {container_title}: мат. конф. {place}, {year}. С. {pages}.",
    shortNote: "{author}, «{title}», {pages}.",
    bibliography: "{author}. {title} // {container_title}: мат. конф. — {place}, {year}. — С. {pages}.",
    inText: "({author}, {year})",
  },
];

export const SOURCE_TYPE_FIELD_LABELS: Record<string, string> = {
  author: "Автор",
  editor: "Редактор",
  translator: "Переводчик",
  title: "Название",
  container_title: "Контейнер (сборник/журнал)",
  publisher: "Издательство",
  place: "Место",
  year: "Год",
  pages: "Страницы",
  volume: "Том",
  issue: "Номер вып.",
  doi: "DOI",
  url: "URL",
  access_date: "Дата обращения",
  archive: "Архив",
  fond: "Фонд",
  opis: "Опись",
  delo: "Дело",
  list: "Лист",
  degree: "Степень",
  act_number: "№ акта",
  act_date: "Дата акта",
  article: "Статья",
  organization: "Организация",
};

export function renderSourceTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = fields[key];
    if (v && v.trim()) return v;
    return `‹${SOURCE_TYPE_FIELD_LABELS[key] || key}›`;
  });
}

export interface FoundItem {
  id: string;
  type: "inline-apa" | "inline-numeric" | "footnote" | "bibliography" | "ibid" | "quote";
  text: string;
  line: number;
  start: number; // index in original text
  end: number;
  confidence: number; // 0..1
  note?: string;
}

export interface StyleDetection {
  style: CitationStyle;
  confidence: number;
  reasons: string[];
  scores: { apa: number; chicago: number };
}

export interface DocStructure {
  headings: { line: number; level: number; text: string }[];
  paragraphs: number;
  bibliographySection?: { startLine: number; endLine: number };
  footnotesSection?: { startLine: number; endLine: number };
}

export interface EditorIssue {
  id: string;
  type:
    | "длинное-предложение"
    | "пассив"
    | "разговорный-маркер"
    | "слабая-формулировка"
    | "повтор"
    | "неопределённый-указатель"
    | "пунктуация"
    | "канцелярит";
  fragment: string;
  line: number;
  start: number;
  end: number;
  suggestion: string;
}

// --- Utility --------------------------------------------------------------

export function getLineFromIndex(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

export function countChars(text: string, withSpaces = true): number {
  return withSpaces ? text.length : text.replace(/\s+/gu, "").length;
}

// --- Find citations -------------------------------------------------------

const APA_INLINE_SINGLE = /([A-ZА-ЯЁ][A-Za-zА-Яа-яёЁ.\-' À-ſ]+?(?:\s+et\s*al\.?)?(?:\s*(?:&|и)\s*[A-ZА-ЯЁ][A-Za-zА-Яа-яёЁ.\-' À-ſ]+?)*),\s*(\d{4}[a-z]?)(?:,\s*(?:с\.|p\.|pp\.|сс\.)\s*[\d–\-, ]+)?/gu;
const APA_INLINE_GROUP = /\(([^()]*?\d{4}[a-z]?[^()]*?)\)/gu;
const CHICAGO_NUMERIC = /(?<![\w\d])\[(\d{1,3})\]|(?<=[А-Яа-яA-Za-z\.\)»"”])\s*(\d{1,3})(?=\.|,|\s|$)/gu;
const FOOTNOTE_REF = /[.»"”\)]\^?\[?(\d{1,3})\]?(?=[\s.,;:]|$)/gu;
const IBID_RE = /\b(?:Ibid\.?|Там же|Тамже)\b/gu;
const QUOTE_RE = /[«"](.+?)[»"]\s*\(([^)]+)\)/gu;
const BIB_ENTRY_RE = /^([A-ZА-ЯЁ][^\n]{20,})$/gmu;

// Section header names
const BIBLIOGRAPHY_HEADERS = [
  "Список литературы",
  "Список цитированной литературы",
  "Библиография",
  "References",
  "Bibliography",
  "Works Cited",
  "Литература",
];
const FOOTNOTE_HEADERS = ["Сноски", "Примечания", "Notes", "Footnotes", "Endnotes"];

export interface SectionRanges {
  bodyEnd: number; // index where body ends (start of footnotes or bibliography)
  footnotes?: { start: number; end: number };
  bibliography?: { start: number; end: number };
}

export function detectSectionRanges(text: string): SectionRanges {
  const bibStart = findSectionStart(text, BIBLIOGRAPHY_HEADERS);
  const fnStart = findSectionStart(text, FOOTNOTE_HEADERS);

  let bibliography: { start: number; end: number } | undefined;
  let footnotes: { start: number; end: number } | undefined;

  if (bibStart >= 0) {
    bibliography = { start: bibStart, end: text.length };
  }
  if (fnStart >= 0) {
    // footnotes end when bibliography starts (if bibliography is later)
    const end = bibStart > fnStart ? bibStart : text.length;
    footnotes = { start: fnStart, end };
    if (bibliography && bibStart < fnStart) {
      bibliography.end = text.length;
    }
  }
  // Adjust bibliography start/end if it comes before footnotes
  if (bibliography && footnotes && footnotes.start > bibliography.start) {
    bibliography.end = footnotes.start;
  }

  let bodyEnd = text.length;
  if (footnotes && bibliography) bodyEnd = Math.min(footnotes.start, bibliography.start);
  else if (footnotes) bodyEnd = footnotes.start;
  else if (bibliography) bodyEnd = bibliography.start;

  return { bodyEnd, footnotes, bibliography };
}

function isInRange(pos: number, range?: { start: number; end: number }): boolean {
  return !!range && pos >= range.start && pos < range.end;
}

export function findCitations(text: string): FoundItem[] {
  const items: FoundItem[] = [];
  let idx = 0;
  const ranges = detectSectionRanges(text);

  // Helper: is index inside the body (i.e. not in footnotes or bibliography)?
  const inBody = (pos: number) =>
    !isInRange(pos, ranges.footnotes) && !isInRange(pos, ranges.bibliography);

  // APA inline (group-aware): match parentheses containing year(s) — body only
  for (const m of text.matchAll(APA_INLINE_GROUP)) {
    const start = m.index ?? 0;
    const inner = m[1];
    if (!/\d{4}/.test(inner)) continue;
    if (!inBody(start)) continue; // ignore years inside bibliography/footnotes
    items.push({
      id: `apa-${idx++}`,
      type: "inline-apa",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.9,
      note: `Автор–год: ${inner}`,
    });
  }

  // Chicago numeric footnote markers like [1], [2] — body only
  const numericMatches = Array.from(text.matchAll(/\[(\d{1,3})\]/gu));
  for (const m of numericMatches) {
    const start = m.index ?? 0;
    if (!inBody(start)) continue;
    items.push({
      id: `num-${idx++}`,
      type: "inline-numeric",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.78,
      note: `Номер сноски: ${m[1]}`,
    });
  }

  // Ibid markers — body or footnotes
  for (const m of text.matchAll(IBID_RE)) {
    const start = m.index ?? 0;
    if (isInRange(start, ranges.bibliography)) continue;
    items.push({
      id: `ibid-${idx++}`,
      type: "ibid",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.99,
      note: "Маркер повторной ссылки",
    });
  }

  // Direct quotes with parenthetical — body only
  for (const m of text.matchAll(QUOTE_RE)) {
    const start = m.index ?? 0;
    if (!inBody(start)) continue;
    items.push({
      id: `quote-${idx++}`,
      type: "quote",
      text: m[0].length > 160 ? m[0].slice(0, 157) + "…" : m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.7,
      note: "Прямая цитата с указанием источника",
    });
  }

  // Bibliography section detection
  const bibStart = findSectionStart(text, [
    "Список литературы",
    "Библиография",
    "References",
    "Bibliography",
    "Литература",
  ]);
  if (bibStart >= 0) {
    const afterHeader = text.slice(bibStart);
    const lines = afterHeader.split("\n");
    let absoluteCursor = bibStart;
    // skip header line
    absoluteCursor += lines[0].length + 1;
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (trimmed.length > 25 && /[A-ZА-ЯЁ]/u.test(trimmed[0])) {
        items.push({
          id: `bib-${idx++}`,
          type: "bibliography",
          text: trimmed.length > 200 ? trimmed.slice(0, 197) + "…" : trimmed,
          line: getLineFromIndex(text, absoluteCursor),
          start: absoluteCursor,
          end: absoluteCursor + raw.length,
          confidence: 0.85,
          note: classifyBibEntry(trimmed),
        });
      }
      absoluteCursor += raw.length + 1;
    }
  }

  // Footnote section (lines starting "1.", "2.")
  const fnStart = findSectionStart(text, ["Сноски", "Примечания", "Notes", "Footnotes"]);
  if (fnStart >= 0) {
    const afterHeader = text.slice(fnStart);
    const lines = afterHeader.split("\n");
    let absoluteCursor = fnStart + lines[0].length + 1;
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (/^\d{1,3}\.\s+/.test(trimmed) && trimmed.length > 15) {
        items.push({
          id: `fn-${idx++}`,
          type: "footnote",
          text: trimmed.length > 200 ? trimmed.slice(0, 197) + "…" : trimmed,
          line: getLineFromIndex(text, absoluteCursor),
          start: absoluteCursor,
          end: absoluteCursor + raw.length,
          confidence: 0.88,
          note: "Развернутая сноска",
        });
      }
      // stop if we hit another section header
      if (/^(Библиография|Список литературы|References|Bibliography)\s*$/i.test(trimmed)) break;
      absoluteCursor += raw.length + 1;
    }
  }

  return items.sort((a, b) => a.start - b.start);
}

function findSectionStart(text: string, names: string[]): number {
  for (const name of names) {
    const re = new RegExp(`(^|\\n)\\s*${escapeRe(name)}\\s*(?=\\n|$)`, "iu");
    const m = re.exec(text);
    if (m) return (m.index ?? 0) + (m[1] ? m[1].length : 0);
  }
  return -1;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyBibEntry(entry: string): string {
  if (/\(\d{4}[a-z]?\)/.test(entry)) return "Похоже на APA";
  if (/,\s*\d{4}\.?\s*$/.test(entry)) return "Похоже на Chicago";
  if (/\.\s+[A-ZА-ЯЁ][^.]+\.\s+[A-ZА-ЯЁ][^.]+,\s+\d{4}/.test(entry)) return "Похоже на Chicago";
  return "Стиль неопределён";
}

// --- Style detection ------------------------------------------------------

export function detectStyle(text: string, found: FoundItem[]): StyleDetection {
  let apa = 0;
  let chicago = 0;
  const reasons: string[] = [];

  const apaInline = found.filter((f) => f.type === "inline-apa").length;
  const numeric = found.filter((f) => f.type === "inline-numeric").length;
  const footnotes = found.filter((f) => f.type === "footnote").length;
  const ibid = found.filter((f) => f.type === "ibid").length;
  const bib = found.filter((f) => f.type === "bibliography");

  if (apaInline > 0) {
    apa += apaInline * 2;
    reasons.push(`Найдено APA-вставок (Автор, год): ${apaInline}`);
  }
  if (numeric > 0) {
    chicago += numeric * 1.5;
    reasons.push(`Найдено числовых маркеров сносок: ${numeric}`);
  }
  if (footnotes > 0) {
    chicago += footnotes * 2;
    reasons.push(`Развёрнутых сносок: ${footnotes}`);
  }
  if (ibid > 0) {
    chicago += ibid * 1.5;
    reasons.push(`Маркеров «Ibid./Там же»: ${ibid}`);
  }
  const apaBib = bib.filter((b) => /Похоже на APA/.test(b.note || "")).length;
  const chBib = bib.filter((b) => /Похоже на Chicago/.test(b.note || "")).length;
  if (apaBib) {
    apa += apaBib;
    reasons.push(`APA-записей в библиографии: ${apaBib}`);
  }
  if (chBib) {
    chicago += chBib;
    reasons.push(`Chicago-записей в библиографии: ${chBib}`);
  }
  if (/Список литературы|References/i.test(text)) {
    apa += 1;
    reasons.push("Найден заголовок «Список литературы/References»");
  }
  if (/Сноски|Примечания|Bibliography/i.test(text)) {
    chicago += 1;
    reasons.push("Найден заголовок «Сноски/Bibliography»");
  }

  const total = apa + chicago;
  let style: CitationStyle = "Unknown";
  let confidence = 0;
  if (total > 0) {
    if (apa > chicago) {
      style = "APA";
      confidence = apa / total;
    } else if (chicago > apa) {
      style = "Chicago";
      confidence = chicago / total;
    } else {
      style = "Unknown";
      confidence = 0.5;
    }
  }

  return { style, confidence, reasons, scores: { apa, chicago } };
}

// --- Structure ------------------------------------------------------------

export function analyzeStructure(text: string): DocStructure {
  const lines = text.split("\n");
  const headings: DocStructure["headings"] = [];
  let paragraphs = 0;
  let prevBlank = true;

  const knownHeadings = [
    "введение",
    "методология",
    "результаты",
    "результаты и обсуждение",
    "обсуждение",
    "выводы",
    "заключение",
    "список литературы",
    "библиография",
    "references",
    "bibliography",
    "сноски",
    "примечания",
    "notes",
    "footnotes",
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed) {
      prevBlank = true;
      continue;
    }
    const isShort = trimmed.length < 90;
    const isMatchKnown = knownHeadings.includes(lower);
    const looksTitleCase = /^[A-ZА-ЯЁ]/.test(trimmed) && !/[.!?]$/.test(trimmed);
    if (isMatchKnown || (isShort && looksTitleCase && prevBlank && i === 0)) {
      headings.push({ line: i + 1, level: i === 0 ? 1 : 2, text: trimmed });
    } else {
      paragraphs += 1;
    }
    prevBlank = false;
  }

  const bib = findSectionRange(lines, ["Список литературы", "Библиография", "References", "Bibliography"]);
  const fn = findSectionRange(lines, ["Сноски", "Примечания", "Notes", "Footnotes"]);

  return {
    headings,
    paragraphs,
    bibliographySection: bib,
    footnotesSection: fn,
  };
}

function findSectionRange(lines: string[], names: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toLowerCase();
    if (names.some((n) => t === n.toLowerCase())) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const tt = lines[j].trim().toLowerCase();
        if (
          tt &&
          ["список литературы", "библиография", "references", "bibliography", "сноски", "примечания", "notes", "footnotes"].includes(tt) &&
          tt !== t
        ) {
          end = j;
          break;
        }
      }
      return { startLine: i + 1, endLine: end };
    }
  }
  return undefined;
}

// --- Editor (rule-based suggestions) --------------------------------------

const WEAK_WORDS = ["очень", "просто", "вообще", "достаточно", "несколько", "довольно", "наверное", "видимо", "как бы"];
const COLLOQUIAL = ["типа", "короче", "по сути", "на самом деле", "как-то", "вроде", "что-то типа"];
const VAGUE_POINTERS = ["это", "то", "тот", "та", "те", "данный", "вышеуказанный"];
const PASSIVE_HINTS = /\b(\S+?)(?:ется|ются|ется,|уются|ется\.|уется|ован|ована|овано|ованы)\b/gu;
const KANCEL = [
  ["в данном случае", "здесь"],
  ["в связи с тем что", "потому что"],
  ["в целях", "чтобы"],
  ["осуществлять", "делать"],
  ["производить", "делать"],
  ["в настоящее время", "сейчас"],
  ["в большинстве случаев", "обычно"],
  ["принимая во внимание", "учитывая"],
];
const REPETITION_STOP_WORDS = new Set([
  "который",
  "которая",
  "которое",
  "которые",
  "данных",
  "данные",
  "работы",
  "тексте",
  "исследования",
  "исследование",
  "документа",
  "документ",
  "автор",
  "авторы",
  "source",
  "references",
]);

export function findEditorIssues(text: string): EditorIssue[] {
  const issues: EditorIssue[] = [];
  let idx = 0;
  const lines = text.split("\n");

  // Sentence-based checks
  const sentenceRe = /[^.!?\n]+[.!?]+/gu;
  for (const m of text.matchAll(sentenceRe)) {
    const sentence = m[0].trim();
    const start = m.index ?? 0;
    const wordCount = sentence.split(/\s+/u).length;
    if (wordCount > 35) {
      issues.push({
        id: `iss-${idx++}`,
        type: "длинное-предложение",
        fragment: sentence.slice(0, 200),
        line: getLineFromIndex(text, start),
        start,
        end: start + sentence.length,
        suggestion: "Разделите на 2–3 более коротких предложения. Целевая длина — до 25 слов.",
      });
    }
  }

  // Weak words / colloquial / vague
  pushWordIssues(text, WEAK_WORDS, "слабая-формулировка", "Удалите модальную «вату» или замените на точную меру.", issues, () => idx++);
  pushWordIssues(text, COLLOQUIAL, "разговорный-маркер", "Замените разговорный оборот на нейтральный академический.", issues, () => idx++);

  // Passive (heuristic)
  for (const m of text.matchAll(PASSIVE_HINTS)) {
    const start = m.index ?? 0;
    const sentenceCtx = extractSentence(text, start);
    if (sentenceCtx.length < 8) continue;
    issues.push({
      id: `iss-${idx++}`,
      type: "пассив",
      fragment: sentenceCtx,
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      suggestion: "Рассмотрите активную конструкцию: укажите субъект действия.",
    });
  }

  // Vague pointers at sentence start
  const sentenceStartRe = /(?:^|[.!?]\s+|\n\s*)(Это|То|Тот|Эта|Эти|Данный|Вышеуказанный)\s+/gu;
  for (const m of text.matchAll(sentenceStartRe)) {
    const start = (m.index ?? 0) + m[0].indexOf(m[1]);
    issues.push({
      id: `iss-${idx++}`,
      type: "неопределённый-указатель",
      fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start),
      start,
      end: start + m[1].length,
      suggestion: "Уточните: «Это решение», «Этот результат» — назовите явление, чтобы избежать неопределённости.",
    });
  }

  // Repetition: ignore citation spans and bibliographic/footnote entries so that
  // "Smith ... (Smith, 2019)" is not treated as a stylistic repetition.
  const sectionRanges = detectSectionRanges(text);
  const citationRanges = findCitations(text)
    .filter((item) => item.type !== "inline-numeric")
    .map((item) => ({ start: item.start, end: item.end }));
  const tokens: { word: string; original: string; start: number }[] = [];
  for (const m of text.matchAll(/[А-Яа-яЁёA-Za-z]{5,}/gu)) {
    const start = m.index ?? 0;
    const original = m[0];
    if (citationRanges.some((range) => start >= range.start && start < range.end)) continue;
    if (isInRange(start, sectionRanges.footnotes)) continue;
    if (isInRange(start, sectionRanges.bibliography)) continue;
    if (REPETITION_STOP_WORDS.has(original.toLowerCase())) continue;
    // Proper names are normal in academic prose; do not flag them as repetitions.
    if (/^[A-ZА-ЯЁ]/u.test(original)) continue;
    tokens.push({ word: original.toLowerCase(), original, start });
  }
  const seen: Map<string, number[]> = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const previous = (seen.get(t.word) || []).filter((tokenIndex) => i - tokenIndex < 35);
    if (previous.length >= 2) {
      issues.push({
        id: `iss-${idx++}`,
        type: "повтор",
        fragment: extractSentence(text, t.start),
        line: getLineFromIndex(text, t.start),
        start: t.start,
        end: t.start + t.word.length,
        suggestion: `Слово «${t.word}» повторяется несколько раз рядом. Проверьте, не нужна ли замена или перестройка фразы.`,
      });
    }
    previous.push(i);
    seen.set(t.word, previous);
  }

  // Канцелярит
  for (const [phrase, replacement] of KANCEL) {
    const re = new RegExp(escapeRe(phrase), "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      issues.push({
        id: `iss-${idx++}`,
        type: "канцелярит",
        fragment: extractSentence(text, start),
        line: getLineFromIndex(text, start),
        start,
        end: start + m[0].length,
        suggestion: `Замените на «${replacement}».`,
      });
    }
  }

  // Punctuation: double spaces, space before punctuation
  for (const m of text.matchAll(/  +/gu)) {
    const start = m.index ?? 0;
    issues.push({
      id: `iss-${idx++}`,
      type: "пунктуация",
      fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      suggestion: "Удалите лишние пробелы.",
    });
  }
  for (const m of text.matchAll(/\s+([,.;:!?])/gu)) {
    const start = m.index ?? 0;
    issues.push({
      id: `iss-${idx++}`,
      type: "пунктуация",
      fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      suggestion: "Уберите пробел перед знаком препинания.",
    });
  }

  // Deduplicate by (type+start)
  const dedup = new Map<string, EditorIssue>();
  for (const it of issues) dedup.set(`${it.type}:${it.start}`, it);
  return Array.from(dedup.values()).sort((a, b) => a.start - b.start);
}

function pushWordIssues(
  text: string,
  words: string[],
  type: EditorIssue["type"],
  suggestion: string,
  out: EditorIssue[],
  nextId: () => number
) {
  for (const w of words) {
    const re = new RegExp(`\\b${escapeRe(w)}\\b`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      out.push({
        id: `iss-${nextId()}`,
        type,
        fragment: extractSentence(text, start),
        line: getLineFromIndex(text, start),
        start,
        end: start + m[0].length,
        suggestion,
      });
    }
  }
}

function extractSentence(text: string, idx: number): string {
  const left = text.slice(0, idx);
  const right = text.slice(idx);
  const leftStart = Math.max(left.lastIndexOf("."), left.lastIndexOf("!"), left.lastIndexOf("?"), left.lastIndexOf("\n"));
  const rightEnd = right.search(/[.!?\n]/);
  const start = leftStart < 0 ? 0 : leftStart + 1;
  const end = rightEnd < 0 ? text.length : idx + rightEnd + 1;
  return text.slice(start, end).trim().slice(0, 220);
}


// --- Citation conversion --------------------------------------------------
// Demo conversion: APA <-> Chicago (bibliography & inline). Heuristic, not authoritative.

export interface ConversionChange {
  type: "inline" | "bibliography";
  before: string;
  after: string;
  line: number;
  start: number;
  end: number;
  note: string;
}

export interface ConversionResult {
  target: CitationStyle;
  changes: ConversionChange[];
  preview: string; // full text with replacements applied
}

interface ParsedReference {
  author: string;
  year: string;
  title: string;
  source: string;
}

const APA_BIB_RE =
  /^([A-ZА-ЯЁ][^.]+?)\s*\((\d{4}[a-z]?)\)\.\s*(.+?)\.\s*(.+?)$/u;

const CHICAGO_BIB_RE =
  /^([A-ZА-ЯЁ][^.]+?)\.\s*(.+?)\.\s*([^,]+?),\s*(\d{4}[a-z]?)\.?$/u;

export function convertCitations(text: string, target: CitationStyle, customRules?: CustomCitationRules): ConversionResult {
  if (target === "Custom" && customRules) {
    return convertCustomCitations(text, customRules);
  }
  if (!["APA", "Chicago", "MLA", "IEEE", "Vancouver", "Harvard", "GOST"].includes(target)) {
    return { target, changes: [], preview: text };
  }
  const changes: ConversionChange[] = [];
  const lines = text.split("\n");
  let cursor = 0;

  // Inline transformations
  let working = text;
  const inlineChanges: ConversionChange[] = [];
  if (["Chicago", "IEEE", "Vancouver", "GOST"].includes(target)) {
    // (Author, 2020) -> numeric reference marker
    let counter = 1;
    working = working.replace(APA_INLINE_GROUP, (match, _inner, offset) => {
      const start = offset as number;
      const replacement = `[${counter}]`;
      inlineChanges.push({
        type: "inline",
        before: match,
        after: replacement,
        line: getLineFromIndex(text, start),
        start,
        end: start + match.length,
        note: `Автор–год → числовой маркер [${counter}] для стиля ${target}. Проверьте соответствующую запись в списке литературы.`,
      });
      counter++;
      return replacement;
    });
  } else if (["APA", "MLA", "Harvard"].includes(target)) {
    // Numeric [n] -> author-date placeholder
    let n = 1;
    working = working.replace(/\[(\d{1,3})\]/gu, (match, _num, offset) => {
      const start = offset as number;
      const replacement = target === "MLA" ? `(Автор стр.)` : `(Автор, г.)`;
      inlineChanges.push({
        type: "inline",
        before: match,
        after: replacement,
        line: getLineFromIndex(text, start),
        start,
        end: start + match.length,
        note: `Числовая сноска [${n}] → ${target}. Подставьте автора, год или страницу из библиографии.`,
      });
      n++;
      return replacement;
    });
  }

  // Bibliography line transformations
  const workingLines = working.split("\n");
  let absoluteOffset = 0;
  const inBib = false;
  let bibState = false;
  for (let i = 0; i < workingLines.length; i++) {
    const line = workingLines[i];
    const trimmed = line.trim();
    if (/^(Список литературы|Библиография|References|Bibliography)\s*$/i.test(trimmed)) {
      bibState = true;
    } else if (bibState && trimmed && trimmed.length > 25) {
      const converted = convertBibEntry(trimmed, target);
      if (converted && converted !== trimmed) {
        const startInLine = line.indexOf(trimmed);
        const start = absoluteOffset + startInLine;
        inlineChanges.push({
          type: "bibliography",
          before: trimmed,
          after: converted,
          line: i + 1,
          start,
          end: start + trimmed.length,
          note: `Запись преобразована в стиль ${target}.`,
        });
        workingLines[i] = line.replace(trimmed, converted);
      }
    }
    absoluteOffset += line.length + 1;
  }

  return {
    target,
    changes: inlineChanges,
    preview: workingLines.join("\n"),
  };
}

function convertBibEntry(entry: string, target: CitationStyle): string | null {
  const parsed = parseReference(entry);
  if (!parsed) return null;

  const formatted = formatReference(parsed, target);
  return formatted === entry ? null : formatted;
}

function parseReference(entry: string): ParsedReference | null {
  const apaMatch = APA_BIB_RE.exec(entry);
  if (apaMatch) {
    const [, author, year, title, source] = apaMatch;
    return { author: author.trim(), year, title: title.trim(), source: source.trim() };
  }
  const chicagoMatch = CHICAGO_BIB_RE.exec(entry);
  if (chicagoMatch) {
    const [, author, title, source, year] = chicagoMatch;
    return { author: author.trim(), year, title: title.trim(), source: source.trim() };
  }
  return null;
}

function formatReference(ref: ParsedReference, target: CitationStyle): string {
  switch (target) {
    case "APA":
      return `${ref.author} (${ref.year}). ${ref.title}. ${ref.source}.`;
    case "Chicago":
      return `${ref.author}. ${ref.title}. ${ref.source}, ${ref.year}.`;
    case "MLA":
      return `${ref.author}. ${ref.title}. ${ref.source}, ${ref.year}.`;
    case "IEEE":
      return `${ref.author}, "${ref.title}," ${ref.source}, ${ref.year}.`;
    case "Vancouver":
      return `${ref.author}. ${ref.title}. ${ref.source}. ${ref.year}.`;
    case "Harvard":
      return `${ref.author} ${ref.year}, ${ref.title}, ${ref.source}.`;
    case "GOST":
      return `${ref.author} ${ref.title}. — ${ref.source}, ${ref.year}.`;
    default:
      return `${ref.author} (${ref.year}). ${ref.title}. ${ref.source}.`;
  }
}

function applyTemplate(template: string, ref: ParsedReference, index: number): string {
  return template
    .replaceAll("{author}", ref.author || "Автор")
    .replaceAll("{year}", ref.year || "г.")
    .replaceAll("{title}", ref.title || "Название")
    .replaceAll("{source}", ref.source || "Источник")
    .replaceAll("{n}", String(index));
}

function convertCustomCitations(text: string, rules: CustomCitationRules): ConversionResult {
  const changes: ConversionChange[] = [];
  let counter = 1;
  let working = text;
  const inlineTemplate =
    rules.mode === "numeric" ? (rules.inlineTemplate || "[{n}]") :
    rules.mode === "footnote" ? (rules.inlineTemplate || "[{n}]") :
    (rules.inlineTemplate || "({author}, {year})");

  working = working.replace(APA_INLINE_GROUP, (match, inner, offset) => {
    const authorYear = String(inner).split(";")[0].match(/(.+?),\s*(\d{4}[a-z]?)/u);
    const ref: ParsedReference = {
      author: authorYear?.[1]?.trim() || "Автор",
      year: authorYear?.[2] || "г.",
      title: "Название",
      source: "Источник",
    };
    const replacement = applyTemplate(inlineTemplate, ref, counter);
    changes.push({
      type: "inline",
      before: match,
      after: replacement,
      line: getLineFromIndex(text, offset as number),
      start: offset as number,
      end: (offset as number) + match.length,
      note: `Внутритекстовая ссылка преобразована по авторскому правилу «${rules.name || "Пользовательский стиль"}».`,
    });
    counter++;
    return replacement;
  });

  working = working.replace(/\[(\d{1,3})\]/gu, (match, num, offset) => {
    const ref: ParsedReference = { author: "Автор", year: "г.", title: "Название", source: "Источник" };
    const replacement = applyTemplate(inlineTemplate, ref, Number(num) || counter);
    changes.push({
      type: "inline",
      before: match,
      after: replacement,
      line: getLineFromIndex(text, offset as number),
      start: offset as number,
      end: (offset as number) + match.length,
      note: "Числовой маркер преобразован по авторскому правилу.",
    });
    counter++;
    return replacement;
  });

  const lines = working.split("\n");
  let absoluteOffset = 0;
  let bibState = false;
  const bibTemplate = rules.bibliographyTemplate || "{author}. {title}. {source}, {year}.";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^(Список литературы|Библиография|References|Bibliography|Литература)\s*$/i.test(trimmed)) {
      bibState = true;
    } else if (bibState && trimmed.length > 25) {
      const parsed = parseReference(trimmed);
      if (parsed) {
        const replacement = applyTemplate(bibTemplate, parsed, i + 1);
        const start = absoluteOffset + line.indexOf(trimmed);
        changes.push({
          type: "bibliography",
          before: trimmed,
          after: replacement,
          line: i + 1,
          start,
          end: start + trimmed.length,
          note: "Библиографическая запись преобразована по авторскому шаблону.",
        });
        lines[i] = line.replace(trimmed, replacement);
      }
    }
    absoluteOffset += line.length + 1;
  }

  return { target: "Custom", changes, preview: lines.join("\n") };
}
