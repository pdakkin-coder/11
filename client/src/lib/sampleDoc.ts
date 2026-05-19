// Demo documents for every citation style supported by CitaDex.
// Each sample contains: body text with in-text citations, direct quotes,
// footnotes/endnotes and a bibliography / reference list — so analysis
// algorithms can be exercised end-to-end.

export const SAMPLE_DOC_TITLE = "Цифровая память архива: между сохранением и забвением";

// --- APA (existing — kept for backwards-compat exports) -------------------
export const SAMPLE_DOC = `Цифровая память архива: между сохранением и забвением

Введение

Современные исследования цифровых архивов сталкиваются с проблемой устаревания носителей и форматов. Как отмечает Smith (2019), «архив не есть пассивное хранилище, но активный участник производства памяти» (с. 47). Этот тезис согласуется с более ранней работой, в которой Иванов и Петрова (2017) показали, что выбор формата напрямую влияет на интерпретацию документа конечным пользователем (Иванов & Петрова, 2017).

Помимо этого, ряд авторов (Brown, 2020; Chen et al., 2021; Müller, 2018) предложил рассматривать архив как инфраструктуру, а не как объект. Такой сдвиг особенно важен в контексте институциональных репозиториев, где политика хранения часто определяется не научными, а юридическими и экономическими соображениями.

Методология

В качестве материала были использованы 142 цифровых коллекции, доступные через консорциум HathiTrust и Europeana. Анализ проводился в три этапа: каталогизация метаданных, кластеризация по форматам и качественное чтение сопроводительной документации.

Результаты и обсуждение

Полученные данные согласуются с выводами Garcia (2022) о том, что миграция данных приводит к селективной потере семантических связей. Аналогичные процессы описаны в обзорной работе Williams (2018), где автор отмечает: «формат — это не нейтральный контейнер, а форма прочтения» (с. 113).

Заключение

Цифровой архив требует не только технического обслуживания, но и постоянной герменевтической работы.

Примечания

1. Подробнее о понятии «активный архив» см. Smith (2019), особенно гл. 3.
2. Кодировщики прошли двухнедельное обучение, согласованность оценивалась по κ Коэна.

Список литературы

Brown, A. (2020). The infrastructure of memory. Journal of Digital Humanities, 9(2), 12–34.

Chen, L., Park, S., & Tanaka, R. (2021). Format migration in institutional repositories. Library Quarterly, 91(3), 245–268.

Garcia, M. (2022). Lossy archives: A critique of digital preservation. Cambridge University Press.

Müller, H. (2018). Archive als Infrastruktur. De Gruyter.

Smith, J. (2019). The active archive. Oxford University Press.

Williams, K. (2018). Reading the format. New Media & Society, 20(1), 99–120.

Иванов, А., & Петрова, Е. (2017). Цифровые архивы России: между правом и памятью. Москва: НЛО.

Кузнецова, О. (2019). Рукописное наследие в цифровую эпоху. Санкт-Петербург: Алетейя.
`;

// --- Chicago (notes & bibliography) ---------------------------------------
export const SAMPLE_CHICAGO_DOC = `Память и архитектура: заметки о городском забвении

Введение

Городская память, как утверждает Дженкс, есть «совокупность намеренных и непреднамеренных свидетельств о прошлом, закреплённых в материальной среде».[1] Эта идея получила развитие в работах нескольких поколений исследователей.[2]

Особый интерес представляет позиция Алоиса Ригля, согласно которой памятник обладает несколькими формами ценности одновременно.[3] Ibid., 45.

Заключение

Город живёт не только тем, что он помнит, но и тем, что он систематически забывает.[4]

Сноски

1. Charles Jencks, The Language of Post-Modern Architecture (London: Academy Editions, 1977), 23.

2. Pierre Nora, Les Lieux de Mémoire (Paris: Gallimard, 1984), 18–22.

3. Alois Riegl, Der moderne Denkmalkultus (Wien: Braumüller, 1903), 12.

4. Ibid., 67.

Библиография

Jencks, Charles. The Language of Post-Modern Architecture. London: Academy Editions, 1977.

Nora, Pierre. Les Lieux de Mémoire. Paris: Gallimard, 1984.

Riegl, Alois. Der moderne Denkmalkultus. Wien: Braumüller, 1903.
`;

