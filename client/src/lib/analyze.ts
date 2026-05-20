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
    fullNote: "{author} \u2014 {recipient}. {title}. {date}. {archive}. Ф.\u202f{fond}. Д.\u202f{delo}. Л.\u202f{list}.",
    shortNote: "{author} \u2014 {recipient}, {date}.",
    bibliography: "{author}. Письмо {recipient}. {date} // {archive}. Ф.\u202f{fond}. Д.\u202f{delo}.",
    inText: "({author} \u2014 {recipient}, {date})",
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

function detectImplicitBibliography(text: string, ranges: SectionRanges): { start: number; end: number } | undefined {
  if (ranges.bibliography) return undefined;

  const lines = text.split("\n");
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

  const last = runs[runs.length - 1];
  if (last.startByte < text.length * 0.4) return undefined;
  return { start: last.startByte, end: last.endByte };
}

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

const APA_INLINE_GROUP = /\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu;
const IBID_RE = /\b(?:Ibid\.?|Там же|Тамже)\b/gu;
const QUOTE_RE = /[«"](.+?)[»"]\s*\(([^)\n]+)\)/gu;

export function findCitations(text: string): FoundItem[] {
  const items: FoundItem[] = [];
  let idx = 0;
  const ranges = detectSectionRanges(text);
  const implicitBib = detectImplicitBibliography(text, ranges);
  if (implicitBib && !ranges.bibliography) ranges.bibliography = implicitBib;

  const inBody = (pos: number) =>
    !isInRange(pos, ranges.footnotes) && !isInRange(pos, ranges.bibliography);

  for (const m of text.matchAll(APA_INLINE_GROUP)) {
    const start = m.index ?? 0;
    const inner = m[1];
    if (!inBody(start)) continue;
    if (!/\d{4}/.test(inner)) continue;
    if (inner.length > 80) continue;
    const charBefore = start > 0 ? text[start - 1] : " ";
    if (charBefore === ".") continue;
    if (/^\d{4}[a-z]?$/i.test(inner.trim())) continue;

    items.push({
      id: `apa-${idx++}`,
      type: "inline-apa",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.86,
    });
  }

  for (const m of text.matchAll(
    /\[(\d{1,3})(?:\s*[,\u2013\u2014-]\s*(?:\u0441\.\s*\d+(?:[\u2013\u2014-]\d+)?|\u0441\u0442\u0440\.\s*\d+(?:[\u2013\u2014-]\d+)?|p\.\s*\d+(?:[\u2013\u2014-]\d+)?|pp\.\s*\d+(?:[\u2013\u2014-]\d+)?|\d{1,3}))?\]/gu
  )) {
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
    });
  }

  for (const m of text.matchAll(IBID_RE)) {
    const start = m.index ?? 0;
    if (!isInRange(start, ranges.footnotes) && !isInRange(start, ranges.bibliography)) continue;
    items.push({
      id: `ibid-${idx++}`,
      type: "ibid",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.74,
    });
  }

  for (const m of text.matchAll(QUOTE_RE)) {
    const start = m.index ?? 0;
    items.push({
      id: `quote-${idx++}`,
      type: "quote",
      text: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      confidence: 0.72,
    });
  }

  const lines = text.split("\n");
  let absoluteOffset = 0;
  let inBib = false;
  let inFoot = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (BIBLIOGRAPHY_HEADERS.some((h) => trimmed.toLowerCase() === h.toLowerCase())) {
      inBib = true; inFoot = false;
      absoluteOffset += line.length + 1;
      continue;
    }
    if (FOOTNOTE_HEADERS.some((h) => trimmed.toLowerCase() === h.toLowerCase())) {
      inFoot = true; inBib = false;
      absoluteOffset += line.length + 1;
      continue;
    }

    if (inBib && trimmed) {
      items.push({
        id: `bib-${idx++}`,
        type: "bibliography",
        text: trimmed,
        line: i + 1,
        start: absoluteOffset + line.indexOf(trimmed),
        end: absoluteOffset + line.indexOf(trimmed) + trimmed.length,
        confidence: 0.81,
      });
    }

    if (inFoot && /^\s*\d+[.)]/.test(line)) {
      items.push({
        id: `fn-${idx++}`,
        type: "footnote",
        text: trimmed,
        line: i + 1,
        start: absoluteOffset + line.indexOf(trimmed),
        end: absoluteOffset + line.indexOf(trimmed) + trimmed.length,
        confidence: 0.8,
      });
    }

    absoluteOffset += line.length + 1;
  }

  if (!items.some((x) => x.type === "bibliography") && ranges.bibliography) {
    const bibText = text.slice(ranges.bibliography.start, ranges.bibliography.end);
    const bibLines = bibText.split("\n");
    let off = ranges.bibliography.start;
    for (const line of bibLines) {
      const trimmed = line.trim();
      if (trimmed && isBibEntryLine(trimmed)) {
        const start = off + line.indexOf(trimmed);
        items.push({
          id: `bib-${idx++}`,
          type: "bibliography",
          text: trimmed,
          line: getLineFromIndex(text, start),
          start,
          end: start + trimmed.length,
          confidence: 0.75,
        });
      }
      off += line.length + 1;
    }
  }

  return items.sort((a, b) => a.start - b.start);
}

