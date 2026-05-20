// Analysis library for CitaDex
// All logic is heuristic; AI-assisted path available via /api/ai-analyze.

export type CitationStyle = "APA" | "Chicago" | "MLA" | "IEEE" | "Vancouver" | "Harvard" | "GOST" | "Custom" | "Unknown";

export interface CustomCitationRules {
  name: string;
  mode: "author-date" | "numeric" | "footnote";
  inlineTemplate: string;
  bibliographyTemplate: string;
  footnoteTemplate: string;
  separator: string;
  sourceTypes?: SourceTypeTemplate[];
}

export type SourceTypeId =
  | "book" | "book-chapter" | "journal-article" | "anthology-article"
  | "newspaper" | "magazine" | "web" | "blog" | "thesis" | "dissertation"
  | "archive" | "manuscript" | "law" | "legal-case" | "report"
  | "government-doc" | "conference" | "conference-paper" | "encyclopedia"
  | "dictionary" | "map" | "film" | "tv" | "interview" | "letter"
  | "dataset" | "software";

export interface SourceTypeTemplate {
  id: SourceTypeId;
  label: string;
  fields: string[];
  fullNote: string;
  shortNote: string;
  bibliography: string;
  inText: string;
}

export const DEFAULT_SOURCE_TYPES: SourceTypeTemplate[] = [
  {
    id: "book",
    label: "Книга (монография)",
    fields: ["author","title","edition","translator","editor","place","publisher","year","total_pages","series","isbn","doi","url"],
    fullNote: "{author}. {title}{edition, ed.}. {place}: {publisher}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}{edition, ed.}. {place}: {publisher}, {year}.",
    inText: "({author}, {year})",
  },
  {
    id: "book-chapter",
    label: "Глава / статья в книге",
    fields: ["author","title","editor","container_title","edition","place","publisher","year","pages","doi","url"],
    fullNote: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. С. {pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title} / под ред. {editor}. {place}: {publisher}, {year}. \u2014 С. {pages}.",
    inText: "({author}, {year}, с. {pages})",
  },
  {
    id: "journal-article",
    label: "Статья в журнале",
    fields: ["author","title","container_title","year","volume","issue","pages","doi","url","access_date"],
    fullNote: "{author}. {title} // {container_title}. {year}. Т.\u202f{volume}, №\u202f{issue}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {year}. \u2014 Т.\u202f{volume}, №\u202f{issue}. \u2014 С.\u202f{pages}. \u2014 DOI:\u202f{doi}.",
    inText: "({author}, {year})",
  },
  {
    id: "newspaper",
    label: "Статья в газете",
    fields: ["author","title","container_title","date","pages","url","access_date"],
    fullNote: "{author}. {title} // {container_title}. {date}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {date}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {date})",
  },
  {
    id: "magazine",
    label: "Статья в журнале (нон-фикшн)",
    fields: ["author","title","container_title","date","pages","url","access_date"],
    fullNote: "{author}. {title} // {container_title}. {date}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {date}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {date})",
  },
  {
    id: "anthology-article",
    label: "Статья в сборнике",
    fields: ["author","title","container_title","editor","place","publisher","year","pages","doi"],
    fullNote: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title} / сост. {editor}. {place}: {publisher}, {year}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {year})",
  },
  {
    id: "web",
    label: "Веб-страница / сайт",
    fields: ["author","title","container_title","date","url","access_date"],
    fullNote: "{author}. {title} [Электронный ресурс] // {container_title}. {date}. URL: {url} (дата обращения: {access_date}).",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} [Электронный ресурс]. \u2014 URL: {url} (дата обращения: {access_date}).",
    inText: "({author}, {date})",
  },
  {
    id: "blog",
    label: "Блог / онлайн-публикация",
    fields: ["author","title","container_title","date","url","access_date"],
    fullNote: "{author}. {title} [Blog] // {container_title}. {date}. URL: {url} (дата обращения: {access_date}).",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title} [Blog]. \u2014 URL: {url} (дата обращения: {access_date}).",
    inText: "({author}, {date})",
  },
  {
    id: "thesis",
    label: "Кандидатская диссертация",
    fields: ["author","title","degree","specialty_code","institution","place","year","total_pages","url"],
    fullNote: "{author}. {title}: дис. … канд. {degree} наук. {institution}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}: дис. … канд. {degree} наук. \u2014 {place}: {institution}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "dissertation",
    label: "Докторская диссертация",
    fields: ["author","title","degree","specialty_code","institution","place","year","total_pages","url"],
    fullNote: "{author}. {title}: дис. … д-ра {degree} наук. {institution}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, {title}, {pages}.",
    bibliography: "{author}. {title}: дис. … д-ра {degree} наук. \u2014 {place}: {institution}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "archive",
    label: "Архивный документ",
    fields: ["archive","archive_abbr","fond","fond_title","opis","delo","list","list_to","title","date"],
    fullNote: "{archive}. Ф.\u202f{fond}. Оп.\u202f{opis}. Д.\u202f{delo}. Л.\u202f{list}{list_to, \u2013list_to}. ({title}, {date}.)",
    shortNote: "{archive_abbr}. Ф.\u202f{fond}. Д.\u202f{delo}. Л.\u202f{list}.",
    bibliography: "{archive}. Ф.\u202f{fond} ({fond_title}). Оп.\u202f{opis}. Д.\u202f{delo}.",
    inText: "({archive_abbr}, Ф.\u202f{fond}/Д.\u202f{delo}, Л.\u202f{list})",
  },
  {
    id: "manuscript",
    label: "Рукопись / неопубликованный документ",
    fields: ["author","title","type","place","year","pages","archive","fond"],
    fullNote: "{author}. {title}: {type}. {place}, {year}. {pages} с. (Рукопись.)",
    shortNote: "{author}, {title} ({type}), {pages}.",
    bibliography: "{author}. {title}: {type}. \u2014 {place}, {year}. \u2014 {pages} с. (Рукопись.)",
    inText: "({author}, {year})",
  },
  {
    id: "law",
    label: "Федеральный закон / нормативный акт",
    fields: ["title","act_type","act_number","act_date","container_title","year","issue","article","url","access_date"],
    fullNote: "{title}: {act_type} от {act_date} №\u202f{act_number} // {container_title}. {year}. №\u202f{issue}. Ст.\u202f{article}.",
    shortNote: "{title}.",
    bibliography: "{title}: {act_type} от {act_date} №\u202f{act_number} // {container_title}. \u2014 {year}. \u2014 №\u202f{issue}. \u2014 Ст.\u202f{article}.",
    inText: "({title}, {act_date})",
  },
  {
    id: "legal-case",
    label: "Судебное решение",
    fields: ["court","case_number","date","parties","url","access_date"],
    fullNote: "{court}. Решение №\u202f{case_number} от {date} по делу «{parties}».",
    shortNote: "{court}, №\u202f{case_number}.",
    bibliography: "{court}. Решение №\u202f{case_number} от {date} по делу «{parties}».",
    inText: "({court}, {case_number}, {date})",
  },
  {
    id: "report",
    label: "Технический / аналитический отчёт",
    fields: ["author","title","report_number","organization","place","year","total_pages","doi","url"],
    fullNote: "{author}. {title}: отчёт №\u202f{report_number} / {organization}. {place}, {year}. {total_pages} с.",
    shortNote: "{author}, \u00ab{title}\u00bb.",
    bibliography: "{author}. {title}: отчёт №\u202f{report_number} / {organization}. \u2014 {place}, {year}. \u2014 {total_pages} с.",
    inText: "({author}, {year})",
  },
  {
    id: "government-doc",
    label: "Правительственный документ / стратегия",
    fields: ["organization","title","act_type","act_number","act_date","place","publisher","year","url","access_date"],
    fullNote: "{organization}. {title}: {act_type} от {act_date} №\u202f{act_number}. {place}: {publisher}, {year}.",
    shortNote: "{organization}, \u00ab{title}\u00bb.",
    bibliography: "{organization}. {title}: {act_type} от {act_date} №\u202f{act_number}. \u2014 {place}: {publisher}, {year}.",
    inText: "({organization}, {year})",
  },
  {
    id: "conference",
    label: "Материалы конференции (сборник)",
    fields: ["editor","title","conference_name","conference_date","place","publisher","year","total_pages","doi","url"],
    fullNote: "{title}: мат. конф. \u00ab{conference_name}\u00bb ({conference_date}). {place}: {publisher}, {year}.",
    shortNote: "{title}: мат. конф. {conference_date}.",
    bibliography: "{title}: мат. конф. \u00ab{conference_name}\u00bb ({conference_date}). \u2014 {place}: {publisher}, {year}.",
    inText: "({editor}, {year})",
  },
  {
    id: "conference-paper",
    label: "Доклад на конференции",
    fields: ["author","title","container_title","conference_name","conference_date","place","publisher","year","pages","doi"],
    fullNote: "{author}. {title} // {container_title}: мат. конф. \u00ab{conference_name}\u00bb. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}: мат. конф. \u00ab{conference_name}\u00bb. \u2014 {place}: {publisher}, {year}. \u2014 С.\u202f{pages}.",
    inText: "({author}, {year})",
  },
  {
    id: "encyclopedia",
    label: "Статья в энциклопедии / справочнике",
    fields: ["author","title","container_title","editor","edition","volume","place","publisher","year","pages"],
    fullNote: "{author}. {title} // {container_title} / под ред. {editor}. {edition}-е изд. Т.\u202f{volume}. {place}: {publisher}, {year}. С.\u202f{pages}.",
    shortNote: "{author}, \u00ab{title}\u00bb, {pages}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 {place}: {publisher}, {year}. \u2014 Т.\u202f{volume}. \u2014 С.\u202f{pages}.",
    inText: "({container_title}, {year})",
  },
  {
    id: "dictionary",
    label: "Словарь",
    fields: ["editor","title","edition","place","publisher","year","total_pages"],
    fullNote: "{title} / под ред. {editor}. {edition}-е изд. {place}: {publisher}, {year}. {total_pages} с.",
    shortNote: "{title}, {pages}.",
    bibliography: "{title} / под ред. {editor}. \u2014 {edition}-е изд. \u2014 {place}: {publisher}, {year}. \u2014 {total_pages} с.",
    inText: "({title}, {year})",
  },
  {
    id: "map",
    label: "Карта / картографический материал",
    fields: ["author","title","scale","place","publisher","year","url","access_date"],
    fullNote: "{author}. {title} [Карта]. Масштаб {scale}. {place}: {publisher}, {year}.",
    shortNote: "{title} ({year}).",
    bibliography: "{author}. {title} [Карта]. \u2014 Масштаб {scale}. \u2014 {place}: {publisher}, {year}.",
    inText: "({author}, {year})",
  },
  {
    id: "film",
    label: "Фильм / видеозапись",
    fields: ["director","title","producer","studio","place","year","duration","url","access_date"],
    fullNote: "{title} [Фильм] / реж. {director}. {place}: {studio}, {year}. {duration}.",
    shortNote: "{title} ({year}).",
    bibliography: "{title} [Фильм] / реж. {director}. \u2014 {place}: {studio}, {year}.",
    inText: "({director}, {year})",
  },
  {
    id: "tv",
    label: "Телепередача / серия",
    fields: ["author","title","container_title","season","episode","date","network","url","access_date"],
    fullNote: "{author}. {title} // {container_title}. Сезон {season}, эпизод {episode}. {network}, {date}.",
    shortNote: "{title}, S{season}E{episode}.",
    bibliography: "{author}. {title} // {container_title}. \u2014 Сезон {season}, эпизод {episode}. \u2014 {network}, {date}.",
    inText: "({container_title}, {date})",
  },
  {
    id: "interview",
    label: "Интервью",
    fields: ["interviewee","title","interviewer","type","date","place","url","access_date"],
    fullNote: "{interviewee}. {title}: интервью / интервьюер: {interviewer}. {date}. {place}.",
    shortNote: "{interviewee}, интервью, {date}.",
    bibliography: "{interviewee}. {title}: интервью / интервьюер: {interviewer}. \u2014 {date}.",
    inText: "({interviewee}, {date})",
  },
  {
    id: "letter",
    label: "Письмо / личная переписка",
    fields: ["author","recipient","title","date","archive","fond","delo","list"],
    fullNote: "{author} — {recipient}. {title}. {date}. {archive}. Ф.\u202f{fond}. Д.\u202f{delo}. Л.\u202f{list}.",
    shortNote: "{author} — {recipient}, {date}.",
    bibliography: "{author}. Письмо {recipient}. {date} // {archive}. Ф.\u202f{fond}. Д.\u202f{delo}.",
    inText: "({author} — {recipient}, {date})",
  },
  {
    id: "dataset",
    label: "Набор данных",
    fields: ["author","title","version","organization","year","doi","url","access_date"],
    fullNote: "{author}. {title} [Data set]. Version {version}. {organization}, {year}. DOI:\u202f{doi}.",
    shortNote: "{author}, {title} ({year}).",
    bibliography: "{author}. {title} [Data set]. \u2014 {organization}, {year}. \u2014 DOI:\u202f{doi}.",
    inText: "({author}, {year})",
  },
  {
    id: "software",
    label: "Программное обеспечение",
    fields: ["author","title","version","organization","place","year","url","access_date","doi"],
    fullNote: "{author}. {title} [Computer software]. Version {version}. {place}: {organization}, {year}. URL: {url}.",
    shortNote: "{title} (v. {version}).",
    bibliography: "{author}. {title} [Computer software]. \u2014 Version {version}. \u2014 {place}: {organization}, {year}. \u2014 URL: {url}.",
    inText: "({author}, {year})",
  },
];