// --- MLA ------------------------------------------------------------------
export const SAMPLE_MLA_DOC = `Поэтика молчания в поздней прозе Беккета

Введение

Поздняя проза Сэмюэля Беккета строится на парадоксе высказывания, которое стремится к собственному исчезновению (Kenner 142). Как отмечает один из исследователей, «молчание у Беккета не отсутствие речи, а её предельная форма» (Casanova 88).

Эту мысль развивает и Connor, утверждая, что «беккетовский голос всегда возвращается к точке, в которой говорить уже невозможно» (Connor 35).

Помимо этого, ряд работ обращает внимание на ритм пауз (Begam 12–14; Knowlson 271).

Заключение

Молчание становится не темой, а формой письма.

Список цитированной литературы

Begam, Richard. Samuel Beckett and the End of Modernity. Stanford UP, 1996.

Casanova, Pascale. Samuel Beckett: Anatomy of a Literary Revolution. Verso, 2006.

Connor, Steven. Samuel Beckett: Repetition, Theory and Text. Blackwell, 1988.

Kenner, Hugh. A Reader's Guide to Samuel Beckett. Farrar, Straus and Giroux, 1973.

Knowlson, James. Damned to Fame: The Life of Samuel Beckett. Bloomsbury, 1996.
`;

// --- IEEE -----------------------------------------------------------------
export const SAMPLE_IEEE_DOC = `Энергоэффективные протоколы маршрутизации для беспроводных сенсорных сетей

Введение

Беспроводные сенсорные сети (WSN) широко применяются в системах мониторинга окружающей среды [1]. Ограниченный энергетический бюджет узлов делает задачу энергоэффективной маршрутизации одной из центральных [2], [3].

Классический протокол LEACH [4] разделяет узлы на кластеры и периодически выбирает кластерные головы. Последующие модификации, такие как HEED [5], учитывают остаточную энергию узлов и плотность связности.

Методология

Мы сравнили четыре протокола: LEACH [4], HEED [5], PEGASIS [6] и TEEN [7] в симуляторе NS-3.

Результаты

Время жизни сети при использовании HEED оказалось на 27% выше, чем у LEACH [5], что подтверждает выводы [3].

References

[1] I. F. Akyildiz, W. Su, Y. Sankarasubramaniam, and E. Cayirci, "Wireless sensor networks: a survey," Computer Networks, vol. 38, no. 4, pp. 393–422, 2002.

[2] J. N. Al-Karaki and A. E. Kamal, "Routing techniques in wireless sensor networks: a survey," IEEE Wireless Communications, vol. 11, no. 6, pp. 6–28, 2004.

[3] K. Akkaya and M. Younis, "A survey on routing protocols for wireless sensor networks," Ad Hoc Networks, vol. 3, no. 3, pp. 325–349, 2005.

[4] W. R. Heinzelman, A. Chandrakasan, and H. Balakrishnan, "Energy-efficient communication protocol for wireless microsensor networks," in Proc. HICSS, 2000, pp. 1–10.

[5] O. Younis and S. Fahmy, "HEED: A hybrid, energy-efficient, distributed clustering approach for ad hoc sensor networks," IEEE Trans. Mobile Comput., vol. 3, no. 4, pp. 366–379, 2004.

[6] S. Lindsey and C. S. Raghavendra, "PEGASIS: power-efficient gathering in sensor information systems," in Proc. IEEE Aerospace Conf., 2002, pp. 1125–1130.

[7] A. Manjeshwar and D. P. Agrawal, "TEEN: a routing protocol for enhanced efficiency in wireless sensor networks," in Proc. IPDPS, 2001, pp. 2009–2015.
`;

