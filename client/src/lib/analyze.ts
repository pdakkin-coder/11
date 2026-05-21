// Analysis library for CitaDex
// All logic is heuristic; AI-assisted path available via /api/ai-analyze

/**
 * Citation style labels used throughout the app.
 * Keep in sync with CitationStyle type below.
 */
export type CitationStyle =
  | "APA"
  | "Chicago"
  | "MLA"
  | "IEEE"
  | "Vancouver"
  | "Harvard"
  | "GOST"
  | "Custom"
  | "Unknown";

export interface FoundItem {
  id: string;
  type:
    | "inline-apa"
    | "inline-numeric"
    | "footnote"
    | "bibliography"
    | "ibid"
    | "quote";
  text: string;
  start: number;
  end: number;
  line: number;
  confidence?: number;
  note?: string;
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
  text: string;
  start: number;
  end: number;
  line: number;
  suggestion?: string;
}

export interface CustomCitationRules {
  name: string;
  mode: "author-date" | "numeric" | "footnote";
  inlineTemplate: string;
  bibliographyTemplate: string;
  footnoteTemplate: string;
  separator: string;
}

export interface SourceTypeTemplate {
  id: string;
  label: string;
  fields: string[];
  apaTemplate: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BIBLIOGRAPHY_HEADERS = [
  "Список литературы",
  "Список цитированной литературы",
  "Библиография",
  "Литература",
  "Использованная литература",
  "Источники и литература",
  "Список источников",
  "Список использованных источников",
  "References",
  "Bibliography",
  "Works Cited",
  "Works consulted",
  "List of References",
  "Sources",
];

const FOOTNOTE_HEADERS = [
  "Сноски",
  "Примечания",
  "Комментарии",
  "Notes",
  "Footnotes",
  "Endnotes",
  "Note",
];

// ---------------------------------------------------------------------------
// Source type templates (for SourceTypeBuilder UI)
// ---------------------------------------------------------------------------

export const DEFAULT_SOURCE_TYPES: SourceTypeTemplate[] = [
  {
    id: "journal",
    label: "Статья в журнале",
    fields: ["author", "year", "title", "journal", "volume", "issue", "pages", "doi"],
    apaTemplate:
      "{author} ({year}). {title}. {journal}, {volume}({issue}), {pages}. https://doi.org/{doi}",
  },
  {
    id: "book",
    label: "Книга",
    fields: ["author", "year", "title", "publisher", "place"],
    apaTemplate: "{author} ({year}). {title}. {publisher}.",
  },
  {
    id: "chapter",
    label: "Глава в сборнике",
    fields: ["author", "year", "title", "editor", "bookTitle", "pages", "publisher"],
    apaTemplate:
      "{author} ({year}). {title}. In {editor} (Ed.), {bookTitle} (pp. {pages}). {publisher}.",
  },
  {
    id: "web",
    label: "Веб-источник",
    fields: ["author", "year", "title", "url", "accessed"],
    apaTemplate: "{author} ({year}). {title}. Retrieved {accessed}, from {url}",
  },
  {
    id: "thesis",
    label: "Диссертация",
    fields: ["author", "year", "title", "type", "institution"],
    apaTemplate: "{author} ({year}). {title} [{type}]. {institution}.",
  },
  {
    id: "report",
    label: "Отчёт / рабочий документ",
    fields: ["author", "year", "title", "number", "institution"],
    apaTemplate: "{author} ({year}). {title} (Report No. {number}). {institution}.",
  },
  {
    id: "conference",
    label: "Материалы конференции",
    fields: ["author", "year", "title", "conference", "pages", "place"],
    apaTemplate: "{author} ({year}). {title}. In {conference} (pp. {pages}). {place}.",
  },
  {
    id: "newspaper",
    label: "Газетная статья",
    fields: ["author", "year", "title", "newspaper", "date", "pages"],
    apaTemplate: "{author} ({year}, {date}). {title}. {newspaper}, {pages}.",
  },
];

export const SOURCE_TYPE_FIELD_LABELS: Record<string, string> = {
  author:     "Автор(ы)",
  year:       "Год",
  title:      "Название",
  journal:    "Журнал",
  volume:     "Том",
  issue:      "Выпуск",
  pages:      "Страницы",
  doi:        "DOI",
  publisher:  "Издательство",
  place:      "Место издания",
  editor:     "Редактор(ы)",
  bookTitle:  "Название сборника",
  url:        "URL",
  accessed:   "Дата обращения",
  type:       "Тип (дисс. / thesis)",
  institution:"Учреждение",
  number:     "Номер отчёта",
  conference: "Конференция",
  date:       "Дата публикации",
  newspaper:  "Газета",
};

export function renderSourceTemplate(
  template: SourceTypeTemplate,
  fields: Record<string, string>,
): string {
  let out = template.apaTemplate;
  for (const [k, v] of Object.entries(fields)) {
    out = out.replaceAll(`{${k}}`, v || `[${k}]`);
  }
  out = out.replace(/\{[a-zA-Z]+\}/g, "");
  return out.trim();
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

function detectLanguage(text: string): "ru" | "en" | "mixed" {
  const ruChars = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const enChars = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const total = ruChars + enChars;
  if (!total) return "ru";
  const ratio = ruChars / total;
  return ratio > 0.7 ? "ru" : ratio < 0.3 ? "en" : "mixed";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineOf(text: string, pos: number): number {
  return text.slice(0, pos).split("\n").length;
}

let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}

/** Check if a position is already covered by an existing found item */
function overlaps(found: FoundItem[], start: number, end: number): boolean {
  return found.some((f) => start < f.end && end > f.start);
}

// ---------------------------------------------------------------------------
// Citation finders
// ---------------------------------------------------------------------------

/**
 * Main heuristic citation finder.
 * Improvements over previous version:
 *  - GOST initials pattern: Иванов И.И.,
 *  - Markdown footnotes: [^1] and ^[1]
 *  - Vancouver false-positive fix: skip pure year parens (1999)
 *  - Footnote: detect * and — prefixed lines as footnote markers
 *  - isBibEntryLine: DOI signal + GOST М./СПб. pattern
 */
export function findCitations(text: string): FoundItem[] {
  const found: FoundItem[] = [];

  // ── 1. APA inline: (Author, Year) or (Author & Author, Year) ────────────
  const apaInline =
    /\((?:[A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*(?:,?\s+et al\.?)?),?\s{0,2}(?:19|20)\d{2}(?:[a-z])?(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu;
  for (const m of text.matchAll(apaInline)) {
    const s = m.index!;
    found.push({
      id: nextId("apa"),
      type: "inline-apa",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.9,
    });
  }

  // ── 2. Harvard inline: (Author Year) without comma ──────────────────────
  const harvardInline =
    /\([A-ZА-ЯЁ][a-zа-яё]+(?:\s+et al\.?)?\s+(?:19|20)\d{2}(?:,\s*p\.\s*\d+)?\)/gu;
  for (const m of text.matchAll(harvardInline)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("harvard"),
      type: "inline-apa",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.85,
      note: "Harvard style",
    });
  }

  // ── 3. GOST inline with initials: [Иванов И.И., 2020, с. 5] ────────────
  const gostInitials =
    /\[[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.(?:,\s*(?:19|20)\d{2})?(?:,\s*с\.\s*\d+(?:[–—-]\d+)?)?\]/gu;
  for (const m of text.matchAll(gostInitials)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("gost-init"),
      type: "inline-numeric",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.9,
      note: "GOST initials",
    });
  }

  // ── 4. GOST/IEEE numeric: [1] [1, с. 12] [1–3] ──────────────────────────
  const gostInline =
    /\[\d+(?:[–—,–]\s*\d+)*(?:,\s*(?:с\.|p\.)\s*\d+(?:[–—-]\d+)?)?\]/gu;
  for (const m of text.matchAll(gostInline)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("num"),
      type: "inline-numeric",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.9,
    });
  }