export const SOURCE_TYPE_FIELD_LABELS: Record<string, string> = {
  author: "Автор", editor: "Редактор", translator: "Переводчик", title: "Название",
  container_title: "Контейнер (сборник / журнал)", publisher: "Издательство",
  place: "Место издания", year: "Год", date: "Дата", pages: "Страницы (диапазон)",
  total_pages: "Объём (стр.)", volume: "Том", issue: "Номер выпуска", edition: "Издание",
  series: "Серия", doi: "DOI", url: "URL", isbn: "ISBN", access_date: "Дата обращения",
  archive: "Архив (полное название)", archive_abbr: "Архив (аббревиатура)",
  fond: "Фонд (Ф.)", fond_title: "Название фонда", opis: "Опись (Оп.)",
  delo: "Дело (Д.)", list: "Лист (Л.)", list_to: "Лист до", degree: "Научная степень",
  specialty_code: "Код специальности", institution: "Учреждение", act_number: "Номер акта",
  act_date: "Дата акта", act_type: "Тип акта (закон, указ…)", article: "Статья",
  organization: "Организация", report_number: "Номер отчёта", conference_name: "Название конференции",
  conference_date: "Дата конференции", court: "Суд", case_number: "Номер дела",
  parties: "Стороны", scale: "Масштаб", director: "Режиссёр", producer: "Продюсер",
  studio: "Студия", duration: "Продолжительность", season: "Сезон", episode: "Эпизод",
  network: "Канал", interviewee: "Интервьюируемый", interviewer: "Интервьюер",
  recipient: "Адресат", version: "Версия", type: "Тип", manuscript: "Рукопись",
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
  language: "ru" | "en" | "mixed";
}

