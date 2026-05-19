// Analysis library for CitaDex
// All logic is heuristic and intended for demonstration purposes.

export type CitationStyle = "APA" | "Chicago" | "MLA" | "IEEE" | "Vancouver" | "Harvard" | "GOST" | "Custom" | "Unknown";

export interface CustomCitationRules {
  name: string;
  mode: "author-date" | "numeric" | "footnote";
  inlineTemplate: string;
  bibliographyTemplate: string;
  footnoteTemplate: string;
  separator: string;
  /** Optional: per-source-type templates */
  sourceTypes?: SourceTypeTemplate[];
}

export type SourceTypeId =
  | "book"
  | "book-chapter"
  | "journal-article"
  | "anthology-article"
  | "newspaper"
  | "magazine"
  | "web"
  | "blog"
  | "thesis"
  | "dissertation"
  | "archive"
  | "manuscript"
  | "law"
  | "legal-case"
  | "report"
  | "government-doc"
  | "conference"
  | "conference-paper"
  | "encyclopedia"
  | "dictionary"
  | "map"
  | "film"
  | "tv"
  | "interview"
  | "letter"
  | "dataset"
  | "software";

export interface SourceTypeTemplate {
  id: SourceTypeId;
  label: string;
  /** Fields in display order */
  fields: string[];
  /** Full footnote (Chicago-style first occurrence) */
  fullNote: string;
  /** Short footnote (subsequent occurrence) */
  shortNote: string;
  /** Bibliography / reference-list entry */
  bibliography: string;
  /** In-text citation (Author, Year) or [n] */
  inText: string;
}

/**
 * Default source-type template library.
 * Covers all major source categories found in APA 7, Chicago 17,
 * MLA 9, GOST 7.0.5-2008, and Vancouver/IEEE.
 * Placeholders use {field} syntax.
 */