// --- Vancouver (medical numeric) ------------------------------------------
export const SAMPLE_VANCOUVER_DOC = `Эффективность противовоспалительной терапии при ревматоидном артрите

Введение

Ревматоидный артрит остаётся одной из ведущих причин инвалидизации работоспособного населения (1). Современные рекомендации EULAR подчёркивают раннее начало базисной терапии (2,3).

Метотрексат является препаратом первой линии (4). В ряде исследований показано, что комбинация метотрексата с биологическими агентами повышает частоту достижения ремиссии (5–7).

Методы

Проведён ретроспективный анализ 312 историй болезни пациентов с диагнозом РА за период 2019–2023 годов (8).

Результаты

Достижение ремиссии DAS28 < 2,6 за 24 недели отмечено у 41% пациентов на монотерапии и у 63% — в группе комбинированной терапии (5).

Список литературы

1. Smolen JS, Aletaha D, McInnes IB. Rheumatoid arthritis. Lancet. 2016;388(10055):2023–38.

2. Smolen JS, Landewé RBM, Bijlsma JWJ, et al. EULAR recommendations for the management of rheumatoid arthritis. Ann Rheum Dis. 2020;79(6):685–99.

3. Singh JA, Saag KG, Bridges SL Jr, et al. 2015 American College of Rheumatology guideline for the treatment of rheumatoid arthritis. Arthritis Rheumatol. 2016;68(1):1–26.

4. Weinblatt ME. Methotrexate in rheumatoid arthritis: a quarter century of development. Trans Am Clin Climatol Assoc. 2013;124:16–25.

5. Klareskog L, van der Heijde D, de Jager JP, et al. Therapeutic effect of the combination of etanercept and methotrexate compared with each treatment alone in patients with rheumatoid arthritis. Lancet. 2004;363(9410):675–81.

6. Emery P, Breedveld FC, Hall S, et al. Comparison of methotrexate monotherapy with a combination of methotrexate and etanercept. Lancet. 2008;372(9636):375–82.

7. Maini RN, Breedveld FC, Kalden JR, et al. Sustained improvement over two years in physical function, structural damage, and signs and symptoms among patients with rheumatoid arthritis treated with infliximab and methotrexate. Arthritis Rheum. 2004;50(4):1051–65.

8. Ivanov A, Petrova E. Регистр пациентов с РА Северо-Западного региона: дизайн и первые результаты. Терапевтический архив. 2022;94(5):512–9.
`;

// --- Harvard --------------------------------------------------------------
export const SAMPLE_HARVARD_DOC = `Корпоративная социальная ответственность и репутация фирмы

Введение

Концепция корпоративной социальной ответственности (КСО) прошла путь от факультативной риторики до встроенного элемента стратегии компании (Carroll 1999, p. 268). По мнению ряда авторов, КСО положительно связана с финансовой результативностью (Orlitzky, Schmidt & Rynes 2003).

Однако эта связь не является линейной. Margolis, Elfenbein & Walsh (2009) показывают, что эффект сильнее в отраслях с высокой репутационной чувствительностью.

Методология

Использован панельный анализ 286 публичных компаний за 2010–2022 годы (Surroca, Tribó & Waddock 2010).

Результаты

Подтверждено, что инвестиции в КСО положительно связаны с индексом репутации (β = 0.27, p < 0.01) (Servaes & Tamayo 2013).

Список литературы

Carroll, A.B. 1999, 'Corporate social responsibility: evolution of a definitional construct', Business & Society, vol. 38, no. 3, pp. 268–295.

Margolis, J.D., Elfenbein, H.A. & Walsh, J.P. 2009, Does it pay to be good… and does it matter? A meta-analysis of the relationship between corporate social and financial performance, Harvard Business School Working Paper.

Orlitzky, M., Schmidt, F.L. & Rynes, S.L. 2003, 'Corporate social and financial performance: a meta-analysis', Organization Studies, vol. 24, no. 3, pp. 403–441.

Servaes, H. & Tamayo, A. 2013, 'The impact of corporate social responsibility on firm value: the role of customer awareness', Management Science, vol. 59, no. 5, pp. 1045–1061.

Surroca, J., Tribó, J.A. & Waddock, S. 2010, 'Corporate responsibility and financial performance: the role of intangible resources', Strategic Management Journal, vol. 31, no. 5, pp. 463–490.
`;