export interface EditorIssue {
  id: string;
  type:
    | "длинное-предложение" | "пассив" | "разговорный-маркер"
    | "слабая-формулировка" | "повтор" | "неопределённый-указатель"
    | "пунктуация" | "канцелярит";
  fragment: string;
  line: number;
  start: number;
  end: number;
  suggestion: string;
}

// ─── Language detection ───────────────────────────────────────────────────────

export function detectLanguage(text: string): "ru" | "en" | "mixed" {
  const ruCount = (text.match(/[а-яёА-ЯЁ]/gu) ?? []).length;
  const enCount = (text.match(/[a-zA-Z]/gu) ?? []).length;
  const total = ruCount + enCount;
  if (total === 0) return "ru";
  const ruRatio = ruCount / total;
  if (ruRatio > 0.7) return "ru";
  if (ruRatio < 0.3) return "en";
  return "mixed";
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

/**
 * RU + EN bibliography / footnote section heading variants.
 */
const BIBLIOGRAPHY_HEADERS_RU = [
  "Список литературы", "Список цитированной литературы",
  "Библиография", "Литература", "Использованная литература",
  "Источники и литература", "Список источников", "Список использованных источников",
];
const BIBLIOGRAPHY_HEADERS_EN = [
  "References", "Bibliography", "Works Cited", "Works consulted",
  "List of References", "Sources",
];
const BIBLIOGRAPHY_HEADERS = [...BIBLIOGRAPHY_HEADERS_RU, ...BIBLIOGRAPHY_HEADERS_EN];

const FOOTNOTE_HEADERS_RU = ["Сноски", "Примечания", "Комментарии"];
const FOOTNOTE_HEADERS_EN = ["Notes", "Footnotes", "Endnotes", "Note"];
const FOOTNOTE_HEADERS = [...FOOTNOTE_HEADERS_RU, ...FOOTNOTE_HEADERS_EN];

export interface SectionRanges {
  bodyEnd: number;
  footnotes?: { start: number; end: number };
  bibliography?: { start: number; end: number };
}

export function detectSectionRanges(text: string): SectionRanges {
  const bibStart = findSectionStart(text, BIBLIOGRAPHY_HEADERS);
  const fnStart  = findSectionStart(text, FOOTNOTE_HEADERS);

  let bibliography: { start: number; end: number } | undefined;
  let footnotes:    { start: number; end: number } | undefined;

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
  else if (footnotes)    bodyEnd = footnotes.start;
  else if (bibliography) bodyEnd = bibliography.start;

  return { bodyEnd, footnotes, bibliography };
}

function isInRange(pos: number, range?: { start: number; end: number }): boolean {
  return !!range && pos >= range.start && pos < range.end;
}

// ─── Bibliography heuristic fallback (no heading) ─────────────────────────────
/**
 * Tries to locate a bibliography block by structural heuristics when no
 * recognised section header is present. A run of ≥3 consecutive lines that
 * each satisfy isBibEntryLine() and collectively appear near the end of the
 * document is treated as an implicit bibliography section.
 */
function detectImplicitBibliography(text: string, ranges: SectionRanges): { start: number; end: number } | undefined {
  if (ranges.bibliography) return undefined; // already found via header

  const lines = text.split("\n");
  let cursor = 0;
  const runs: { startByte: number; endByte: number; lineCount: number }[] = [];
  let runStart = -1;
  let runStartByte = 0;
  let runCount = 0;
  let tmpCursor = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isBibEntryLine(raw.trim())) {
      if (runStart < 0) { runStart = i; runStartByte = tmpCursor; }
      runCount++;
    } else {
      if (runCount >= 3) runs.push({ startByte: runStartByte, endByte: tmpCursor, lineCount: runCount });
      runStart = -1; runCount = 0;
    }
    tmpCursor += raw.length + 1;
  }
  if (runCount >= 3) runs.push({ startByte: runStartByte, endByte: tmpCursor, lineCount: runCount });
  if (!runs.length) return undefined;

  // Pick the last run (bibliography is always at the end)
  const last = runs[runs.length - 1];
  if (last.startByte < text.length * 0.4) return undefined; // too early in doc
  return { start: last.startByte, end: last.endByte };
}