export const DEFAULT_SOURCE_TYPES: SourceTypeTemplate[] = [
  // ─── Books ───────────────────────────────────────────────────────────────
  {
    id: "book",
    label: "Книга (монография)",
    fields: ["author", "title", "edition", "translator", "editor", "place", "publisher", "year", "total_pages", "series", "isbn", "doi", "url"],
    fullNote: "{author}. {title}{edition, ed.}. {place}: {publisher}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}{edition, ed.}. {place}: {publisher}, {year}.",
    inText: "({author}, {year})",
  },
  {
    id: "book-chapter",
    label: "Глава / статья в книге",
    fields: ["author", "title", "editor", "container_title", "edition", "place", "publisher", "year", "pages", "doi", "url"],
    fullNote: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. С. {pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. \u2014 С. {pages}.",
    inText: "({author}, {year}, с. {pages})",
  },
  // ─── Periodicals ─────────────────────────────────────────────────────────
  {
    id: "journal-article",
    label: "Статья в журнале",
    fields: ["author", "title", "container_title", "year", "volume", "issue", "pages", "doi", "url", "access_date"],
    fullNote: "{author}. {title} // {container_title}. {year}. Т.\u202f{volume}, №\u202f{issue}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {year}. \u2014 Т.\u202f{volume}, №\u202f{issue}. \u2014 С.\u202f{pages}. \u2014 DOI:\u202f{doi}.",
    inText: "({author}, {year})",
  },
  {
    id: "newspaper",
    label: "Статья в газете",
    fields: ["author", "title", "container_title", "date", "pages", "url", "access_date"],
    fullNote: "{author}. {title} // {container_title}. {date}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {date}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {date})",
  },
  {
    id: "magazine",
    label: "Статья в журнале (нон-фикшн)",
    fields: ["author", "title", "container_title", "date", "pages", "url", "access_date"],
    fullNote: "{author}. {title} // {container_title}. {date}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {date}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {date})",
  },
  {
    id: "anthology-article",
    label: "Статья в сборнике",
    fields: ["author", "title", "container_title", "editor", "place", "publisher", "year", "pages", "doi"],
    fullNote: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {year})",
  },
  // ─── Web & Digital ───────────────────────────────────────────────────────
  {
    id: "web",
    label: "Веб-страница / сайт",
    fields: ["author", "title", "container_title", "date", "url", "access_date"],
    fullNote: "{author}. {title} [Электронный ресурс] // {container_title}. {date}. URL: {url} (дата обращения: {access_date}).",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} [Электронный ресурс]. \u2014 URL: {url} (дата обращения: {access_date}).",
    inText: "({author}, {date})",
  },
  {
    id: "blog",
    label: "Блог / онлайн-публикация",
    fields: ["author", "title", "container_title", "date", "url", "access_date"],
    fullNote: "{author}. {title} [Blog] // {container_title}. {date}. URL: {url} (дата обращения: {access_date}).",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} [Blog]. \u2014 URL: {url} (дата обращения: {access_date}).",
    inText: "({author}, {date})",
  },
  // ─── Theses & Dissertations ──────────────────────────────────────────────
  {
    id: "thesis",
    label: "Кандидатская диссертация",
    fields: ["author", "title", "degree", "specialty_code", "institution", "place", "year", "total_pages", "url"],
    fullNote: "{author}. {title}: дис. … канд. {degree} наук. {institution}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}: дис. … канд. {degree} наук. \u2014 {place}: {institution}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "dissertation",
    label: "Докторская диссертация",
    fields: ["author", "title", "degree", "specialty_code", "institution", "place", "year", "total_pages", "url"],
    fullNote: "{author}. {title}: дис. … д-ра {degree} наук. {institution}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}: дис. … д-ра {degree} наук. \u2014 {place}: {institution}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  // ─── Archival & Manuscript ───────────────────────────────────────────────
  {
    id: "archive",
    label: "Архивный документ",
    fields: ["archive", "archive_abbr", "fond", "fond_title", "opis", "delo", "list", "list_to", "title", "date"],
    fullNote: "{archive}. Ф.\u202f{fond}. Оп.\u202f{opis}. Д.\u202f{delo}. Л.\u202f{list}{list_to, \u2013list_to}. ({title}, {date}.)",
    shortNote: "{archive_abbr}. Ф.\u202f{fond}. Д.\u202f{delo}. Л.\u202f{list}.",
    bibliography: "{archive}. Ф.\u202f{fond} ({fond_title}). Оп.\u202f{opis}. Д.\u202f{delo}.",
    inText: "({archive_abbr}, Ф.\u202f{fond}/Д.\u202f{delo}, Л.\u202f{list})",
  },
  {
    id: "manuscript",
    label: "Рукопись / неопубликованный документ",
    fields: ["author", "title", "type", "place", "year", "pages", "archive", "fond"],
    fullNote: "{author}. {title}: {type}. {place}, {year}. {pages} с. (Рукопись.)",
    shortNote: "{author}, {title} ({type}), {pages}.",
    bibliography: "{author}. {title}: {type}. \u2014 {place}, {year}. \u2014 {pages} с. (Рукопись.)",
    inText: "({author}, {year})",
  },
  // ─── Legal ───────────────────────────────────────────────────────────────
  {
    id: "law",
    label: "Федеральный закон / нормативный акт",
    fields: ["title", "act_type", "act_number", "act_date", "container_title", "year", "issue", "article", "url", "access_date"],
    fullNote: "{title}: {act_type} от {act_date} №\u202f{act_number} // {container_title}. {year}. №\u202f{issue}. Ст.\u202f{article}.",
    shortNote: "{title}.",
    bibliography: "{title}: {act_type} от {act_date} №\u202f{act_number} // {container_title}. \u2014 {year}. \u2014 №\u202f{issue}. \u2014 Ст.\u202f{article}.",
    inText: "({title}, {act_date})",
  },
  {
    id: "legal-case",
    label: "Судебное решение",
    fields: ["court", "case_number", "date", "parties", "url", "access_date"],
    fullNote: "{court}. Решение №\u202f{case_number} от {date} по делу «{parties}».",
    shortNote: "{court}, №\u202f{case_number}.",
    bibliography: "{court}. Решение №\u202f{case_number} от {date} по делу «{parties}».",
    inText: "({court}, {case_number}, {date})",
  },
  // ─── Reports & Government ────────────────────────────────────────────────
  {
    id: "report",
    label: "Технический / аналитический отчёт",
    fields: ["author", "title", "report_number", "organization", "place", "year", "total_pages", "doi", "url"],
    fullNote: "{author}. {title}: отчёт №\u202f{report_number} / {organization}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title}: отчёт №\u202f{report_number} / {organization}. \u2014 {place}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "government-doc",
    label: "Правительственный документ / стратегия",
    fields: ["organization", "title", "act_type", "act_number", "act_date", "place", "publisher", "year", "url", "access_date"],
    fullNote: "{organization}. {title}: {act_type} от {act_date} №\u202f{act_number}. {place}: {publisher}, {year}.",
    shortNote: "{organization}, \u00ab{title}\u00bb.",
    bibliography: "{organization}. {title}: {act_type} от {act_date} №\u202f{act_number}. \u2014 {place}: {publisher}, {year}.",
    inText: "({organization}, {year})",
  },
  // ─── Conference ──────────────────────────────────────────────────────────
  {
    id: "conference",
    label: "Материалы конференции (сборник)",
    fields: ["editor", "title", "conference_name", "conference_date", "place", "publisher", "year", "total_pages", "doi", "url"],
    fullNote: "{title}: мат. конф. \u00ab{conference_name}\u00bb ({conference_date}). {place}: {publisher}, {year}.",
    shortNote: "{title}: мат. конф. {conference_date}.",
    bibliography: "{title}: мат. конф. \u00ab{conference_name}\u00bb ({conference_date}). \u2014 {place}: {publisher}, {year}.",
    inText: "({editor}, {year})",
  },
  {
    id: "conference-paper",
    label: "Доклад на конференции",
    fields: ["author", "title", "container_title", "conference_name", "conference_date", "place", "publisher", "year", "pages", "doi"],
    fullNote: "{author}. {title} // {container_title}: мат. конф. \u00ab{conference_name}\u00bb. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}: мат. конф. \u00ab{conference_name}\u00bb. \u2014 {place}: {publisher}, {year}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {year})",
  },
  // ─── Reference works ─────────────────────────────────────────────────────
  {
    id: "encyclopedia",
    label: "Статья в энциклопедии / справочнике",
    fields: ["author", "title", "container_title", "editor", "edition", "volume", "place", "publisher", "year", "pages"],
    fullNote: "{author}. {title} // {container_title} / под ред. {editor}. {edition}-е изд. Т.\u202f{volume}. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {place}: {publisher}, {year}. \u2014 Т.\u202f{volume}. \u2014 С.\u202f{pages}.",
    inText: "({container_title}, {year})",
  },
  {
    id: "dictionary",
    label: "Словарь",
    fields: ["editor", "title", "edition", "place", "publisher", "year", "total_pages"],
    fullNote: "{title} / под ред. {editor}. {edition}-е изд. {place}: {publisher}, {year}. {total_pages} с.",
    shortNote: "{title}, {pages}.",
    bibliography: "{title} / под ред. {editor}. \u2014 {edition}-е изд. \u2014 {place}: {publisher}, {year}. \u2014 {total_pages} с.",
    inText: "({title}, {year})",
  },
  // ─── Media ───────────────────────────────────────────────────────────────
  {
    id: "map",
    label: "Карта / картографический материал",
    fields: ["author", "title", "scale", "place", "publisher", "year", "url", "access_date"],
    fullNote: "{author}. {title} [Карта]. Масштаб {scale}. {place}: {publisher}, {year}.",
    shortNote: "{title} ({year}).",
    bibliography: "{author}. {title} [Карта]. \u2014 Масштаб {scale}. \u2014 {place}: {publisher}, {year}.",
    inText: "({author}, {year})",
  },
  {
    id: "film",
    label: "Фильм / видеозапись",
    fields: ["director", "title", "producer", "studio", "place", "year", "duration", "url", "access_date"],
    fullNote: "{title} [Фильм] / реж. {director}. {place}: {studio}, {year}. {duration}.",
    shortNote: "{title} ({year}).",
    bibliography: "{title} [Фильм] / реж. {director}. \u2014 {place}: {studio}, {year}.",
    inText: "({director}, {year})",
  },
  {
    id: "tv",
    label: "Телепередача / серия",
    fields: ["author", "title", "container_title", "season", "episode", "date", "network", "url", "access_date"],
    fullNote: "{author}. {title} // {container_title}. Сезон {season}, эпизод {episode}. {network}, {date}.",
    shortNote: "{title}, S{season}E{episode}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 Сезон {season}, эпизод {episode}. \u2014 {network}, {date}.",
    inText: "({container_title}, {date})",
  },
  // ─── Personal communications ─────────────────────────────────────────────
  {
    id: "interview",
    label: "Интервью",
    fields: ["interviewee", "title", "interviewer", "type", "date", "place", "url", "access_date"],
    fullNote: "{interviewee}. {title}: интервью / интервьюер: {interviewer}. {date}. {place}.",
    shortNote: "{interviewee}, интервью, {date}.",
    bibliography: "{interviewee}. {title}: интервью / интервьюер: {interviewer}. \u2014 {date}.",
    inText: "({interviewee}, {date})",
  },
  {
    id: "letter",
    label: "Письмо / личная переписка",
    fields: ["author", "recipient", "title", "date", "archive", "fond", "delo", "list"],
    fullNote: "{author} — {recipient}. {title}. {date}. {archive}. Ф.\u202f{fond}. Д.\u202f{delo}. Л.\u202f{list}.",
    shortNote: "{author} — {recipient}, {date}.",
    bibliography: "{author}. Письмо {recipient}. {date} // {archive}. Ф.\u202f{fond}. Д.\u202f{delo}.",
    inText: "({author} — {recipient}, {date})",
  },
  // ─── Data & Software ─────────────────────────────────────────────────────
  {
    id: "dataset",
    label: "Набор данных",
    fields: ["author", "title", "version", "organization", "year", "doi", "url", "access_date"],
    fullNote: "{author}. {title} [Data set]. Version {version}. {organization}, {year}. DOI:\u202f{doi}.",
    shortNote: "{author}, {title} ({year}).",
    bibliography: "{author}. {title} [Data set]. \u2014 {organization}, {year}. \u2014 DOI:\u202f{doi}.",
    inText: "({author}, {year})",
  },
  {
    id: "software",
    label: "Программное обеспечение",
    fields: ["author", "title", "version", "organization", "place", "year", "url", "access_date", "doi"],
    fullNote: "{author}. {title} [Computer software]. Version {version}. {place}: {organization}, {year}. URL: {url}.",
    shortNote: "{title} (v. {version}).",
    bibliography: "{author}. {title} [Computer software]. \u2014 Version {version}. \u2014 {place}: {organization}, {year}. \u2014 URL: {url}.",
    inText: "({author}, {year})",
  },
];