// --- GOST (ГОСТ Р 7.0.5) ---------------------------------------------------
export const SAMPLE_GOST_DOC = `Информационные технологии в системе государственного управления

Введение

Цифровизация государственного управления в России развивается с начала 2000-х годов [1, с. 12]. Как отмечает Иванов, «электронное правительство — это не столько техническая инфраструктура, сколько социальный институт» [2, с. 47].

Концепция «государства как платформы» получила развитие в работах [3] и [4].

Методология

Использован сравнительный анализ нормативных актов и эмпирических данных Росстата за период 2015–2023 гг. [5].

Результаты

Индекс развития электронного правительства Российской Федерации, по оценке ООН, вырос с 0,7 до 0,8 за пять лет [6, с. 23].

Примечания

¹ В рамках Указа Президента РФ от 7 мая 2018 г. № 204 «О национальных целях и стратегических задачах развития РФ на период до 2024 года».
² Здесь и далее — данные Минцифры РФ.

Список литературы

1. Иванов А.А. Электронное правительство: теория и практика. — М.: Юрайт, 2021. — 320 с.

2. Петров В.С. Цифровая трансформация государства: монография. — СПб.: Питер, 2020. — 256 с.

3. Сидоров Н.И., Кузнецова О.А. Государство как платформа: новые модели взаимодействия с гражданами // Вопросы государственного и муниципального управления. — 2022. — № 3. — С. 45–67.

4. О Стратегии развития информационного общества в Российской Федерации на 2017–2030 годы: Указ Президента РФ от 09.05.2017 № 203 // Собрание законодательства РФ. — 2017. — № 20. — Ст. 2901.

5. Цифровая Россия: новая реальность / под ред. Ю. Б. Грязновой. — М.: Альпина Паблишер, 2023. — 480 с.

6. United Nations E-Government Survey 2022 [Электронный ресурс]. — Режим доступа: https://publicadministration.un.org (дата обращения: 15.03.2024).
`;

// --- Custom / Author ------------------------------------------------------
export const SAMPLE_CUSTOM_DOC = `Нарративные стратегии цифровой документалистики

Введение

В цифровой документалистике автор перестаёт быть только повествователем — он становится монтажёром и куратором архивных материалов {Иванов 2021: 42}. Как отмечает другой исследователь, «зритель проходит сквозь материал, выбирая собственную траекторию интерпретации» {Smith 2020: 17}.

Влияние интерактивности на восприятие документального материала рассматривалось в работах {Chen 2019: 88}, {Müller 2022: 145} и {Гарсия 2023: 12}.

Методология

Кейс-стади четырёх интерактивных документальных проектов 2015–2023 годов {Brown 2018: 33}.

Заключение

Цифровая документалистика становится формой соавторства автора и зрителя.

Список литературы

Brown A. Interactive Documentary as a Field of Research. — Routledge, 2018.

Chen L. The Viewer in the Database. — MIT Press, 2019.

Müller H. Erzählformen im digitalen Dokumentarfilm. — De Gruyter, 2022.

Smith J. Documentary in the Age of Networks. — Oxford UP, 2020.

Гарсия М. Архив как сцена: цифровые документальные практики. — М.: НЛО, 2023.

Иванов А. Документалистика после интернета. — СПб.: Сеанс, 2021.
`;

export type DemoId = "apa" | "chicago" | "mla" | "ieee" | "vancouver" | "harvard" | "gost" | "custom";

export interface DemoEntry {
  id: DemoId;
  label: string;
  title: string;
  text: string;
}

export const DEMO_DOCS: DemoEntry[] = [
  { id: "apa", label: "Демо · APA (рус.)", title: SAMPLE_DOC_TITLE, text: SAMPLE_DOC },
  { id: "chicago", label: "Демо · Chicago", title: "Память и архитектура", text: SAMPLE_CHICAGO_DOC },
  { id: "mla", label: "Демо · MLA", title: "Поэтика молчания у Беккета", text: SAMPLE_MLA_DOC },
  { id: "ieee", label: "Демо · IEEE", title: "Энергоэффективные WSN", text: SAMPLE_IEEE_DOC },
  { id: "vancouver", label: "Демо · Vancouver", title: "Терапия ревматоидного артрита", text: SAMPLE_VANCOUVER_DOC },
  { id: "harvard", label: "Демо · Harvard", title: "КСО и репутация", text: SAMPLE_HARVARD_DOC },
  { id: "gost", label: "Демо · ГОСТ", title: "ИТ в госуправлении", text: SAMPLE_GOST_DOC },
  { id: "custom", label: "Демо · Авторский", title: "Цифровая документалистика", text: SAMPLE_CUSTOM_DOC },
];
