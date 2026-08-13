# SPECLENS_REPOSITORY_AUDIT.md

A read-only reconnaissance of the `spec-lens` repository as delivered. No files were modified. The audit covers only what is actually present in the tree on the day of inspection.

---

## 1. Executive summary

The repository is a **frontend-only** TanStack Start application that already implements the *full* SpecLens product surface in demo mode. There is **no backend, no Python, no ML pipeline, no vector database, no database, no Docker, no env files, and no test suite** in the tree. Every number, document, page, region, evidence entry, processing job, retrieval result and Copilot reply is a typed mock that the UI consumes through a single service object designed to be 1:1 swappable for a real backend.

What the repo *does* deliver, end-to-end against the README spec:

- A complete application shell (sidebar, header, command palette, notification center, mobile drawer)
- Landing page, sign-in, sign-up, and 3-step onboarding
- Command Center dashboard with KPI cards and activity feed
- Datasheet library (grid/list, search, sort, favorites)
- Drag-and-drop upload with animated 8-stage processing timeline
- Visual search with type facets and confidence slider
- Search results with bbox-highlighted synthetic pages
- Evidence Explorer with split PDF/inspector view, zoom, page nav, raw-metadata reveal
- Component intelligence with 5 tabs (Overview / Evidence / Graph / Related / History)
- Evidence graph (SVG, animated dashed connectors)
- SpecLens Copilot chat with grounded sources
- Symbol Studio with synthetic symbol preview, pin list, and validation checklist
- Collections, Search history, Processing monitor, Analytics (recharts), Developer console, Help, Settings (8 tabs)
- A typed `api` service layer whose 1:1 endpoint mapping is the **frontend's contract for the future backend**

In short: the *SpecLens frontend is already built*. The audit's actionable output is the alignment between what the frontend already models and what a real backend will eventually need to provide.

---

## 2. Current architecture

### 2.1 Tech stack (only what is actually wired)