export const SOURCE_TYPE_FIELD_LABELS: Record<string, string> = {
  author: "Автор",
  editor: "Редактор",
  translator: "Переводчик",
  title: "Название",
  container_title: "Контейнер (сборник / журнал)",
  publisher: "Издательство",
  place: "Место издания",
  year: "Год",
  date: "Дата",
  pages: "Страницы (диапазон)",
  total_pages: "Объём (стр.)",
  volume: "Том",
  issue: "Номер выпуска",
  edition: "Издание",
  series: "Серия",
  doi: "DOI",
  url: "URL",
  isbn: "ISBN",
  access_date: "Дата обращения",
  archive: "Архив (полное название)",
  archive_abbr: "Архив (аббревиатура)",
  fond: "Фонд (Ф.)",
  fond_title: "Название фонда",
  opis: "Опись (Оп.)",
  delo: "Дело (Д.)",
  list: "Лист (Л.)",
  list_to: "Лист до",
  degree: "Научная степень",
  specialty_code: "Код специальности",
  institution: "Учреждение",
  act_number: "Номер акта",
  act_date: "Дата акта",
  act_type: "Тип акта (закон, указ…)",
  article: "Статья",
  organization: "Организация",
  report_number: "Номер отчёта",
  conference_name: "Название конференции",
  conference_date: "Дата конференции",
  court: "Суд",
  case_number: "Номер дела",
  parties: "Стороны",
  scale: "Масштаб",
  director: "Режиссёр",
  producer: "Продюсер",
  studio: "Студия",
  duration: "Продолжительность",
  season: "Сезон",
  episode: "Эпизод",
  network: "Канал",
  interviewee: "Интервьюируемый",
  interviewer: "Интервьюер",
  recipient: "Адресат",
  version: "Версия",
  type: "Тип",
  manuscript: "Рукопись",
};

