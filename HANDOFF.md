# Кодекс — Citation Desktop (prototype)

Browser prototype designed to feel like a desktop application for students, academics, and technical writers. Russian interface, light/dark themes.

## Project path
`/home/user/workspace/citation-desktop`

## Run / build
- Dev: `cd /home/user/workspace/citation-desktop && npm run dev` (port 5000)
- Build: `npm run build` → static output at `dist/public`, server bundle at `dist/index.cjs`
- Production: `NODE_ENV=production node dist/index.cjs` (port 5000)
- Deploy: `deploy_website(project_path="/home/user/workspace/citation-desktop/dist/public")` — static-only, no backend needed

## Key files
- `client/src/App.tsx` — root, hash routing
- `client/src/pages/Workbench.tsx` — full UI (topbar, sidebar, document, inspector)
- `client/src/lib/analyze.ts` — citation finder, style detector, structure analyzer, editor rules, Chicago↔APA conversion
- `client/src/lib/importDoc.ts` — DOCX (mammoth) / TXT / MD loader with graceful fallback
- `client/src/lib/sampleDoc.ts` — APA and Chicago demo documents in Russian
- `client/src/components/ThemeProvider.tsx` — light/dark theme (no localStorage; seeded from `prefers-color-scheme`)
- `client/src/components/Logo.tsx` — inline SVG logo (two pages of a codex)
- `client/src/index.css` — academic cream + teal palette, dark mode

## Implemented features
1. **Import documents** — DOCX via dynamic `mammoth/mammoth.browser.js`; TXT/MD via `File.text()`; warning surface; two demo documents (APA and Chicago) selectable from the top bar.
2. **Find footnotes / bibliography / citations** — APA `(Author, Year)` group-aware; Chicago `[n]` numeric markers; `Ibid./Там же`; direct quotes; bibliography section detection; full footnote section parsing. Each entry shows type, fragment, line, and confidence.
3. **Citation style detection** — heuristic APA vs Chicago scoring with reasons and confidence percentage.
4. **Chicago ↔ APA conversion** — heuristic inline + bibliography transformation with diff preview (Apply / Discard); the demo Chicago document converts its bibliography entries cleanly into APA form.
5. **Word / character counts** — words, chars with/without spaces, paragraphs, lines, reading minutes.
6. **Document structure** — headings (with known Russian section names), paragraph count, bibliography/footnote section ranges; clicking a heading jumps and highlights it in the document.
7. **Academic editor (rule-based)** — long sentences, passive voice (Russian -ется/-уется), weak modal "вата", colloquialisms, vague pointers, internal word repetition, канцелярит phrases, double spaces / space before punctuation.

## UX/UI
- Desktop-style chrome: top bar with logo + doc name + actions, left sidebar navigation, central document view, right inspector pane.
- Russian interface throughout.
- Light/dark themes, toggle in top bar.
- Academic palette: warm cream surfaces, deep Hydra teal accent, serif body for document view, sans-serif for chrome.
- `data-testid` on every interactive element (`button-import`, `select-demo`, `nav-citations`, `input-search`, `select-target`, `button-preview-convert`, `button-apply`, etc.).
- No localStorage / sessionStorage / IndexedDB / cookies anywhere.

## Verified (Playwright)
- App boots without console errors.
- APA demo loaded: 25 citation items found, style = APA, confidence = 100%, 11 editor issues.
- Chicago demo loaded: 15 inline + bib items, style = Chicago, confidence = 76%, with 4 numeric markers, 2 Ibid., 3 footnotes, 3 bib entries.
- Convert Chicago→APA produces 7 inline rewrites and 3 bibliography rewrites in preview, Apply replaces the source.
- Dark mode renders correctly (full document and inspector).

## Known limitations
- DOCX import uses mammoth's plain-text extractor — formatting (lists, tables, footnotes carried inside DOCX's `<w:footnoteReference>`) becomes plain text.
- Style detection and conversion are heuristic; they will miss exotic patterns (LaTeX-only refs, GOST, ГОСТ-style bibliography, Vancouver style).
- The inline-APA detector is parenthesis-based; bare-text "Author (Year)" references show in counts via group regex when wrapped in parens, but standalone "Smith (2019)" outside a parenthesis is not captured as an inline citation (only the quote pattern catches it via the `«…» (…)` rule).
- Editor rules are purely lexical; no real grammar parser. Russian passive heuristic relies on simple suffix matching and will produce false positives.
- Conversion does not synthesize missing author/year for Chicago→APA when numeric markers reference footnote text — it inserts a `(Автор, г.)` placeholder.

## Screenshots
- `/home/user/workspace/citation-desktop-1.png` — citations panel, APA demo
- `/home/user/workspace/citation-desktop-2-style.png` — style detection panel
- `/home/user/workspace/citation-desktop-3-editor.png` — editor issues
- `/home/user/workspace/citation-desktop-4-convert.png` — conversion preview
- `/home/user/workspace/citation-desktop-10-chicago-style.png` — Chicago demo, style panel
- `/home/user/workspace/citation-desktop-12-darkmode.png` — dark mode
- `/home/user/workspace/citation-desktop-13-convert-bottom.png` — bibliography conversion previews

## Deployment note
This is static-only; deploy `dist/public`. The Express backend in the template is unused — the app is pure client-side React with no API calls.