- **Framework**: TanStack Start 1.168.x with TanStack Router 1.170.x (file-based routes, generated `routeTree.gen.ts`).
- **UI runtime**: React 19.2, React DOM 19.2.
- **Build**: Vite 8.2 with the `@lovable.dev/vite-tanstack-config` preset. The preset already provides: TanStack devtools (dev-only), `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, Nitro (build-only, Cloudflare target by default), `VITE_*` env injection, `@/` alias, React/TanStack dedupe, error logger, and sandbox port/host detection. The app's `vite.config.ts` only adds `tanstackStart.server.entry: "server"` to point Nitro at `src/server.ts`.
- **Styling**: Tailwind v4.2 via `@tailwindcss/vite`, design tokens as CSS variables in `src/styles.css` (oklch, dark-first). shadcn/ui primitives (`new-york` style, `slate` base) under `src/components/ui/`.
- **State / data**: TanStack React Query 5.101 (provider in `__root.tsx`).
- **Forms / validation**: react-hook-form 7.71 + zod 3.24 + `@hookform/resolvers`.
- **Icons / charts / dialogs**: `lucide-react` 0.575, `recharts` 2.15, `cmdk` 1.1, `vaul` 1.1, `sonner` 2.0.
- **Other libs of note**: `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`.
- **Package manager**: Bun (lockfile + `bunfig.toml`). The `bunfig.toml` enforces a 24h `minimumReleaseAge` for supply-chain safety, with an allowlist for `@lovable.dev/*` packages.
- **TypeScript**: 5.8, strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on.

### 2.2 SSR / runtime plumbing

- `src/router.tsx` builds the router with a `QueryClient` in context and `scrollRestoration: true`.
- `src/routes/__root.tsx` wraps every route in `QueryClientProvider` and renders `<Outlet />` inside `<html>`/`<body>`. Defines the global 404 and error components; the error path calls `reportLovableError`.
- `src/start.ts` configures TanStack Start with two middlewares: a server error handler that returns the rendered error page on any non-HTTP throw, and CSRF protection for `serverFn` calls.
- `src/server.ts` is the Nitro SSR entry. h3 silently converts in-handler throws into a `{"unhandled":true,"message":"HTTPError"}` 500 body. `server.ts` detects that body, recovers the original error from `error-capture.ts`, and substitutes a real HTML error page.
- `src/lib/error-capture.ts` monkey-patches `console.error` to retain the most recent `Error` for 5 seconds, and registers `error`/`unhandledrejection` listeners. `consumeLastCapturedError()` is the recovery hook.
- `src/lib/lovable-error-reporting.ts` forwards React boundary errors to the Lovable editor's telemetry.

### 2.3 Module map

```
src/
  routes/                  17 file-based routes (see §3)
    routeTree.gen.ts       AUTO-GENERATED — never edit
    README.md              File-routing conventions
  start.ts / server.ts / router.tsx
  styles.css               Tailwind v4 + design tokens (oklch)
  components/
    ui/                    40 shadcn primitives (button, dialog, sheet, popover, …)
    speclens/              App-specific (see §8)
  lib/
    utils.ts               cn() = twMerge(clsx(...))
    error-page.ts          renderErrorPage() — fatal SSR HTML
    error-capture.ts       recovers the original error after h3 swallows it
    lovable-error-reporting.ts
    speclens/
      config.ts            DEMO_MODE flag, API_BASE, APP_NAME/TAGLINE
      types.ts             Single source of truth for the domain model
      api.ts               Service object: 1 function per planned backend endpoint
      mock-data.ts         Typed mock dataset (see §6)
  hooks/
    use-mobile.tsx
public/
  favicon.ico
  robots.txt               Allows all crawlers (no Disallow rules)
```

---

## 3. Frontend status

### 3.1 Routes (every flat file in `src/routes/`)

| Route | File | Purpose | Real backend dependency |
| --- | --- | --- | --- |
| `/` | `index.tsx` | Marketing landing (hero, pipeline viz, product preview, capabilities, CTA) | none |
| `/login` | `login.tsx` | Email/password sign-in + SSO buttons; 400ms simulated delay → `/app` | auth |
| `/register` | `register.tsx` | Sign-up with role select (Student/Researcher/Engineer/Engineering Team/Organization) | auth |
| `/onboarding` | `onboarding.tsx` | 3-step workspace setup (focus areas → first collection → invite) | onboarding |
| `/app` (layout) | `app.tsx` | Wraps all `/app/*` in `<AppShell>` (sidebar, header, ⌘K, notifications, workspace switcher) | session |
| `/app` | `app.index.tsx` | Command Center dashboard: KPI cards, recent datasheets, activity feed | analytics, activity, datasheets |
| `/app/datasheets` | `app.datasheets.tsx` | Library: grid/list, search, sort, favorites, status pill | datasheets |
| `/app/upload` | `app.upload.tsx` | Drag-and-drop PDF upload, animated 8-stage progress | upload, jobs |
| `/app/search` | `app.search.tsx` | Visual search input, type facets, confidence slider, ranked result list | search |
| `/app/evidence` | `app.evidence.tsx` | Split-view: synthetic PDF + bbox + zoom + page nav + right-side metadata + raw-metadata reveal | evidence, jobs |
| `/app/components` | `app.components.tsx` | Component intelligence: 5 tabs (Overview, Evidence, Graph, Related, History) | component, evidence |
| `/app/copilot` | `app.copilot.tsx` | Chat UI with grounded answer + sources list | copilot |
| `/app/symbols` | `app.symbols.tsx` | Symbol Studio: MPN input, Generate/Validate/Export buttons, SVG symbol preview, pin list | symbol |
| `/app/analytics` | `app.analytics.tsx` | Recharts: line, bar, pie, area charts; date-range filter | analytics |
| `/app/monitor` | `app.monitor.tsx` | Processing monitor: job list + stage grid + log pre + error state | jobs |
| `/app/collections` | `app.collections.tsx` | Collection cards with datasheets/evidence/components counts | collections |
| `/app/history` | `app.history.tsx` | Search history with Re-run / Delete | history |
| `/app/developer` | `app.developer.tsx` | Endpoint picker + Run / Copy, surfaces real `api.*` responses | none (uses `api`) |
| `/app/settings` | `app.settings.tsx` | 8 tabs: profile, workspace, appearance, notifications, search, ai, data, developer | session, settings |
| `/app/help` | `app.help.tsx` | FAQ accordion + keyboard shortcut list | none |

### 3.2 Authentication

- `DEMO_MODE` is `true` in `src/lib/speclens/config.ts`. Login and register forms are not validated; any submit navigates to `/app` after a 400ms delay. `AuthLayout` in `login.tsx` exports a `Demo mode — authentication is not connected; any input opens the workspace.` notice.
- No auth library is installed. No session cookie / token logic exists.
- A `User` type and a `mockUser` are defined; the only place it's rendered is the workspace switcher in the sidebar.

### 3.3 Build / dev / deploy

- `bun run dev` → `vite dev` (TanStack Start dev).
- `bun run build` → `vite build` (Nitro Cloudflare target by default).
- `bun run build:dev` → dev-mode build.
- `bun run preview` → `vite preview`.
- `bun run lint` → ESLint flat config, with `eslint-plugin-prettier/recommended` last.
- `bun run format` → `prettier --write .`.
- No tests, no CI config (no `.github/` directory), no Dockerfile, no wrangler config, no env files.

### 3.4 What's *not* there on the frontend

- No PDF text extraction / rendering — `DocPage` is a hand-drawn SVG that stands in for a PDF page.
- No real client-side PDF.js.
- No WebSocket / SSE wiring for live job progress — upload simulates stage transitions with `setTimeout` (`app.upload.tsx:33-37`).
- No image hosting or S3 — `cropUri` is a `s3://speclens-demo/...` string in mock data.
- No image `<img>` rendering of crops — `DocPage` only draws the bounding box; no actual bitmap.

---

## 4. Backend status

**There is no backend in this repository.** No Python, Node service, Go, Rust, or other language sources are present. No `Dockerfile`, no `docker-compose.yml`, no `pyproject.toml`, no `requirements.txt`, no `Pipfile`. No `.env`, `.env.example`, `wrangler.toml`, or other runtime config. No `prisma/`, `drizzle/`, `migrations/`, or schema files. No `qdrant/`, `weaviate/`, `chroma/`, or vector DB config. No scripts directory.

The only server-side code is TanStack Start's Nitro SSR entry (`src/server.ts`) and the `start.ts` middleware layer. Both are pure Node-edge plumbing for the React app — they do not call any external service and do not persist data.

---

## 5. Important modules

Listed in priority order for a backend author to read first.

1. `src/lib/speclens/types.ts` — the entire domain model (15+ interfaces). This is the contract.
2. `src/lib/speclens/api.ts` — the 14 service methods, each documented with its planned HTTP route. This is the call-site list.
3. `src/lib/speclens/config.ts` — `DEMO_MODE`, `API_BASE = "/api"`. Single line to flip when wiring the real backend.
4. `src/lib/speclens/mock-data.ts` — every fixture the UI ever renders. Useful as the schema source of truth and as test data.
5. `src/components/speclens/app-shell.tsx` — defines the entire information architecture: primary, secondary, tertiary nav.
6. `src/components/speclens/doc-page.tsx` — the synthetic page + bbox renderer. This is the swap point for a real PDF viewer.
7. `src/components/speclens/evidence-ui.tsx` — `EvidenceTypeBadge`, `VerificationBadge`, `ConfidenceBar`, `evidenceIcon` map. The visualization vocabulary.
8. `src/routeTree.gen.ts` — read-only route table; never edit.
9. `src/styles.css` — design tokens. Reuse the variable names (`--primary`, `--surface`, `--success`, etc.) anywhere new surfaces are built.
10. `src/components/speclens/primitives.tsx` — `PageHeader`, `KpiCard`, `Section`, `EmptyState`, `ErrorState`, `DemoNotice`.

---

## 6. Important data models

All defined in `src/lib/speclens/types.ts`. Reproduced here as the authoritative shape the backend must serve.

```ts
type UserRole = "Student" | "Researcher" | "Engineer" | "Engineering Team" | "Organization";

interface User         { id; name; email; role: UserRole; initials; }
interface Workspace    { id; name; plan; members; }

type IndexStatus      = "indexed" | "indexing" | "queued" | "failed";
interface Datasheet    { id; mpn; manufacturer; title; fileName; pages; sizeMb;
                        status: IndexStatus; evidenceCount; updatedAt; favorite;
                        collections: string[]; accent: "cyan"|"violet"|"amber"|"green"; }

type EvidenceType     = "pinout" | "package" | "block-diagram" | "timing"
                      | "application-circuit" | "electrical-curve" | "mechanical"
                      | "table" | "absolute-maximum" | "functional-diagram" | "other";

interface BoundingBox  { x; y; w; h; }            // normalized 0..1 of the page
type VerificationState= "verified" | "unverified" | "flagged";

interface Evidence     { id; documentId; mpn; manufacturer; title; type: EvidenceType;
                        page; totalPages; bbox: BoundingBox; confidence;
                        verification: VerificationState; caption; cropUri;
                        matchedBy: string[]; retrievalScore; modelVersion; timestamp; }

interface SearchResultSet { query; latencyMs; total; results: Evidence[];
                            facets: { type: EvidenceType; count: number }[]; }
interface SearchFilters   { types?: EvidenceType[]; manufacturer?; documentId?;
                            minConfidence?; page?: number | null; }

interface ComponentIntel { mpn; manufacturer; family; description; packages: string[];
                          channels; specs: { label; value }[];
                          verified: { type: EvidenceType; label; ok: boolean }[];
                          related: { mpn; note }[];
                          history: { at; event }[]; }

interface Collection   { id; name; description; datasheets; evidence; components; updatedAt; }

type JobStageState    = "done" | "active" | "pending" | "failed";
interface JobStage     { key; label; state: JobStageState; }
interface ProcessingJob{ id; fileName; mpn; status: "queued"|"processing"|"complete"|"failed";
                        progress; pages; sizeMb; stages: JobStage[];
                        logs: { at; line; level?: "info"|"warn"|"error" }[]; startedAt; }

interface Analytics    { metrics: { label; value; delta; positive: boolean }[];
                        retrieval: { day; precision; recall }[];
                        evidenceDistribution: { type; count }[];
                        queryTypes: { name; value }[];
                        throughput: { hour; pages }[];
                        confidence: { bucket; count }[]; }

interface CopilotSource{ evidenceId; page; label; confidence; }
interface CopilotMessage{ id; role: "user"|"assistant"; content;
                          sources?: CopilotSource[]; confidence?: number; pending?: boolean; }

interface SymbolPin    { number; name; electrical; side: "left"|"right"|"top"|"bottom"; evidenceId; }
interface SymbolSpec   { mpn; package; pins: SymbolPin[];
                        validation: { label; ok: boolean }[];
                        stage: "spec"|"validation"|"compilation"|"preview"; }

interface SearchHistoryEntry { id; query; mpn; results; bestConfidence; at; }
interface ActivityEvent       { id; kind: "index"|"detect"|"query"|"verify"|"error";
                                title; detail; at; }
interface AppNotification     { id; title; body; tone: "success"|"info"|"error";
                                at; read: boolean; }
```

**Backend-relevant invariants the data already implies:**

- A `Datasheet` is one indexed PDF (`fileName`, `pages`, `sizeMb`). `evidenceCount` is denormalized.
- An `Evidence` row always references a `documentId` (a Datasheet) and a `page` within that document. The `bbox` is **normalized 0..1** of the page — store page dimensions separately and recompute when rendering, or store absolute pixels.
- `matchedBy[]` is an open vocabulary (`"semantic similarity"`, `"visual similarity"`, `"figure classification"`, `"table structure parsing"`, `"axis-label OCR"`, `"caption match"`). Don't enum it server-side; treat as a free-text array.
- `VerificationState` is a tri-state per-evidence flag, not a confidence interval. The UI uses `confidence` (0..1) and `verification` as **independent** signals.
- `ProcessingJob.stages[]` carries per-stage state. The fixed stage list seen in the mock is `ingest → render → layout → regions → embed → index → verify`. The upload page uses a slightly different list (`PDF validated → Document loaded → Pages rendered → Layout analyzed → Visual regions detected → Building retrieval index → Evidence verification → Ready`). The frontend should converge on **one** stage vocabulary — currently they diverge.
- `SymbolPin.evidenceId` is the **provenance link** from a pin back to a specific `Evidence` row (e.g. a pinout). Backend should preserve this.
- `CopilotMessage` always carries `sources[]` and `confidence`. The README is explicit: **never design the assistant as an unconstrained chatbot**.

---

## 7. Existing API endpoints (planned, from the frontend contract)

These do not exist as runtime code; they are the routes declared in the comment block of `src/lib/speclens/api.ts` and surfaced in the Developer Console (`app.developer.tsx`).

| Method | Path | Service method | Notes |
| --- | --- | --- | --- |
| POST | `/api/datasheets/upload` | `api.uploadDatasheet` | Returns a `ProcessingJob`. Real impl should be a presigned-URL or multipart upload, then enqueue. |
| GET | `/api/datasheets` | `api.listDatasheets` | Free-text query across `mpn`, `manufacturer`, `title`, `fileName`. |
| GET | `/api/datasheets/:id` | `api.getDatasheet` | Single datasheet. |
| POST | `/api/datasheets/:id/index` | `api.indexDatasheet` | Re-index; returns `{ jobId }`. |
| GET | `/api/jobs/:id` | `api.getJob` | Full job including stages + logs. |
| GET | `/api/jobs` (implied) | `api.listJobs` | Used by Processing Monitor. |
| POST | `/api/search` | `api.search` | Body: `{ query, types?, manufacturer?, documentId?, minConfidence?, page? }`. Returns `SearchResultSet` with facets. |
| GET | `/api/evidence/:id` | `api.getEvidence` | Single evidence row. |
| GET | `/api/evidence` (implied) | `api.listEvidence` | All evidence; used by some flows. |
| GET | `/api/components/:mpn` | `api.getComponent` | `ComponentIntel`. |
| POST | `/api/copilot` | `api.askCopilot` | Body: `{ question }`. Returns a `CopilotMessage` with `sources[]` and `confidence`. **Provider is intentionally abstract — README §19 mentions NVIDIA Nemotron as the future model.** |
| POST | `/api/symbols/generate` | `api.generateSymbol` | Body: `{ mpn }`. Returns a `SymbolSpec`. The README §20 says the **frontend is not responsible for actual symbol compilation** — the backend owns the spec and (eventually) the KiCad / Eagle compile. |
| GET | `/api/analytics` | `api.getAnalytics` | Full `Analytics` payload. |
| GET | `/api/collections` | `api.listCollections` | |
| GET | `/api/session` | `api.getSession` | `{ user, workspaces }` (only consumed by `useIsMobile` indirectly). |
| GET | `/api/activity` | `api.listActivity` | `ActivityEvent[]` for Command Center feed. |
| GET | `/api/notifications` | `api.listNotifications` | `AppNotification[]` for header bell. |
| GET | `/api/history` | `api.listHistory` | `SearchHistoryEntry[]`. |
| PATCH | `/api/history/:id` (implied) | (UI deletes locally) | Re-run / delete are mocked client-side; backend will need them. |

The Developer Console (`src/routes/app.developer.tsx`) is the single most useful "API explorer" — it already binds 6 of these paths to live `api.*` calls and renders the JSON.

---

## 8. Existing reusable UI

### 8.1 App-specific (`src/components/speclens/`)

| Component | What it gives you |
| --- | --- |
| `app-shell.tsx` | Sidebar (primary/secondary/tertiary nav, workspace switcher, mobile drawer), header (breadcrumb, ⌘K trigger, demo badge, notification bell, upload CTA). Drop into any new layout. |
| `command-palette.tsx` | ⌘K / Ctrl+K palette. Currently hard-codes 8 actions and "Recent documents" from `mockDatasheets`. New commands → add to the `actions` array. |
| `doc-page.tsx` | SVG synthetic PDF page with header, body lines, figure, footer, **and an optional normalized bounding box**. Accepts `EvidenceType` and renders the appropriate schematic for `pinout`, `application-circuit`, `timing`, `electrical-curve`, `mechanical`/`package`, `block-diagram`/`functional-diagram`, `table`/`absolute-maximum`, and `other`. The `bbox` overlay supports `highlight` (animated pulse) and a `dense` variant for thumbnails. **This is the swap point for a real PDF renderer.** |
| `evidence-ui.tsx` | `evidenceIcon` map (per type), `EvidenceTypeBadge`, `VerificationBadge` (verified/unverified/flagged color tokens), `ConfidenceBar` (color-coded by threshold 0.85 / 0.93), `StatDelta`. |
| `primitives.tsx` | `PageHeader`, `Section`, `KpiCard`, `EmptyState`, `ErrorState` (with optional technical-details `<details>`), `DemoNotice`. Use these for every new page. |
| `status-pill.tsx` | `IndexStatus` pill (color: success/primary/muted/destructive). |
| `logo.tsx` | `SpecLensMark` (icon only) and `SpecLensLogo` (icon + wordmark with `Lens` colored). |

### 8.2 Design system

- Tailwind v4 with CSS-variable tokens in `src/styles.css`. Reuse `--primary`, `--surface`, `--surface-raised`, `--success`, `--warning`, `--destructive`, `--border`, `--border-strong`, `--sidebar-*`, `--chart-1..5`. Never hardcode colors.
- shadcn/ui primitives in `src/components/ui/` cover every common control (40 files). `cn()` is the universal class composition helper.
- 3 custom `@utility` rules: `grid-bg` (faint grid backdrop), `hero-glow` (radial glow), `panel` (the standard surface). Animations: `animate-rise` (entrance), `animate-pulse-ring` (focused bbox), `flow-dash` (graph edges), `scan-line`. `prefers-reduced-motion` is honored globally.

### 8.3 Things worth reusing (not currently extracted as a component but patterns used multiple times)

- The "synthetic PDF page with figure" used in `DocPage` is duplicated 5+ times across pages as inline SVG — should be promoted to a shared `PageThumb` if more thumbnails are added.
- The `KpiCard` is also duplicated inline in `app.analytics.tsx` (uses raw markup instead of importing it). Worth refactoring.
- The `ListWithHeader` pattern in Collections / History / Components could be a shared `SectionList` if it keeps growing.

---

## 9. Existing retrieval / evidence capabilities

**All retrieval behavior is currently a client-side simulation.** There is no vector index, no embedding model, no reranker, no OCR. Everything visible to the user is the result of two things:

1. A linear filter over `mockEvidence` (token presence in `{title, caption, mpn, manufacturer, evidenceTypeLabel}`).
2. A 60–900ms artificial `setTimeout` latency per call.

What the frontend *already* wires up and that a real backend can plug into without UI changes:

- **Search input**: `api.search(query, filters)` returns `SearchResultSet` with `query`, `latencyMs`, `total`, `results[]`, and `facets[]`. The UI shows the latency in the header.
- **Type facets**: counts per `EvidenceType`. The UI toggles them as filters; counts update from the current result set.
- **Min-confidence slider**: 0–99% filter applied client-side today; the field is in the `SearchFilters` interface, so the server can apply it too.
- **Manufacturer / document / page filters**: declared in `SearchFilters`; mock implementation applies them after the text scoring.
- **Ranking**: results are sorted by `retrievalScore` descending. Each `Evidence` carries both `confidence` (model confidence) and `retrievalScore` (final rank score).
- **Matched-by explainability**: `matchedBy: string[]` is rendered as the "Matched using: …" line under each result. Real backend should populate this so users understand *why* a region matched.
- **Verification state**: tri-state (`verified` / `unverified` / `flagged`) per evidence. The frontend treats verified and unverified as different visual categories.
- **Bounding box**: always normalized `0..1` over the page. The frontend multiplies by the rendered page size, so a real PDF renderer just needs to keep the same coordinate system.

What the UI represents that a backend must produce:

- **Deduplicated regions**: same logical figure on multiple pages are separate rows.
- **Per-region confidence** (0..1) and **per-region verification** (tri-state) — these are independent.
- **Provenance chain**: `documentId` → `mpn` → `page` → `bbox` → `cropUri` → `modelVersion` → `timestamp`. `cropUri` is a `s3://` URL in the mock.
- **Latency** is shown verbatim in the search header; real backend should populate.

What the README's §33 ("Mock Data Architecture") and §34 ("Backend-Ready API Contract") make explicit, and the audit confirms:

> The frontend should initially run entirely using mock data. Later we must be able to replace `mockApi.search()` with `realApi.search()` without redesigning the UI.

The code reflects this exactly: the UI calls `api.search(...)`, never reaches into `mock-data.ts` directly for retrieval. (Some pages do reach into `mock-data.ts` for read-only browse, but the read-only pattern can also flow through the `api` object with a one-line refactor.)

---

## 10. Existing symbol-generation capabilities

Symbol Studio (`src/routes/app.symbols.tsx`) is a **UI shell** for symbol generation — not a real generator.

- The page is composed of: MPN input, `Generate Symbol` / `Validate` / `Export` buttons, a 5-step pipeline chip strip (`Verified Evidence → Symbol Specification → Validation → Compilation → Preview`), an SVG symbol preview, a validation checklist, and a pin list.
- The mock `SymbolSpec` for LM358 has 8 pins (OUT1, IN1-, IN1+, GND, IN2+, IN2-, OUT2, VCC) with sides (`left` / `right` / `top` / `bottom`) and an `evidenceId` provenance link back to a pinout evidence region.
- The SVG symbol preview draws a body rectangle, left/right pin stubs with labels, and a top VCC / bottom GND line. It is intentionally simple — no IEEE symbol conventions, no KiCad/Eagle pin shape library.
- The "Generate" button calls `api.generateSymbol(mpn)` which currently returns the same mock spec with the requested MPN. "Validate" and "Export" are toast-only.
- The README §20 is explicit: *"Do not implement actual compilation unless backend support exists. For now, make the frontend architecture ready for it."* The frontend is ready. Pin provenance (`evidenceId`) and validation results are already modeled. Real compilation (KiCad `.lib`, Eagle `.lbr`, Altium `.SchLib`) belongs in the backend.

---

## 11. Dependencies

The full dependency list as installed in `package.json`. The frontend is the only consumer of these — there is no other manifest in the repo.

**Runtime (33 packages)**

- `@radix-ui/*` — 22 packages covering accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toggle, toggle-group, tooltip (Radix is the engine under shadcn).
- `@hookform/resolvers` 5.2, `react-hook-form` 7.71, `zod` 3.24
- `@tanstack/react-query` 5.101, `@tanstack/react-router` 1.170, `@tanstack/react-start` 1.168, `@tanstack/router-plugin` 1.168
- `@tailwindcss/vite` 4.2, `tailwindcss` 4.2, `tw-animate-css` 1.3
- `class-variance-authority` 0.7, `clsx` 2.1, `tailwind-merge` 3.5
- `cmdk` 1.1, `embla-carousel-react` 8.6, `input-otp` 1.4, `react-day-picker` 9.14, `react-resizable-panels` 4.6, `sonner` 2.0, `vaul` 1.1, `lucide-react` 0.575, `recharts` 2.15
- `date-fns` 4.1, `react` 19.2, `react-dom` 19.2
- `vite-tsconfig-paths` 6.0

**Dev (16 packages)**

- `vite` 8.2, `@vitejs/plugin-react` 5.2, `typescript` 5.8
- `@lovable.dev/vite-tanstack-config` 2.12 (the Vite preset; the only Lovable package in the dep list)
- `eslint` 9.32, `@eslint/js` 9.32, `typescript-eslint` 8.56, `eslint-config-prettier` 10.1, `eslint-plugin-prettier` 5.2, `eslint-plugin-react-hooks` 5.2, `eslint-plugin-react-refresh` 0.4
- `prettier` 3.7, `globals` 15.15
- `nitro` 3.0 (peer of TanStack Start)
- `@types/node`, `@types/react`, `@types/react-dom`

**No** backend deps. **No** Python tooling. **No** ML frameworks (no torch, transformers, sentence-transformers, openai, anthropic). **No** DB drivers (no postgres, redis, qdrant, weaviate, chroma, pinecone, lancedb). **No** Docker.

---

## 12. Potential frontend integration points

When the real backend lands, these are the exact files the integration touches. No other changes are needed.

| Integration | Touch | Why |
| --- | --- | --- |
| Flip demo flag | `src/lib/speclens/config.ts` (`DEMO_MODE = false`) | Removes demo badge, demo notice, "Demo value" hints. |
| Swap service impls | `src/lib/speclens/api.ts` (replace function bodies) | UI never changes. Add a `realApi` and select by `DEMO_MODE` if you want to keep mocks for tests. |
| Session bootstrap | `src/routes/__root.tsx` (loader for `getSession`) or a new `routeGuard` on `/app.tsx` | Today, `/app` is reachable without auth. |
| Real PDF viewer | `src/components/speclens/doc-page.tsx` (new `RealDocPage` parallel; pick per route) | Keep `DocPage` for thumbnails. |
| Live job progress | `src/routes/app.upload.tsx` + `src/routes/app.monitor.tsx` (SSE or polling) | Replace the `setTimeout` simulation and the static `mockJobs` list. |
| WebSocket / SSE channel | New `src/lib/speclens/realtime.ts`; consumers in `app.upload.tsx` and `app.monitor.tsx` | Real-time stage updates. |
| Real auth | `src/routes/login.tsx`, `register.tsx`, `onboarding.tsx` (form submits), `__root.tsx` (redirect on session) | Currently all forms are no-ops. |
| File upload transport | `src/routes/app.upload.tsx` (presigned URL flow vs. multipart) | The drag-and-drop UI is transport-agnostic. |
| Telemetry | `src/lib/lovable-error-reporting.ts` already wires `__lovableEvents`; replace with your sink. | |
| Notifications | `src/components/speclens/app-shell.tsx` (`NotificationBell`) | Today it reads `mockNotifications`; swap to `api.listNotifications()`. |
| Workspace switcher | `src/components/speclens/app-shell.tsx` (`SidebarBody`) | Today local state; needs server-side membership. |

**Things to *not* change on the frontend for the integration:** types in `types.ts` are the contract — extend them carefully and version them. The router and the SSR pipeline are stable. shadcn primitives and the design tokens stay.

---

## 13. Risks

1. **`routeTree.gen.ts` is regenerated by the TanStack plugin on every build.** It is currently 50+ lines of generated imports. Any manual edit will be lost. Treat it as binary.
2. **The README and the `AGENTS.md` together commit the project to a Lovable editor connection.** Pushing to the connected branch syncs back to Lovable; rewriting history (`force-push`, `rebase -i`, `amend`, `squash`) breaks that round-trip. The team should adopt a no-rebase-on-pushed-commits policy if they haven't already.
3. **Two parallel stage vocabularies exist** in the frontend — the upload page uses 8 generic stages (`PDF validated`, `Document loaded`, `Pages rendered`, `Layout analyzed`, `Visual regions detected`, `Building retrieval index`, `Evidence verification`, `Ready`) while `ProcessingJob.stages` mock data uses 7 different labels (`PDF ingestion`, `Page rendering`, `Layout analysis`, `Region detection`, `Embedding`, `Vector indexing`, `Verification`). They overlap but do not match. The backend will need to commit to one vocabulary or the frontend will need to map between them.
4. **Bounding box is normalized but the synthetic `DocPage` uses a fixed `240×320` viewport.** A real PDF renderer (PDF.js) will use a different aspect ratio. The `bbox.x/y/w/h` math is unitless, so this works, but **the same region rendered at different page sizes will appear at different positions** unless the backend also returns the page dimensions or the renderer enforces a consistent viewBox.
5. **No real PDF rendering anywhere.** Every "PDF page" is a hand-drawn SVG. Once a real renderer is in place, accessibility, page caching, text-layer search, and zoom-to-region all need to be designed in.
6. **No image rendering of evidence crops.** `DocPage` only draws the bounding box. A real backend will need a crop image (PNG/WebP) per `Evidence.cropUri`. The frontend has no `<img>` slot for it today.
7. **No image copyright or licensing metadata.** Not in the type model. Worth adding for a public release.
8. **No pagination / virtualization on the library or evidence list.** Fine for the mock dataset (8 datasheets, 12 evidence), but a real workspace will have thousands. Use `react-virtual` or TanStack Virtual before going to production.
9. **No tests.** Every change is verified by eye and the demo data. The mock layer makes testing easy once added (see §16).
10. **The Copilot chat is currently 1:1 with `api.askCopilot`.** There is no streaming UI; the user waits 900ms and the whole message appears. The README §19 implies streaming; a real backend should stream and the UI should grow a typing indicator.
11. **No env-file convention.** `API_BASE` is hardcoded to `/api`. If the backend lives on a different origin, you'll need `VITE_API_BASE` plumbing and a single read in `config.ts`.
12. **No rate limiting or auth on the mock.** This is fine for demo; not fine for production.
13. **`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on.** These are good and the codebase already uses `!` non-null assertions in a few hot paths (`app.monitor.tsx`, `app.developer.tsx`, `app.collections.tsx`). The pattern is consistent; new code should follow it.
14. **TanStack Start is still labeled beta** (current `1.168.x`). Expect rough edges around server functions, particularly on edge runtimes.
15. **The favicon is the Lovable default** (`public/favicon.ico` only). Brand asset work is still pending.

---

## 14. Missing pieces (gaps to close before production)

### 14.1 Backend (entirely missing)
- Ingestion service: PDF upload → page render → layout analysis → region detection → figure classification → embedding → vector indexing → verification.
- Vector store (e.g. Qdrant / Weaviate / pgvector) for `Evidence` retrieval.
- OCR + text layer for pages without one.
- Retrieval / rerank service that implements `api.search`.
- Copilot service that returns grounded `{ answer, sources, confidence }` (NVIDIA Nemotron or equivalent).
- Symbol-generation service that returns a `SymbolSpec` (and eventually compiles to KiCad/Eagle/Altium).
- Auth (OAuth / SSO), session, workspace membership.
- Real-time job progress (queue + worker + SSE/WebSocket).
- Storage for PDFs, page rasters, and evidence crops (S3-compatible).
- Database for: users, workspaces, datasheets, evidence, collections, processing jobs, search history, notifications, component graph, related-component links.

### 14.2 Frontend gaps
- A real PDF.js integration (or pdfjs-dist via React PDF).
- Image rendering of `cropUri` (an `<img>` inside `DocPage` for the selected region).
- Pagination / virtualization on `Datasheet` and `Evidence` lists.
- Streaming Copilot responses.
- A toast / alert rule engine for `AppNotification` (today they're static fixtures).
- A real collection editor (add/remove evidence from a collection; today it's read-only).
- A real search history sync (today it's local state).
- A real workspace switcher that hits the API.
- A real auth flow (form validation, error states, redirect after login).
- An empty-state for "no notifications" / "no jobs" (today only `app.history.tsx` and `app.datasheets.tsx` have empties).
- Keyboard shortcut implementation beyond ⌘K (the help page lists `⌘S / ⌘U / ⌘,` but they aren't bound).
- Component-level test harness (Vitest + Testing Library).
- A minimal e2e harness (Playwright) for the upload → process → search → inspect path.
- Real telemetry (replace `__lovableEvents` hook with a real sink).
- A favicon / OG image / brand kit (today: only `favicon.ico` + `robots.txt`).
- A short CONTRIBUTING / DEVELOPMENT guide (CLAUDE.md exists, but it covers Claude-Code-specific guidance; a human-facing one would be useful).

### 14.3 DevOps / infra
- Dockerfile / compose for the backend.
- A wrangler / Cloudflare config if the production target is edge.
- Env file template (`.env.example`) with `VITE_API_BASE` and any other runtime config.
- CI config (`.github/workflows/ci.yml`).
- Preview deploys.
- A pre-publish contract check that the `api` function signatures still match the backend's OpenAPI / RPC schema.

---

## 15. Recommended frontend architecture

The frontend is already laid out well. Concrete recommendations:

1. **Keep the `api` object as the single integration point.** All 14 service methods in `src/lib/speclens/api.ts` should be implemented as a thin fetch wrapper over the real backend. The `mock-data.ts` module can stay around for development, Storybook, and tests.
2. **Add a request layer in `src/lib/speclens/transport.ts`** (new) that handles base URL, auth header injection, error normalization, and abort signals. The `api` methods should call into it.
3. **Add a `useApiQuery` helper** that wraps React Query with the existing `api` methods, so pages can do `const { data, isLoading } = useApiQuery(api.search, query, filters)` and get cancel-on-unmount, retry, and stale-while-revalidate for free.
4. **Promote `DocPage` to a feature folder** (`src/features/evidence/doc-page/`) with two implementations: `SyntheticDocPage` (the existing SVG) and `PdfDocPage` (a thin React-PDF wrapper). A `<DocPage variant="auto" />` chooses based on a feature flag or `DEMO_MODE`.
5. **Promote the bbox overlay to its own component** (`<BboxOverlay bbox={...} page={...} />`) so it can be reused on both the synthetic and the real PDF page.
6. **Add a `routes/api/...` directory** (TanStack Start supports API routes) for the SSR-side dev proxy. Useful for local development without a separate backend.
7. **Add a `routes/__guard.tsx`** that redirects unauthenticated users to `/login` once real auth lands.
8. **Unify the two processing-stage vocabularies** in a single `lib/speclens/stages.ts` module. Make the backend return stages from the canonical list, and have the upload page map from the canonical list to its user-facing labels.
9. **Convert the synthetic schemas into a Zod schema** in `lib/speclens/schema.ts`. Have `api` methods validate at the boundary so a bad backend response is caught at the network edge.
10. **Add a `routes/app.evidence.$evidenceId.tsx` deep link** so a Copilot source can land directly on a single evidence region (the search results page already wants this).
11. **Add a `components/speclens/empty-state.tsx`** if you end up adding more `EmptyState` calls — currently it's inside `primitives.tsx`, but a separate file would let you import it from server functions.
12. **Add `react-virtual` (or `@tanstack/react-virtual`)** to the datasheet library, the search results, and the evidence list before the workspace has >100 items.

---

## 16. Recommended implementation order

A backend author reading this audit should do work in roughly this order. Each step is independently shippable on the frontend without breaking the demo.

1. **Lock the contract.** Export the TypeScript types from `lib/speclens/types.ts` as JSON Schema (e.g. via `zod-to-json-schema`). The frontend and backend then share the schema. No code runs yet; the demo continues to use the mock.
2. **Stand up the transport.** Add `src/lib/speclens/transport.ts` and a single `DEMO_MODE=false` toggle that, when on, calls the transport instead of the mock. Keep the mock as a fallback so any unfinished endpoint still works in the UI.
3. **Auth + session.** Wire `__root.tsx` to a session loader. Add a guard. Implement `getSession` server-side. The login form stays as a stub until a real OAuth/SSO flow lands.
4. **Datasheet library backend.** Implement `listDatasheets`, `getDatasheet`, and a `POST /api/datasheets/upload` that returns a `ProcessingJob`. Frontend continues to use `mockJobs` for the monitor until step 5.
5. **Processing pipeline.** Real ingestion worker, real stages, real logs. Wire SSE or polling to `app.upload.tsx` and `app.monitor.tsx`. Replace the `setTimeout` simulation in the upload page.
6. **Search backend.** Real vector index, real reranker, real facet counts. The `api.search` swap is one file; the UI doesn't change.
7. **Evidence viewer.** Add real PDF.js rendering. Add `<img>` for crops. Add a deep link `/app/evidence/$id`. Add a `routes/app.evidence.$id.tsx` route.
8. **Component intelligence + graph.** Real `/api/components/:mpn`. Render the graph from server-provided edges (the mock currently derives edges from `mockEvidence.filter(e => e.mpn === ...)`).
9. **Copilot.** Wire the abstract provider. Stream responses. Keep the grounding contract (`sources[]`, `confidence`).
10. **Symbol Studio.** Wire `POST /api/symbols/generate`. Keep Validate and Export as backend calls. Defer actual KiCad/Eagle compilation to a separate workstream.
11. **Analytics, Collections, History, Notifications.** Wire each. None of them change the UI shape.
12. **Real-time + virtualization + tests.** After functional parity, add TanStack Virtual, Vitest, and Playwright in that order.