export function renderSourceTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{([\w]+)\}/g, (_, key: string) => {
    const v = fields[key];
    if (v && v.trim()) return v;
    return `\u2039${SOURCE_TYPE_FIELD_LABELS[key] || key}\u203a`;
  });
}

export interface FoundItem {
  id: string;
  type: "inline-apa" | "inline-numeric" | "footnote" | "bibliography" | "ibid" | "quote";
  text: string;
  line: number;
  start: number;
  end: number;
  confidence: number;
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

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Section detection ────────────────────────────────────────────────────────

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
  bodyEnd: number;
  footnotes?: { start: number; end: number };
  bibliography?: { start: number; end: number };
}

export function detectSectionRanges(text: string): SectionRanges {
  const bibStart = findSectionStart(text, BIBLIOGRAPHY_HEADERS);
  const fnStart  = findSectionStart(text, FOOTNOTE_HEADERS);

  let bibliography: { start: number; end: number } | undefined;
  let footnotes: { start: number; end: number } | undefined;

  if (bibStart >= 0) bibliography = { start: bibStart, end: text.length };
  if (fnStart  >= 0) {
    const end = bibStart > fnStart ? bibStart : text.length;
    footnotes = { start: fnStart, end };
  }
  if (bibliography && footnotes && footnotes.start > bibliography.start) {
    bibliography.end = footnotes.start;
  }

  let bodyEnd = text.length;
  if (footnotes && bibliography) bodyEnd = Math.min(footnotes.start, bibliography.start);
  else if (footnotes)   bodyEnd = footnotes.start;
  else if (bibliography) bodyEnd = bibliography.start;

  return { bodyEnd, footnotes, bibliography };
}

function isInRange(pos: number, range?: { start: number; end: number }): boolean {
  return !!range && pos >= range.start && pos < range.end;
}

// ─── Find citations ───────────────────────────────────────────────────────────
//
// KEY FIX: the APA inline pattern APA_INLINE_GROUP previously matched ANY
// parenthesised year, including years inside bibliography entries and
// footnote lists ("Smith (2019). Title..."). The updated algorithm now:
//  1. Detects section boundaries first (detectSectionRanges)
//  2. Only tags inline-apa matches that are INSIDE the body text
//  3. Rejects matches where the year-containing parenthesis appears to be
//     the author-year position in a bibliography entry pattern

const APA_INLINE_GROUP = /\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu;
const IBID_RE = /\b(?:Ibid\.?|Там же|Тамже)\b/gu;
const QUOTE_RE = /[«"](.+?)[»"]\s*\(([^)\n]+)\)/gu;