  // ── 5. Markdown footnote refs: [^1] or ^[1] ─────────────────────────────
  const mdFootnote = /\[\^\d+\]|\^\[\d+\]/gu;
  for (const m of text.matchAll(mdFootnote)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("md-fn"),
      type: "footnote",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.95,
      note: "Markdown footnote",
    });
  }

  // ── 6. Vancouver numeric: (1) (2,3) (5–7) — skip pure year parens ───────
  const vancouverInline = /\(\d+(?:[,;]\s*\d+)*(?:[–—-]\d+)?\)/gu;
  for (const m of text.matchAll(vancouverInline)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    // False-positive guard: skip (YYYY) — standalone year parenthetical
    if (/^\((?:19|20)\d{2}\)$/.test(m[0])) continue;
    // Skip single small numbers that look like (1) in non-citation context
    // only if surrounded by word chars (e.g. "step (1)" vs citation)
    found.push({
      id: nextId("van"),
      type: "inline-numeric",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.8,
      note: "Vancouver/numeric",
    });
  }

  // ── 7. Chicago superscript: .[1] ────────────────────────────────────────
  const chicagoRef = /\.\[\d+\]/gu;
  for (const m of text.matchAll(chicagoRef)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("ch"),
      type: "inline-numeric",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.85,
      note: "Chicago",
    });
  }

  // ── 8. MLA page ref: (142) (pp. 88–90) ──────────────────────────────────
  const mlaInline = /\((?:pp?\.\s*)?\d{1,4}(?:[–—-]\d{1,4})?\)/gu;
  for (const m of text.matchAll(mlaInline)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("mla"),
      type: "inline-numeric",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.75,
      note: "MLA page ref",
    });
  }

  // ── 9. Ibid / Там же ─────────────────────────────────────────────────────
  const ibid = /\b(?:Ibid\.?|Там же|там же|ibidem)\b/gu;
  for (const m of text.matchAll(ibid)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("ibid"),
      type: "ibid",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.95,
    });
  }

  // ── 10. Direct quotes ────────────────────────────────────────────────────
  const quotePatterns: RegExp[] = [
    /«[^»]{10,300}»/gu,
    /\u201c[^\u201d]{10,300}\u201d/gu,
    /"[A-ZА-ЯЁ][^"]{15,300}"/gu,
  ];
  for (const re of quotePatterns) {
    for (const m of text.matchAll(re)) {
      const s = m.index!;
      if (overlaps(found, s, s + m[0].length)) continue;
      found.push({
        id: nextId("q"),
        type: "quote",
        text: m[0],
        start: s,
        end: s + m[0].length,
        line: lineOf(text, s),
        confidence: 0.85,
      });
    }
  }

  // ── 11. Custom {Author Year:page} ────────────────────────────────────────
  const customInline = /\{[A-ZА-ЯЁ][a-zа-яё]+\s+(?:19|20)\d{2}(?::\s*\d+)?\}/gu;
  for (const m of text.matchAll(customInline)) {
    const s = m.index!;
    if (overlaps(found, s, s + m[0].length)) continue;
    found.push({
      id: nextId("cust"),
      type: "inline-apa",
      text: m[0],
      start: s,
      end: s + m[0].length,
      line: lineOf(text, s),
      confidence: 0.8,
      note: "Custom/author style",
    });
  }

  // ── 12. Footnote entries (lines at start) ────────────────────────────────
  const lines = text.split("\n");
  let lineStart = 0;
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const trimmed = raw.trimStart();
    const indent = raw.length - trimmed.length;

    // Pattern A: digit+dot/paren footnote line
    if (
      /^\d+[.)\s]\s+\S/.test(trimmed) &&
      trimmed.length > 20 &&
      !overlaps(found, lineStart, lineStart + raw.length)
    ) {
      const s = lineStart + indent;
      found.push({
        id: nextId("fn"),
        type: "footnote",
        text: trimmed,
        start: s,
        end: lineStart + raw.length,
        line: li + 1,
        confidence: 0.8,
      });
    }

    // Pattern B: * or — prefixed footnote/endnote lines
    if (
      /^[*—–]\s+\S/.test(trimmed) &&
      trimmed.length > 20 &&
      !overlaps(found, lineStart, lineStart + raw.length)
    ) {
      const s = lineStart + indent;
      found.push({
        id: nextId("fn-marker"),
        type: "footnote",
        text: trimmed,
        start: s,
        end: lineStart + raw.length,
        line: li + 1,
        confidence: 0.75,
        note: "Dash/asterisk footnote",
      });
    }

    // Pattern C: Unicode superscript markers ¹²³…
    for (const m of raw.matchAll(/[¹²³⁴⁵⁶⁷⁸⁹]/gu)) {
      const s = lineStart + m.index!;
      found.push({
        id: nextId("sup"),
        type: "footnote",
        text: m[0],
        start: s,
        end: s + 1,
        line: li + 1,
        confidence: 0.7,
        note: "Superscript marker",
      });
    }

    lineStart += raw.length + 1;
  }

  // ── 13. Bibliography entries ──────────────────────────────────────────────
  lineStart = 0;
  let inBibSection = false;
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const trimmed = raw.trim();
    if (BIBLIOGRAPHY_HEADERS.some((h) => h.toLowerCase() === trimmed.toLowerCase())) {
      inBibSection = true;
    }
    if (inBibSection && trimmed.length > 30 && isBibEntryLine(trimmed)) {
      const s = lineStart;
      if (!found.some((f) => f.start === s)) {
        found.push({
          id: nextId("bib"),
          type: "bibliography",
          text: trimmed,
          start: s,
          end: lineStart + raw.length,
          line: li + 1,
          confidence: 0.85,
        });
      }
    }
    lineStart += raw.length + 1;
  }

  return found.sort((a, b) => a.start - b.start);
}