/**
 * Tests whether a trimmed line looks like a bibliography entry.
 * Requirements (at least 3 of 5 signals):
 *  – starts with uppercase
 *  – contains a 4-digit year
 *  – contains p./pp./с./стр. or a page-range
 *  – contains a publisher/journal-ish token (capital word followed by comma/colon)
 *  – ends with period or has a URL
 */
function isBibEntryLine(line: string): boolean {
  if (line.length < 30) return false;
  if (!/^[A-ZА-ЯЁ\[]/u.test(line)) return false;
  let signals = 0;
  if (/\b(19|20)\d{2}\b/.test(line)) signals++;
  if (/\b[pP]p?\.\s*\d|С\.\s*\d|стр\.\s*\d|\d+\s*[–—-]\s*\d+/.test(line)) signals++;
  if (/https?:\/\//.test(line)) signals++;
  if (/[A-ZА-ЯЁ][a-zа-яё]{2,}[,:]/u.test(line)) signals++;
  if (/\.\s+[A-ZА-ЯЁ]/u.test(line)) signals++;
  return signals >= 2;
}

// ─── Citation patterns ────────────────────────────────────────────────────────

/**
 * Matches APA-style inline citations:
 *   (Smith, 2019)  (Иванов, 2021а)  (Smith & Jones, 2019, p. 12)
 */
const APA_INLINE_GROUP = /\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu;

/**
 * Matches GOST/IEEE numeric footnote markers, now including page specs:
 *   [1]   [12]   [1, с. 12]   [1, с. 12–15]   [1, p. 5]   [3, pp. 10–14]
 *   [1, 2]   [1–3]
 */
const NUMERIC_FOOTNOTE_RE =
  /\[(\d{1,3})(?:\s*[,–—-]\s*(?:с\.\s*\d+(?:[–—-]\d+)?|стр\.\s*\d+(?:[–—-]\d+)?|p\.\s*\d+(?:[–—-]\d+)?|pp\.\s*\d+(?:[–—-]\d+)?|\d{1,3}))?\]/gu;

const IBID_RE = /\b(?:Ibid\.?|Там же|Тамже)\b/gu;

/**
 * Quote detection — extended to cover:
 *  RU guillemets:  «цитата» [1]   «цитата» (Иванов, 2020)
 *  RU typewriter:  "цитата" [1]   "цитата" (Иванов, 2020)
 *  EN double:      