export function findCitations(text: string): FoundItem[] {
  const items: FoundItem[] = [];
  let idx = 0;
  const ranges = detectSectionRanges(text);

  const inBody = (pos: number) =>
    !isInRange(pos, ranges.footnotes) && !isInRange(pos, ranges.bibliography);

  // ── APA inline (Author, Year) — body only, with false-positive guards ──
  for (const m of text.matchAll(APA_INLINE_GROUP)) {
    const start = m.index ?? 0;
    const inner = m[1];
    if (!inBody(start)) continue;

    // Must contain a 4-digit year
    if (!/\d{4}/.test(inner)) continue;

    // Guard 1: reject if the parenthesised text is too long to be an inline
    // citation (bibliography entries often have long parenthetical clauses)
    if (inner.length > 80) continue;

    // Guard 2: the character immediately BEFORE the opening paren should
    // NOT be a sentence-ending period (bibliography pattern: "Title. (Year)").
    const charBefore = start > 0 ? text[start - 1] : " ";
    if (charBefore === ".") continue;

    // Guard 3: reject if the match itself looks like a bibliography entry date
    // i.e. the only content is a bare year: (2019) or (2019a)
    if (/^\d{4}[a-z]?$/.test(inner.trim())) {
      // Bare year in parens is only valid as APA inline when preceded by an
      // author name (word character string with no period directly before paren)
      const textBefore = text.slice(Math.max(0, start - 60), start);
      const hasAuthorBefore = /[А-Яа-яЁёA-Za-z]{2,}\s*$/.test(textBefore);
      if (!hasAuthorBefore) continue;
    }

    items.push({
      id: `apa-${idx++}`,
      type: "inline-apa",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.88,
      note: `Автор–год: ${inner}`,
    });
  }

  // ── Chicago / IEEE numeric footnote markers [n] — body only ──
  for (const m of text.matchAll(/\[(\d{1,3})\]/gu)) {
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

  // ── Ibid / Там же ──
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

  // ── Direct quotes with attribution ──
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
      confidence: 0.72,
      note: "Прямая цитата с указанием источника",
    });
  }

  // ── Bibliography entries ──
  const bibStart = findSectionStart(text, [
    "Список литературы", "Список цитированной литературы",
    "Библиография", "References", "Bibliography", "Works Cited", "Литература",
  ]);
  if (bibStart >= 0) {
    const afterHeader = text.slice(bibStart);
    const lines = afterHeader.split("\n");
    let absoluteCursor = bibStart + lines[0].length + 1;
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      // A bibliography line: starts with uppercase letter, has meaningful length
      // and does NOT look like another section header
      if (trimmed.length > 20 && /^[A-ZА-ЯЁ]/u.test(trimmed)) {
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

  // ── Expanded footnote entries ──
  const fnStart = findSectionStart(text, ["Сноски", "Примечания", "Notes", "Footnotes", "Endnotes"]);
  if (fnStart >= 0) {
    const afterHeader = text.slice(fnStart);
    const lines = afterHeader.split("\n");
    let absoluteCursor = fnStart + lines[0].length + 1;
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (/^\d{1,3}[\.\)]\s+/.test(trimmed) && trimmed.length > 15) {
        items.push({
          id: `fn-${idx++}`,
          type: "footnote",
          text: trimmed.length > 200 ? trimmed.slice(0, 197) + "…" : trimmed,
          line: getLineFromIndex(text, absoluteCursor),
          start: absoluteCursor,
          end: absoluteCursor + raw.length,
          confidence: 0.88,
          note: "Развёрнутая сноска",
        });
      }
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
  if (/\(\d{4}[a-z]?\)/.test(entry)) return "APA";
  if (/,\s*\d{4}\.?\s*$/.test(entry)) return "Chicago/MLA";
  if (/\.\s+[A-ZА-ЯЁ][^.]+\.\s+[A-ZА-ЯЁ][^.]+,\s+\d{4}/.test(entry)) return "Chicago";
  if (/\[\d{1,3}\]/.test(entry)) return "IEEE";
  if (/\d{4};\d+\(\d+\):\d+/.test(entry)) return "Vancouver";
  if (/\u2014\s+\d{4}\./.test(entry)) return "ГОСТ";
  return "Стиль неопределён";
}

// ─── Style detection ──────────────────────────────────────────────────────────

export function detectStyle(text: string, found: FoundItem[]): StyleDetection {
  let apa = 0, chicago = 0;
  const reasons: string[] = [];

  const apaInline = found.filter(f => f.type === "inline-apa").length;
  const numeric   = found.filter(f => f.type === "inline-numeric").length;
  const footnotes = found.filter(f => f.type === "footnote").length;
  const ibid      = found.filter(f => f.type === "ibid").length;
  const bib       = found.filter(f => f.type === "bibliography");

  if (apaInline > 0) { apa += apaInline * 2; reasons.push(`APA-вставок (Автор, год): ${apaInline}`); }
  if (numeric   > 0) { chicago += numeric * 1.5; reasons.push(`Числовых маркеров: ${numeric}`); }
  if (footnotes > 0) { chicago += footnotes * 2; reasons.push(`Развёрнутых сносок: ${footnotes}`); }
  if (ibid      > 0) { chicago += ibid * 1.5; reasons.push(`Маркеров Ibid./Там же: ${ibid}`); }

  const apaBib = bib.filter(b => b.note === "APA").length;
  const chBib  = bib.filter(b => b.note === "Chicago" || b.note === "Chicago/MLA").length;
  const gostBib = bib.filter(b => b.note === "ГОСТ").length;
  if (apaBib)  { apa += apaBib;  reasons.push(`APA-записей в библиографии: ${apaBib}`); }
  if (chBib)   { chicago += chBib;   reasons.push(`Chicago-записей в библиографии: ${chBib}`); }
  if (gostBib) { apa += gostBib * 0.5; reasons.push(`ГОСТ-записей: ${gostBib} (сходен с APA/Chicago)`); }

  if (/Список литературы|References/i.test(text)) { apa += 1; reasons.push("Заголовок «Список литературы/References»"); }
  if (/Сноски|Примечания|Bibliography/i.test(text)) { chicago += 1; reasons.push("Заголовок «Сноски/Примечания/Bibliography»"); }

  const total = apa + chicago;
  let style: CitationStyle = "Unknown";
  let confidence = 0;
  if (total > 0) {
    if (apa > chicago) { style = "APA"; confidence = apa / total; }
    else if (chicago > apa) { style = "Chicago"; confidence = chicago / total; }
    else { style = "Unknown"; confidence = 0.5; }
  }

  return { style, confidence, reasons, scores: { apa, chicago } };
}

// ─── Structure analysis ───────────────────────────────────────────────────────

export function analyzeStructure(text: string): DocStructure {
  const lines = text.split("\n");
  const headings: DocStructure["headings"] = [];
  let paragraphs = 0;
  let prevBlank = true;

  const knownHeadings = [
    "введение", "методология", "методы", "результаты", "результаты и обсуждение",
    "обсуждение", "выводы", "заключение", "список литературы",
    "список цитированной литературы", "библиография", "references", "bibliography",
    "works cited", "сноски", "примечания", "notes", "footnotes", "endnotes",
    "введение", "теоретические основания", "теоретическая основа",
    "аналитическая часть", "практическая часть",
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lower   = trimmed.toLowerCase();
    if (!trimmed) { prevBlank = true; continue; }
    const isShort       = trimmed.length < 90;
    const isMatchKnown  = knownHeadings.includes(lower);
    const looksTitleCase = /^[A-ZА-ЯЁ]/u.test(trimmed) && !/[.!?]$/.test(trimmed);
    if (isMatchKnown || (isShort && looksTitleCase && prevBlank && i === 0)) {
      headings.push({ line: i + 1, level: i === 0 ? 1 : 2, text: trimmed });
    } else {
      paragraphs += 1;
    }
    prevBlank = false;
  }

  const bib = findSectionRange(lines, ["Список литературы", "Список цитированной литературы", "Библиография", "References", "Bibliography", "Works Cited", "Литература"]);
  const fn  = findSectionRange(lines, ["Сноски", "Примечания", "Notes", "Footnotes", "Endnotes"]);

  return { headings, paragraphs, bibliographySection: bib, footnotesSection: fn };
}

function findSectionRange(lines: string[], names: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toLowerCase();
    if (names.some(n => t === n.toLowerCase())) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const tt = lines[j].trim().toLowerCase();
        if (tt && ["список литературы", "список цитированной литературы", "библиография", "references", "bibliography", "works cited", "сноски", "примечания", "notes", "footnotes", "endnotes"].includes(tt) && tt !== t) {
          end = j; break;
        }
      }
      return { startLine: i + 1, endLine: end };
    }
  }
  return undefined;
}