export function detectStyle(text: string, found: FoundItem[]): {
  style: CitationStyle;
  confidence: number;
  scores: { style: CitationStyle; score: number }[];
  notes: string[];
} {
  let apa = 0, chicago = 0, mla = 0, ieee = 0, vancouver = 0, harvard = 0, gost = 0;
  const notes: string[] = [];

  const apaInline  = found.filter(f => f.type === "inline-apa").length;
  const numeric    = found.filter(f => f.type === "inline-numeric").length;
  const footnotes  = found.filter(f => f.type === "footnote").length;
  const bibEntries = found.filter(f => f.type === "bibliography").length;
  const ibidCount  = found.filter(f => f.type === "ibid").length;

  if (apaInline > 0)  { apa += apaInline * 1.6; harvard += apaInline * 1.4; notes.push(`Автор-год вставок: ${apaInline}`); }
  if (numeric   > 0)  { chicago += numeric * 1.5; ieee += numeric * 1.6; vancouver += numeric * 1.5; notes.push(`Числовых маркеров: ${numeric}`); }
  if (footnotes > 0)  { chicago += footnotes * 1.6; gost += footnotes * 1.4; notes.push(`Сносок: ${footnotes}`); }
  if (ibidCount > 0)  { chicago += ibidCount * 1.8; gost += ibidCount * 1.2; notes.push(`Ibid./Там же: ${ibidCount}`); }
  if (bibEntries > 0) { notes.push(`Библиографических строк: ${bibEntries}`); }

  const lines = text.split("\n");
  const bibliographyLines = lines.filter(l => isBibEntryLine(l.trim()));
  for (const line of bibliographyLines) {
    if (/\bvol\.\b|\bno\.\b|Retrieved from\b|https?:\/\//i.test(line)) apa += 0.7;
    if (/\bpp?\.\s*\d+/i.test(line)) mla += 0.4;
    if (/№\s*\d+|Т\.\s*\d+|С\.\s*\d+/u.test(line)) gost += 0.8;
    if (/\d+\.$/.test(line.trim())) vancouver += 0.3;
  }

  if (/[А-Яа-яЁё]/u.test(text) && /\bURL:|\bдата обращения|\bТ\.\s*\d+|№\s*\d+/u.test(text)) gost += 1.0;
  if (/References\n/i.test(text) || /Retrieved from/i.test(text)) apa += 0.8;
  if (/Works Cited/i.test(text)) mla += 1.2;
  if (/Bibliography/i.test(text) && ibidCount > 0) chicago += 0.8;

  const scorePairs: { style: CitationStyle; score: number }[] = [
    { style: "APA",       score: apa },
    { style: "Chicago",   score: chicago },
    { style: "MLA",       score: mla },
    { style: "IEEE",      score: ieee },
    { style: "Vancouver", score: vancouver },
    { style: "Harvard",   score: harvard },
    { style: "GOST",      score: gost },
  ].sort((a, b) => b.score - a.score);

  const best = scorePairs[0];
  const second = scorePairs[1] ?? { score: 0 };
  const total = scorePairs.reduce((s, x) => s + x.score, 0) || 1;
  const confidence = Math.min(0.99, Math.max(0.25, (best.score - second.score) / total + best.score / (total + 2)));

  return {
    style: best.score > 0 ? best.style : "Unknown",
    confidence,
    scores: scorePairs,
    notes,
  };
}

export function analyzeStructure(text: string): ReturnType<typeof buildStructure> {
  return buildStructure(text);
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

    if (/^(#{1,6})\s+/.test(line)) {
      const level = line.match(/^(#{1,6})/)?.[1].length ?? 1;
      headings.push({ line: i + 1, level, text: line.replace(/^#{1,6}\s+/, "") });
    } else if (/^\d+(?:\.\d+)*\.?\s+[A-ZА-ЯЁ]/u.test(line) || /^[A-ZА-ЯЁ][A-ZА-ЯЁ\s-]{4,}$/u.test(line)) {
      headings.push({ line: i + 1, level: 2, text: line });
    }

    if (BIBLIOGRAPHY_HEADERS.some((h) => h.toLowerCase() === line.toLowerCase())) currentBibStart = i + 1;
    if (FOOTNOTE_HEADERS.some((h) => h.toLowerCase() === line.toLowerCase())) currentFootStart = i + 1;
  }

  if (currentBibStart) bibliographySection = { startLine: currentBibStart, endLine: lines.length };
  if (currentFootStart) footnotesSection = { startLine: currentFootStart, endLine: currentBibStart ? currentBibStart - 1 : lines.length };

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

function findSectionStart(text: string, names: string[]): number {
  const lines = text.split("\n");
  let pos = 0;
  for (const line of lines) {
    if (names.some((n) => n.toLowerCase() === line.trim().toLowerCase())) return pos;
    pos += line.length + 1;
  }
  return -1;
}

export function findEditorIssues(text: string): EditorIssue[] {
  const issues: EditorIssue[] = [];
  let idx = 0;

  for (const m of text.matchAll(/[^.!?\n]+[.!?]+/gu)) {
    const sentence = m[0];
    const words = countWords(sentence);
    if (words > 35) {
      const start = m.index ?? 0;
      issues.push({
        id: `issue-${idx++}`,
        type: "длинное-предложение",
        fragment: sentence.trim(),
        line: getLineFromIndex(text, start),
        start,
        end: start + sentence.length,
        suggestion: "Разбейте предложение на 2–3 более коротких.",
      });
    }
  }

  const PASSIVE_HINTS = /\b(?:был(?:а|о|и)?|были|является|являлись|осуществляется|производится|рассматривается|определяется)\b/gu;
  for (const m of text.matchAll(PASSIVE_HINTS)) {
    const start = m.index ?? 0;
    issues.push({
      id: `issue-${idx++}`,
      type: "пассив",
      fragment: m[0],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      suggestion: "По возможности замените пассивную конструкцию активной.",
    });
  }

  for (const m of text.matchAll(/(?:^|[.!?]\s+|\n\s*)(Это|То|Тот|Эта|Эти|Данный|Вышеуказанный)\s+/gu)) {
    const start = (m.index ?? 0) + m[0].search(/(Это|То|Тот|Эта|Эти|Данный|Вышеуказанный)/u);
    issues.push({
      id: `issue-${idx++}`,
      type: "неопределённый-указатель",
      fragment: m[1],
      line: getLineFromIndex(text, start),
      start,
      end: start + m[1].length,
      suggestion: "Уточните, к какому объекту относится указательное слово.",
    });
  }

  const seen = new Map<string, number[]>();
  for (const m of text.matchAll(/[А-Яа-яЁёA-Za-z]{5,}/gu)) {
    const word = m[0].toLowerCase();
    const start = m.index ?? 0;
    const arr = seen.get(word) ?? [];
    arr.push(start);
    seen.set(word, arr);
  }
  for (const [word, positions] of seen) {
    if (positions.length >= 3) {
      const start = positions[1];
      issues.push({
        id: `issue-${idx++}`,
        type: "повтор",
        fragment: word,
        line: getLineFromIndex(text, start),
        start,
        end: start + word.length,
        suggestion: "Проверьте, не стоит ли заменить повтор синонимом или местоимением.",
      });
    }
  }

  const COLLOQ = ["как бы", "вообще", "ну", "в принципе", "типа", "по сути"];
  for (const phrase of COLLOQ) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      issues.push({
        id: `issue-${idx++}`,
        type: "разговорный-маркер",
        fragment: m[0],
        line: getLineFromIndex(text, start),
        start,
        end: start + m[0].length,
        suggestion: "Уберите разговорный маркер или замените нейтральной формулировкой.",
      });
    }
  }

  for (const m of text.matchAll(/  +/gu)) {
    const start = m.index ?? 0;
    issues.push({
      id: `issue-${idx++}`,
      type: "пунктуация",
      fragment: "двойной пробел",
      line: getLineFromIndex(text, start),
      start,
      end: start + m[0].length,
      suggestion: "Удалите лишние пробелы.",
    });
  }

  const BUREAUCRATIC = ["в рамках", "осуществление", "производить анализ", "настоящий", "данный факт"];
  for (const phrase of BUREAUCRATIC) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      issues.push({
        id: `issue-${idx++}`,
        type: "канцелярит",
        fragment: m[0],
        line: getLineFromIndex(text, start),
        start,
        end: start + m[0].length,
        suggestion: "Переформулируйте проще и конкретнее.",
      });
    }
  }

  return issues.sort((a, b) => a.start - b.start);
}

export function convertCitations(text: string, target: CitationStyle, customRules?: CustomCitationRules): { text: string; converted: number; warnings: string[] } {
  const warnings: string[] = [];
  let converted = 0;
  let out = text;

  if (target === "APA") {
    out = out.replace(/\[(\d+)\]/gu, (_m, n) => { converted++; return `(Source ${n}, 2020)`; });
  } else if (target === "Chicago") {
    out = out.replace(/\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu, (_m, inner) => {
      converted++; return `${inner}.`;
    });
  } else if (target === "IEEE" || target === "Vancouver") {
    let counter = 1;
    out = out.replace(/\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu, () => `[${counter++}]`);
  } else if (target === "GOST") {
    out = out.replace(/\(([^()\n]{1,120}?\d{4}[a-z]?[^()\n]{0,60}?)\)/gu, (_m, _inner) => { converted++; return `[1]`; });
  } else if (target === "Custom" && customRules) {
    const lines = out.split("\n");
    let changes = 0;
    let absoluteOffset = 0;
    const found = findCitations(out)
      .filter(it => it.type !== "quote")
      .filter(it => it.type !== "inline-numeric")
      .sort((a, b) => a.start - b.start);
    for (const item of found) {
      const lineIdx = getLineFromIndex(out, item.start) - 1;
      const localLine = lines[lineIdx];
      if (!localLine) continue;
      const lineStartAbs = absoluteOffset;
      const relStart = item.start - lineStartAbs;
      const relEnd = item.end - lineStartAbs;
      if (relStart < 0 || relEnd > localLine.length) {
        absoluteOffset += localLine.length + 1;
        continue;
      }
      const replacement = customRules.mode === "numeric"
        ? customRules.inlineTemplate.replace(/\{n\}/g, String(changes + 1))
        : customRules.mode === "footnote"
        ? customRules.footnoteTemplate.replace(/\{n\}/g, String(changes + 1))
        : customRules.inlineTemplate
          .replace(/\{author\}/g, "Автор")
          .replace(/\{year\}/g, "2024")
          .replace(/\{title\}/g, "Название");
      lines[lineIdx] = localLine.slice(0, relStart) + replacement + localLine.slice(relEnd);
      changes++;
      absoluteOffset += localLine.length + 1;
    }
    return { text: lines.join("\n"), converted: changes, warnings };
  }

  if (converted === 0) warnings.push("Не удалось автоматически преобразовать все цитаты — проверьте вручную.");
  return { text: out, converted, warnings };
}

export function normalizeFoundItems(items: FoundItem[]): FoundItem[] {
  return items
    .slice()
    .sort((a, b) => a.start - b.start)
    .filter((item, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];
      return !(item.start === prev.start && item.end === prev.end && item.type === prev.type);
    });
}

export function convertFoundItemsToPreview(text: string, items: FoundItem[], target: CitationStyle, customRules?: CustomCitationRules): { target: CitationStyle; changes: number; preview: string } {
  const result = convertCitations(text, target, customRules);
  return { target, changes: result.converted, preview: result.text };
}