function isBibEntryLine(line: string): boolean {
  if (line.length < 30) return false;
  // Must start with capital letter, digit, or opening bracket
  if (!/^[A-ZА-ЯЁ\[\d]/.test(line)) return false;
  let signals = 0;
  if (/\b(19|20)\d{2}\b/.test(line)) signals++;
  if (/\b[pP]p?\.\s*\d|С\.\s*\d|стр\.\s*\d|\d+\s*[–—-]\s*\d+/.test(line)) signals++;
  if (/https?:\/\//.test(line)) signals++;
  if (/[A-ZА-ЯЁ][a-zа-яё]{2,}[,:]/.test(line)) signals++;
  if (/\.\s+[A-ZА-ЯЁ]/.test(line)) signals++;
  // GOST: DOI signal
  if (/\bDOI:\s*10\./.test(line)) signals++;
  // GOST: place of publication pattern (М.:, СПб.:)
  if (/[–—]\s*[МСПб]{1,3}\.\s*:/u.test(line)) signals++;
  // ГОСТ: [Электронный ресурс]
  if (/\[Электронный ресурс\]/.test(line)) signals++;
  return signals >= 2;
}

// ---------------------------------------------------------------------------
// Style detection
// ---------------------------------------------------------------------------

interface StyleScore {
  style: string;
  score: number;
}

export function detectStyle(
  text: string,
  found: FoundItem[],
): { style: CitationStyle; confidence: number; scores: StyleScore[]; notes: string[] } {
  const scores: StyleScore[] = [];
  const notes: string[] = [];

  const apaCount      = found.filter((f) => f.type === "inline-apa").length;
  const numCount      = found.filter((f) => f.type === "inline-numeric").length;
  const ibidCount     = found.filter((f) => f.type === "ibid").length;
  const bibCount      = found.filter((f) => f.type === "bibliography").length;
  const footnoteCount = found.filter((f) => f.type === "footnote").length;

  // APA
  let apaScore = 0;
  apaScore += Math.min(apaCount * 0.15, 0.5);
  apaScore += Math.min(bibCount * 0.08, 0.3);
  if (/\(\w+(?:\s*&\s*\w+)?(?:,\s*et al\.?)?\s*,\s*(?:19|20)\d{2}/.test(text)) apaScore += 0.15;
  if (/\bDOI:\s*10\./.test(text)) apaScore += 0.05;
  scores.push({ style: "APA", score: Math.min(apaScore, 1) });

  // Chicago
  let chicagoScore = 0;
  chicagoScore += Math.min(ibidCount * 0.2, 0.4);
  chicagoScore += Math.min(footnoteCount * 0.1, 0.3);
  if (/\.\[\d+\]/.test(text)) chicagoScore += 0.2;
  if (/\bIbid\./.test(text)) chicagoScore += 0.15;
  scores.push({ style: "Chicago", score: Math.min(chicagoScore, 1) });

  // MLA
  let mlaScore = 0;
  mlaScore += Math.min(found.filter((f) => f.note === "MLA page ref").length * 0.15, 0.45);
  if (/Works Cited/i.test(text)) { mlaScore += 0.3; notes.push("Найден раздел Works Cited"); }
  if (/\(\w+\s+\d{1,4}\)/.test(text)) mlaScore += 0.1;
  scores.push({ style: "MLA", score: Math.min(mlaScore, 1) });

  // IEEE
  let ieeeScore = 0;
  if (/\[\d+\]/.test(text)) ieeeScore += 0.25;
  ieeeScore += Math.min(found.filter((f) => f.note === "Chicago" || f.type === "inline-numeric").length * 0.1, 0.3);
  if (/IEEE|Trans\.|Proc\./.test(text)) ieeeScore += 0.2;
  scores.push({ style: "IEEE", score: Math.min(ieeeScore, 1) });

  // Vancouver
  let vanScore = 0;
  vanScore += Math.min(found.filter((f) => f.note === "Vancouver/numeric").length * 0.12, 0.4);
  if (/Lancet|NEJM|BMJ|Ann Rheum/.test(text)) { vanScore += 0.25; notes.push("Медицинское издание"); }
  if (/\(\d+(?:[,;]\s*\d+)*\)/.test(text)) vanScore += 0.1;
  scores.push({ style: "Vancouver", score: Math.min(vanScore, 1) });

  // Harvard
  let harvardScore = 0;
  harvardScore += Math.min(found.filter((f) => f.note === "Harvard style").length * 0.15, 0.45);
  if (/[Hh]arvard/.test(text)) harvardScore += 0.1;
  if (/,\s*vol\.\s*\d+,\s*no\.\s*\d+,\s*pp\./.test(text)) harvardScore += 0.2;
  scores.push({ style: "Harvard", score: Math.min(harvardScore, 1) });

  // GOST — improved scoring
  let gostScore = 0;
  gostScore += Math.min(found.filter((f) => f.type === "inline-numeric").length * 0.1, 0.3);
  gostScore += Math.min(found.filter((f) => f.note === "GOST initials").length * 0.2, 0.4);
  if (/[–—]\s*[МСПб]{1,3}\.\s*:/u.test(text))   { gostScore += 0.3; notes.push("ГОСТ: место изд. М./СПб."); }
  if (/ГОСТ|Собрание законодательства/.test(text)) gostScore += 0.2;
  if (/\[Электронный ресурс\]/.test(text))        { gostScore += 0.25; notes.push("ГОСТ: [Электронный ресурс]"); }
  if (/Вопросы государственного/.test(text))       gostScore += 0.1;
  scores.push({ style: "GOST", score: Math.min(gostScore, 1) });

  // Custom
  let customScore = 0;
  if (/\{[A-ZА-ЯЁ][a-zа-яё]+\s+(?:19|20)\d{2}/.test(text)) {
    customScore += 0.5;
    notes.push("Нестандартный формат {Автор Год}");
  }
  scores.push({ style: "Custom", score: Math.min(customScore, 1) });

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best   = sorted[0];
  const second = sorted[1];
  const confidence = best.score > 0
    ? Math.min((best.score - (second?.score ?? 0) + 0.1) * 1.5, 1)
    : 0;

  if (apaCount > 0)      notes.push(`APA-вставок: ${apaCount}`);
  if (ibidCount > 0)     notes.push(`Ibid/Там же: ${ibidCount}`);
  if (numCount > 0)      notes.push(`Числовых ссылок: ${numCount}`);

  return {
    style: (best.score > 0.05 ? best.style : "Unknown") as CitationStyle,
    confidence,
    scores: sorted,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Citation converter
// ---------------------------------------------------------------------------

export function convertCitations(
  text: string,
  target: CitationStyle,
  customRules: CustomCitationRules,
): { text: string; converted: number; warnings: string[] } {
  let out = text;
  let converted = 0;
  const warnings: string[] = [];

  switch (target) {
    case "APA": {
      out = out.replace(/\[(\d+)\]/g, (_m, n) => { converted++; return `(Source ${n}, 2020)`; });
      out = out.replace(/\.\[(\d+)\]/g, (_m, n) => { converted++; return ` (Source ${n}, 2020).`; });
      break;
    }
    case "Chicago": {
      out = out.replace(
        /\(([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*)?,?\s*((?:19|20)\d{2}[a-z]?)\)/gu,
        (_m, author, year) => { converted++; return `${author || "Author"}, ${year}.`; },
      );
      break;
    }
    case "MLA": {
      out = out.replace(
        /\(([A-ZА-ЯЁ][a-zа-яё]+)(?:,\s*et al\.?)?\s*,?\s*(?:19|20)\d{2}[a-z]?(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        (_m, author) => { converted++; return `(${author} 00)`; },
      );
      break;
    }
    case "IEEE": {
      let n = 1;
      out = out.replace(
        /\([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*(?:,?\s*et al\.?)?\s*,?\s*(?:19|20)\d{2}[a-z]?(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        () => { converted++; return `[${n++}]`; },
      );
      break;
    }
    case "Vancouver": {
      let n = 1;
      out = out.replace(
        /\([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*(?:,?\s*et al\.?)?\s*,?\s*(?:19|20)\d{2}[a-z]?(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        () => { converted++; return `(${n++})`; },
      );
      break;
    }
    case "Harvard": {
      out = out.replace(
        /\(([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*)?,?\s*((?:19|20)\d{2}[a-z]?)(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        (_m, author, year) => { converted++; return `(${author || "Author"} ${year})`; },
      );
      break;
    }
    case "GOST": {
      let n = 1;
      out = out.replace(
        /\([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*(?:,?\s*et al\.?)?\s*,?\s*(?:19|20)\d{2}[a-z]?(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        () => { converted++; return `[${n++}]`; },
      );
      break;
    }
    case "Custom": {
      const tpl = customRules.inlineTemplate;
      let n = 1;
      out = out.replace(
        /\([A-ZА-ЯЁ][a-zа-яё]+(?:[,\s&]+[A-ZА-ЯЁ][a-zа-яё]+)*(?:,?\s*et al\.?)?\s*,?\s*((?:19|20)\d{2}[a-z]?)(?:,\s*(?:с\.|p\.|pp\.)\s*\d+(?:[–—-]\d+)?)?\)/gu,
        (_m, year) => {
          converted++;
          return tpl
            .replace("{author}", "Author")
            .replace("{year}", year)
            .replace("{n}", String(n++));
        },
      );
      break;
    }
    default:
      break;
  }

  if (converted === 0) {
    warnings.push(
      "Не удалось автоматически преобразовать цитаты. " +
      "Возможно, документ уже использует целевой стиль или формат не распознан.",
    );
  }

  return { text: out, converted, warnings };
}

// ---------------------------------------------------------------------------
// Structure analysis
// ---------------------------------------------------------------------------

export function analyzeStructure(text: string): ReturnType<typeof buildStructure> {
  return buildStructure(text);
}

const HEADING_KEYWORDS = new Set([
  "введение", "заключение", "выводы", "обсуждение",
  "методология", "метод", "методы", "методика",
  "результаты", "результаты и обсуждение",
  "теоретические основы", "обзор литературы",
  "список литературы", "список цитированной литературы",
  "библиография", "литература", "использованная литература",
  "источники и литература", "список источников",
  "примечания", "сноски", "комментарии",
  "references", "bibliography", "works cited", "works consulted",
  "notes", "footnotes", "endnotes", "introduction", "conclusion",
  "methods", "methodology", "results", "discussion",
  "abstract", "аннотация", "резюме",
]);

function classifyHeading(line: string): number | null {
  if (!line || line.length > 120 || line.length < 3) return null;
  if (/^(#{1,6})\s+/.test(line)) return line.match(/^(#{1,6})/)?.[1].length ?? 1;
  if (/^\d+\.(\d+\.)*\s+[A-ZА-ЯЁ]/u.test(line)) {
    if (/^\d+\.\s+[A-ZА-ЯЁ][a-zа-яё]+(,|\s+[A-ZА-ЯЁ]\.)/.test(line)) return null;
    return 2;
  }
  if (/^[A-ZА-ЯЁ][A-ZА-ЯЁ\s-]{4,}$/u.test(line)) return 1;
  if (/[.!?,;]$/.test(line)) return null;
  if (/\b(19|20)\d{2}\b/.test(line)) return null;
  if (line.includes("http")) return null;
  if (/^[«""]/.test(line)) return null;
  if (line.split(",").length >= 3 && line.length > 60) return null;
  if (!/^[A-ZА-ЯЁa-zа-яё]/u.test(line)) return null;
  if (HEADING_KEYWORDS.has(line.toLowerCase())) return 1;
  if (line.length <= 70) return 2;
  return null;
}

function buildStructure(text: string) {
  const lines = text.split("\n");
  const headings: { line: number; level: number; text: string }[] = [];
  let paragraphs = 0;
  let bibliographySection: { startLine: number; endLine: number } | undefined;
  let footnotesSection: { startLine: number; endLine: number } | undefined;
  let currentBibStart: number | undefined;
  let currentFootStart: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    paragraphs++;
    const headingLevel = classifyHeading(line);
    if (headingLevel !== null) {
      headings.push({ line: i + 1, level: headingLevel, text: line.replace(/^#{1,6}\s+/, "") });
    }
    if (BIBLIOGRAPHY_HEADERS.some((h) => h.toLowerCase() === line.toLowerCase())) currentBibStart = i + 1;
    if (FOOTNOTE_HEADERS.some((h) => h.toLowerCase() === line.toLowerCase()))     currentFootStart = i + 1;
  }

  if (currentBibStart)  bibliographySection = { startLine: currentBibStart,  endLine: lines.length };
  if (currentFootStart) footnotesSection    = { startLine: currentFootStart, endLine: currentBibStart ? currentBibStart - 1 : lines.length };

  return {
    headings,
    paragraphs,
    bibliographySection,
    footnotesSection,
    language: detectLanguage(text),
    sections: headings,
    footnoteCount: lines.filter((l) => /^\s*\d+[.)]/.test(l)).length,
    bibCount: lines.filter((l) => isBibEntryLine(l.trim())).length,
  };
}

// ---------------------------------------------------------------------------
// Editor issues
// ---------------------------------------------------------------------------

export function findEditorIssues(text: string): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const sentences = splitSentences(text);

  for (const { s, start } of sentences) {
    const words = s.split(/\s+/).filter(Boolean);

    if (words.length > 40) {
      issues.push({ id: `iss-${issues.length}`, type: "длинное-предложение",
        text: s.slice(0, 120) + (s.length > 120 ? "…" : ""), start, end: start + s.length,
        line: lineOf(text, start), suggestion: "Разбейте на два предложения." });
    }

    if (/\b(?:был[аои]?|были|будет|будут|является|являются|являлся|считается|рассматривается)\s+\w+[нт][а-я]{0,3}\b/u.test(s)) {
      issues.push({ id: `iss-${issues.length}`, type: "пассив",
        text: s.slice(0, 100), start, end: start + s.length,
        line: lineOf(text, start), suggestion: "Рассмотрите активный залог." });
    }

    const colloquial = [
      /\bпо-видимому\b/iu, /\bна самом деле\b/iu, /\bтак сказать\b/iu,
      /\bкак бы\b/iu,      /\bну и\b/iu,         /\bпросто\b/iu,
    ];
    for (const re of colloquial) {
      if (re.test(s)) {
        issues.push({ id: `iss-${issues.length}`, type: "разговорный-маркер",
          text: s.slice(0, 100), start, end: start + s.length,
          line: lineOf(text, start), suggestion: "Замените академическим эквивалентом." });
        break;
      }
    }

    const weak = [
      /\bможно считать\b/iu,          /\bнекоторым образом\b/iu,
      /\bв той или иной мере\b/iu,    /\bв какой-то степени\b/iu,
      /\bдостаточно [а-я]+\b/iu,
    ];
    for (const re of weak) {
      if (re.test(s)) {
        issues.push({ id: `iss-${issues.length}`, type: "слабая-формулировка",
          text: s.slice(0, 100), start, end: start + s.length,
          line: lineOf(text, start), suggestion: "Уточните формулировку." });
        break;
      }
    }

    if (/\bэтого?\b|\bданного?\b|\bтаких?\b/iu.test(s) && words.length < 10) {
      issues.push({ id: `iss-${issues.length}`, type: "неопределённый-указатель",
        text: s.slice(0, 100), start, end: start + s.length,
        line: lineOf(text, start), suggestion: "Уточните, к чему относится указатель." });
    }

    const kancelary = [
      /\bв целях\b/iu,    /\bв рамках\b/iu,         /\bосуществление\b/iu,
      /\bреализация мер\b/iu, /\bв соответствии с\b/iu, /\bна основании вышеизложенного\b/iu,
    ];
    for (const re of kancelary) {
      if (re.test(s)) {
        issues.push({ id: `iss-${issues.length}`, type: "канцелярит",
          text: s.slice(0, 100), start, end: start + s.length,
          line: lineOf(text, start), suggestion: "Упростите канцелярский оборот." });
        break;
      }
    }
  }

  const sentTexts = sentences.map((s) => s.s.toLowerCase());
  for (let i = 1; i < sentTexts.length; i++) {
    const words1 = new Set(sentTexts[i - 1].match(/[а-яёa-z]{5,}/gu) ?? []);
    const words2 = sentTexts[i].match(/[а-яёa-z]{5,}/gu) ?? [];
    const repeated = words2.filter((w) => words1.has(w));
    if (repeated.length >= 3) {
      const { s, start } = sentences[i];
      issues.push({ id: `iss-${issues.length}`, type: "повтор",
        text: s.slice(0, 100), start, end: start + s.length,
        line: lineOf(text, start),
        suggestion: `Повторяются слова: ${repeated.slice(0, 3).join(", ")}.` });
    }
  }

  return issues;
}

function splitSentences(text: string): { s: string; start: number }[] {
  const result: { s: string; start: number }[] = [];
  const re = /[^.!?\n]+[.!?]+/gu;
  for (const m of text.matchAll(re)) {
    result.push({ s: m[0].trim(), start: m.index! });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Word / char counters
// ---------------------------------------------------------------------------

export function countWords(text: string): number {
  return (text.match(/\S+/gu) ?? []).length;
}

export function countChars(text: string, withSpaces: boolean): number {
  return withSpaces ? text.length : (text.match(/\S/gu) ?? []).length;
}