// ─── Editor issues ────────────────────────────────────────────────────────────

const WEAK_WORDS  = ["очень", "просто", "вообще", "достаточно", "несколько", "довольно", "наверное", "видимо", "как бы"];
const COLLOQUIAL  = ["типа", "короче", "по сути", "на самом деле", "как-то", "вроде", "что-то типа"];
const PASSIVE_HINTS = /\b(\S+?)(?:ется|ются|уются|уется|ован|ована|овано|ованы)\b/gu;
const KANCEL: [string, string][] = [
  ["в данном случае", "здесь"],
  ["в связи с тем что", "потому что"],
  ["в целях", "чтобы"],
  ["осуществлять", "делать"],
  ["производить", "делать"],
  ["в настоящее время", "сейчас"],
  ["в большинстве случаев", "обычно"],
  ["принимая во внимание", "учитывая"],
  ["имеет место быть", "существует"],
  ["с целью", "чтобы"],
  ["вышеуказанный", "названный"],
  ["нижеследующий", "следующий"],
];
const REPETITION_STOP_WORDS = new Set([
  "который", "которая", "которое", "которые", "данных", "данные",
  "работы", "тексте", "исследования", "исследование", "документа",
  "документ", "автор", "авторы", "source", "references",
]);

export function findEditorIssues(text: string): EditorIssue[] {
  const issues: EditorIssue[] = [];
  let idx = 0;

  // Long sentences
  for (const m of text.matchAll(/[^.!?\n]+[.!?]+/gu)) {
    const sentence = m[0].trim();
    const start    = m.index ?? 0;
    if (sentence.split(/\s+/u).length > 35) {
      issues.push({ id: `iss-${idx++}`, type: "длинное-предложение", fragment: sentence.slice(0, 200),
        line: getLineFromIndex(text, start), start, end: start + sentence.length,
        suggestion: "Разделите на 2–3 более коротких предложения. Целевая длина — до 25 слов.",
      });
    }
  }

  pushWordIssues(text, WEAK_WORDS, "слабая-формулировка", "Удалите модальную «вату» или замените на точную меру.", issues, () => idx++);
  pushWordIssues(text, COLLOQUIAL, "разговорный-маркер", "Замените разговорный оборот на нейтральный академический.", issues, () => idx++);

  for (const m of text.matchAll(PASSIVE_HINTS)) {
    const start = m.index ?? 0;
    const ctx   = extractSentence(text, start);
    if (ctx.length < 8) continue;
    issues.push({ id: `iss-${idx++}`, type: "пассив", fragment: ctx,
      line: getLineFromIndex(text, start), start, end: start + m[0].length,
      suggestion: "Рассмотрите активную конструкцию: укажите субъект действия.",
    });
  }

  for (const m of text.matchAll(/(?:^|[.!?]\s+|\n\s*)(Это|То|Тот|Эта|Эти|Данный|Вышеуказанный)\s+/gu)) {
    const start = (m.index ?? 0) + m[0].indexOf(m[1]);
    issues.push({ id: `iss-${idx++}`, type: "неопределённый-указатель", fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start), start, end: start + m[1].length,
      suggestion: "Уточните: назовите явление, чтобы избежать неопределённости.",
    });
  }

  // Repetition (ignore citations and back-matter sections)
  const sectionRanges = detectSectionRanges(text);
  const citationRanges = findCitations(text)
    .filter(it => it.type !== "inline-numeric")
    .map(it => ({ start: it.start, end: it.end }));
  const tokens: { word: string; start: number }[] = [];
  for (const m of text.matchAll(/[А-Яа-яЁёA-Za-z]{5,}/gu)) {
    const start = m.index ?? 0;
    if (citationRanges.some(r => start >= r.start && start < r.end)) continue;
    if (isInRange(start, sectionRanges.footnotes) || isInRange(start, sectionRanges.bibliography)) continue;
    if (REPETITION_STOP_WORDS.has(m[0].toLowerCase())) continue;
    if (/^[A-ZА-ЯЁ]/u.test(m[0])) continue; // proper names
    tokens.push({ word: m[0].toLowerCase(), start });
  }
  const seen = new Map<string, number[]>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = (seen.get(t.word) || []).filter(ti => i - ti < 35);
    if (prev.length >= 2) {
      issues.push({ id: `iss-${idx++}`, type: "повтор", fragment: extractSentence(text, t.start),
        line: getLineFromIndex(text, t.start), start: t.start, end: t.start + t.word.length,
        suggestion: `Слово «${t.word}» повторяется несколько раз подряд. Проверьте, не нужна ли замена.`,
      });
    }
    prev.push(i);
    seen.set(t.word, prev);
  }

  for (const [phrase, replacement] of KANCEL) {
    const re = new RegExp(escapeRe(phrase), "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      issues.push({ id: `iss-${idx++}`, type: "канцелярит", fragment: extractSentence(text, start),
        line: getLineFromIndex(text, start), start, end: start + m[0].length,
        suggestion: `Замените на «${replacement}».`,
      });
    }
  }

  for (const m of text.matchAll(/  +/gu)) {
    const start = m.index ?? 0;
    issues.push({ id: `iss-${idx++}`, type: "пунктуация", fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start), start, end: start + m[0].length,
      suggestion: "Удалите лишние пробелы.",
    });
  }
  for (const m of text.matchAll(/\s+([,.;:!?])/gu)) {
    const start = m.index ?? 0;
    issues.push({ id: `iss-${idx++}`, type: "пунктуация", fragment: extractSentence(text, start),
      line: getLineFromIndex(text, start), start, end: start + m[0].length,
      suggestion: "Уберите пробел перед знаком препинания.",
    });
  }

  const dedup = new Map<string, EditorIssue>();
  for (const it of issues) dedup.set(`${it.type}:${it.start}`, it);
  return Array.from(dedup.values()).sort((a, b) => a.start - b.start);
}

function pushWordIssues(
  text: string, words: string[], type: EditorIssue["type"],
  suggestion: string, out: EditorIssue[], nextId: () => number
) {
  for (const w of words) {
    const re = new RegExp(`\\b${escapeRe(w)}\\b`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      out.push({ id: `iss-${nextId()}`, type, fragment: extractSentence(text, start),
        line: getLineFromIndex(text, start), start, end: start + m[0].length, suggestion,
      });
    }
  }
}

function extractSentence(text: string, idx: number): string {
  const left  = text.slice(0, idx);
  const right = text.slice(idx);
  const ls    = Math.max(left.lastIndexOf("."), left.lastIndexOf("!"), left.lastIndexOf("?"), left.lastIndexOf("\n"));
  const re    = right.search(/[.!?\n]/);
  const start = ls < 0 ? 0 : ls + 1;
  const end   = re < 0 ? text.length : idx + re + 1;
  return text.slice(start, end).trim().slice(0, 220);
}

// ─── Citation conversion ──────────────────────────────────────────────────────

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
  preview: string;
}

interface ParsedReference {
  author: string; year: string; title: string; source: string;
}

const APA_BIB_RE     = /^([A-ZА-ЯЁ][^.]+?)\s*\((\d{4}[a-z]?)\)\.\s*(.+?)\.\s*(.+?)$/u;
const CHICAGO_BIB_RE = /^([A-ZА-ЯЁ][^.]+?)\.\s*(.+?)\.\s*([^,]+?),\s*(\d{4}[a-z]?)\.?$/u;
const APA_INLINE_GROUP_CONV = /\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu;

export function convertCitations(text: string, target: CitationStyle, customRules?: CustomCitationRules): ConversionResult {
  if (target === "Custom" && customRules) return convertCustomCitations(text, customRules);
  if (!["APA","Chicago","MLA","IEEE","Vancouver","Harvard","GOST"].includes(target)) {
    return { target, changes: [], preview: text };
  }

  const inlineChanges: ConversionChange[] = [];
  const ranges = detectSectionRanges(text);
  let working = text;

  if (["Chicago","IEEE","Vancouver","GOST"].includes(target)) {
    let counter = 1;
    working = working.replace(APA_INLINE_GROUP_CONV, (match, _inner, offset) => {
      if (isInRange(offset as number, ranges.footnotes) || isInRange(offset as number, ranges.bibliography)) return match;
      const replacement = `[${counter}]`;
      inlineChanges.push({ type: "inline", before: match, after: replacement,
        line: getLineFromIndex(text, offset as number), start: offset as number,
        end: (offset as number) + match.length,
        note: `Автор–год → [${counter}] для стиля ${target}.`,
      });
      counter++;
      return replacement;
    });
  } else if (["APA","MLA","Harvard"].includes(target)) {
    let n = 1;
    working = working.replace(/\[(\d{1,3})\]/gu, (match, _num, offset) => {
      if (isInRange(offset as number, ranges.footnotes) || isInRange(offset as number, ranges.bibliography)) return match;
      const replacement = target === "MLA" ? "(Автор стр.)" : "(Автор, г.)";
      inlineChanges.push({ type: "inline", before: match, after: replacement,
        line: getLineFromIndex(text, offset as number), start: offset as number,
        end: (offset as number) + match.length,
        note: `[${n}] → ${target}. Подставьте автора и год из библиографии.`,
      });
      n++;
      return replacement;
    });
  }

  const workingLines = working.split("\n");
  let absoluteOffset = 0;
  let bibState = false;
  for (let i = 0; i < workingLines.length; i++) {
    const line    = workingLines[i];
    const trimmed = line.trim();
    if (/^(Список литературы|Список цитированной литературы|Библиография|References|Bibliography|Works Cited)\s*$/i.test(trimmed)) {
      bibState = true;
    } else if (bibState && trimmed.length > 25) {
      const converted = convertBibEntry(trimmed, target);
      if (converted && converted !== trimmed) {
        const startInLine = line.indexOf(trimmed);
        const start = absoluteOffset + startInLine;
        inlineChanges.push({ type: "bibliography", before: trimmed, after: converted,
          line: i + 1, start, end: start + trimmed.length,
          note: `Запись → стиль ${target}.`,
        });
        workingLines[i] = line.replace(trimmed, converted);
      }
    }
    absoluteOffset += line.length + 1;
  }

  return { target, changes: inlineChanges, preview: workingLines.join("\n") };
}

function convertBibEntry(entry: string, target: CitationStyle): string | null {
  const parsed = parseReference(entry);
  if (!parsed) return null;
  const formatted = formatReference(parsed, target);
  return formatted === entry ? null : formatted;
}

function parseReference(entry: string): ParsedReference | null {
  const am = APA_BIB_RE.exec(entry);
  if (am) return { author: am[1].trim(), year: am[2], title: am[3].trim(), source: am[4].trim() };
  const cm = CHICAGO_BIB_RE.exec(entry);
  if (cm) return { author: cm[1].trim(), year: cm[4], title: cm[2].trim(), source: cm[3].trim() };
  return null;
}

function formatReference(ref: ParsedReference, target: CitationStyle): string {
  switch (target) {
    case "APA":       return `${ref.author} (${ref.year}). ${ref.title}. ${ref.source}.`;
    case "Chicago":   return `${ref.author}. ${ref.title}. ${ref.source}, ${ref.year}.`;
    case "MLA":       return `${ref.author}. ${ref.title}. ${ref.source}, ${ref.year}.`;
    case "IEEE":      return `${ref.author}, "${ref.title}," ${ref.source}, ${ref.year}.`;
    case "Vancouver": return `${ref.author}. ${ref.title}. ${ref.source}. ${ref.year}.`;
    case "Harvard":   return `${ref.author} ${ref.year}, ${ref.title}, ${ref.source}.`;
    case "GOST":      return `${ref.author} ${ref.title}. \u2014 ${ref.source}, ${ref.year}.`;
    default:          return `${ref.author} (${ref.year}). ${ref.title}. ${ref.source}.`;
  }
}

function applyTemplate(template: string, ref: ParsedReference, index: number): string {
  return template
    .replaceAll("{author}",  ref.author  || "Автор")
    .replaceAll("{year}",    ref.year    || "г.")
    .replaceAll("{title}",   ref.title   || "Название")
    .replaceAll("{source}",  ref.source  || "Источник")
    .replaceAll("{n}",       String(index));
}

function convertCustomCitations(text: string, rules: CustomCitationRules): ConversionResult {
  const changes: ConversionChange[] = [];
  let counter = 1;
  let working = text;
  const ranges = detectSectionRanges(text);
  const inlineTemplate = rules.inlineTemplate || "({author}, {year})";

  working = working.replace(APA_INLINE_GROUP_CONV, (match, inner, offset) => {
    if (isInRange(offset as number, ranges.footnotes) || isInRange(offset as number, ranges.bibliography)) return match;
    const ay = String(inner).split(";")[0].match(/(.+?),\s*(\d{4}[a-z]?)/u);
    const ref: ParsedReference = { author: ay?.[1]?.trim() || "Автор", year: ay?.[2] || "г.", title: "Название", source: "Источник" };
    const replacement = applyTemplate(inlineTemplate, ref, counter);
    changes.push({ type: "inline", before: match, after: replacement,
      line: getLineFromIndex(text, offset as number), start: offset as number,
      end: (offset as number) + match.length,
      note: `Преобразовано по правилу «${rules.name || "Авторский стиль"}».`,
    });
    counter++;
    return replacement;
  });

  working = working.replace(/\[(\d{1,3})\]/gu, (match, num, offset) => {
    if (isInRange(offset as number, ranges.footnotes) || isInRange(offset as number, ranges.bibliography)) return match;
    const ref: ParsedReference = { author: "Автор", year: "г.", title: "Название", source: "Источник" };
    const replacement = applyTemplate(inlineTemplate, ref, Number(num) || counter);
    changes.push({ type: "inline", before: match, after: replacement,
      line: getLineFromIndex(text, offset as number), start: offset as number,
      end: (offset as number) + match.length,
      note: "Числовой маркер → авторский шаблон.",
    });
    counter++;
    return replacement;
  });

  const lines = working.split("\n");
  let absoluteOffset = 0;
  let bibState = false;
  const bibTemplate = rules.bibliographyTemplate || "{author}. {title}. {source}, {year}.";
  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();
    if (/^(Список литературы|Список цитированной литературы|Библиография|References|Bibliography|Works Cited|Литература)\s*$/i.test(trimmed)) {
      bibState = true;
    } else if (bibState && trimmed.length > 25) {
      const parsed = parseReference(trimmed);
      if (parsed) {
        const replacement = applyTemplate(bibTemplate, parsed, i + 1);
        const start = absoluteOffset + line.indexOf(trimmed);
        changes.push({ type: "bibliography", before: trimmed, after: replacement,
          line: i + 1, start, end: start + trimmed.length,
          note: "Библиография → авторский шаблон.",
        });
        lines[i] = line.replace(trimmed, replacement);
      }
    }
    absoluteOffset += line.length + 1;
  }

  return { target: "Custom", changes, preview: lines.join("\n") };
}
