# SPECLENS CURRENT STATE AUDIT

*Generated from thorough codebase inspection. All findings based on actual repository code.*

---

## 1. Executive Summary

The SpecLens repository is a **frontend-only TanStack Start application** implementing the full SpecLens product surface in demo mode. There is **no backend, no Python, no ML pipeline, no vector database, no database, no Docker, no env files, and no test suite** in the tree. Every number, document, page, region, evidence entry, processing job, retrieval result, and Copilot reply is a typed mock consumed through a service object designed to be 1:1 swappable for a real backend.

The audit's actionable output is the alignment between what the frontend already models and what a real backend will eventually need to provide.

**Key architectural decisions:**
- `DEMO_MODE = true` in `src/lib/speclens/config.ts` gates all mock vs. real behavior
- `src/services/index.ts` provides a single `api` object facade: `DEMO_MODE ? mockApi : realApi`
- `src/services/mock-api.ts` implements the full 14-method SpecLensApi contract with artificial latency (60-900ms `setTimeout` per call)
- `src/services/real-api.ts` provides thin `fetch` wrappers over `/api` base — **not connected** to any real backend
- All UI routes are file-based under `src/routes/` using TanStack Router 1.170.x
- TanStack Start 1.168 with React 19, Vite 8.2, Tailwind v4
- shadcn/ui primitives (40+ components) via `cn()` helper

**What exists end-to-end against the README spec:**
- Application shell (sidebar, header, command palette, notification center, mobile drawer)
- Landing page, sign-in, sign-up, 3-step onboarding
- Command Center dashboard with KPI cards and activity feed
- Datasheet library (grid/list, search, sort, favorites)
- Drag-and-drop upload with animated 8-stage processing timeline
- Visual search with type facets and confidence slider
- Search results with bbox-highlighted synthetic pages
- Evidence Explorer with split view, zoom, page nav, raw-metadata reveal
- Component intelligence with 5 tabs (Overview/Evidence/Graph/Related/History)
- Evidence graph (SVG, animated dashed connectors)
- SpecLens Copilot chat with grounded sources
- Symbol Studio with synthetic symbol preview, pin list, validation checklist
- Collections, Search history, Processing monitor, Analytics (recharts), Developer console, Help, Settings (8 tabs)

**What is entirely missing:**
- No backend of any kind
- No PDF text extraction/rendering — DocPage is hand-drawn SVG
- No real client-side PDF.js
- No WebSocket/SSE wiring for live job progress
- No image hosting or S3
- No image `<img>` rendering of crops
- No real authentication (OAuth/SSO)
- No vector store, no embedding model, no reranker, no OCR
- No real-time job progress

---

## 2. Current Architecture

### 2.1 Tech Stack (actual wiring)
- **Framework**: TanStack Start 1.168.x + TanStack Router 1.170.x (file-based routes, generated `routeTree.gen.ts`)
- **UI runtime**: React 19.2, React DOM 19.2
- **Build**: Vite 8.2 with `@lovable.dev/vite-tanstack-config` preset (tanstackStart, viteReact, tailwindcss, tsConfigPaths, Nitro build-only, VITE_* env injection, @ path alias, React/TanStack dedupe, error logger, sandbox port/host detection)
- **Styling**: Tailwind v4.2 via `@tailwindcss/vite`, design tokens as CSS variables in `src/styles.css` (oklch, dark-first). shadcn/ui primitives (`new-york` style, `slate` base) under `src/components/ui/`.
- **State / data**: TanStack React Query 5.101 (provider in `__root.tsx`)
- **Forms / validation**: react-hook-form 7.71 + zod 3.24 + `@hookform/resolvers`
- **Icons / charts / dialogs**: `lucide-react` 0.575, `recharts` 2.15, `cmdk` 1.1, `vaul` 1.1, `sonner` 2.0
- **Other libs**: `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `clsx`
- **Package manager**: Bun (lockfile + `bunfig.toml`, 24h minimumReleaseAge with `@lovable.dev/*` allowlist)
- **TypeScript**: 5.8, strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### 2.2 SSR / runtime plumbing
- `src/router.tsx` builds the router with a `QueryClient` in context and `scrollRestoration: true`
- `src/routes/__root.tsx` wraps every route in `QueryClientProvider` and renders `<Outlet />` inside `<html>`/`<body>`; defines global 404 and error components; calls `reportLovableError`
- `src/start.ts` configures TanStack Start with two middlewares: server error handler + CSRF protection for `serverFn` calls
- `src/server.ts` is the Nitro SSR entry. h3 silently converts in-handler throws into `{"unhandled":true,"message":"HTTPError"}` 500 body. `server.ts` detects that body, recovers the original error from `error-capture.ts`, and substitutes a real HTML error page
- `src/lib/error-capture.ts` monkey-patches `console.error` to retain the most recent `Error` for 5 seconds, registers `error`/`unhandledrejection` listeners
- `src/lib/lovable-error-reporting.ts` forwards React boundary errors to the Lovable editor's telemetry

### 2.3 Module map
```
src/
  routes/                  31 file-based routes + routeTree.gen.ts + README.md
    routeTree.gen.ts       AUTO-GENERATED — never edit
    README.md              File-routing conventions
  start.ts / server.ts / router.tsx
  styles.css               Tailwind v4 + design tokens (oklch)
  components/
    ui/                    40 shadcn primitives (button, dialog, sheet, popover, …)
    speclens/              App-specific components
  lib/
    utils.ts               cn() = twMerge(clsx(...))
    error-page.ts          renderErrorPage() — fatal SSR HTML
    error-capture.ts       recovers the original error after h3 swallows it
    lovable-error-reporting.ts
    speclens/
      config.ts            DEMO_MODE flag, API_BASE, APP_NAME/TAGLINE
      types.ts             Single source of truth for the domain model
      api.ts               Service object: 1 function per planned backend endpoint
      mock-data.ts         Typed mock dataset (837 lines)
  hooks/                   use-mobile.tsx
public/
  favicon.ico
  robots.txt               Allows all crawlers
```

---

## 3. Frontend Architecture

### 3.1 Data flow: PAGE → COMPONENT → SERVICE → API → DATA SOURCE

```
[User action on route]
    │
    ▼
[Route component]   file-based, TanStack Router auto-generated
    │   (uses primitives, DocPage, badges, etc.)
    ▼
[api.*()]           single integration point (src/lib/speclens/api.ts)
    │   (currently 60–900ms simulated latency; will be a real fetch)
    ▼
[Types]             single source of truth (src/lib/speclens/types.ts — 290+ lines, 25+ interfaces)
    │
    ▼
[today: mock data]  →  [tomorrow: real backend]

Pages that call api.* directly (UI-agnostic):
- app.search.tsx       → api.search(q, filters)
- app.copilot.tsx      → copilotService.ask(q)  (mock or Nemotron fallback)
- app.components.tsx   → api.getComponent(mpn)
- app.symbol-studio.tsx → api.generateSymbol(mpn)
- app.jobs.tsx         → indirectly via mockJobs

Pages that reach into mock-data.ts directly (browse-only, no retrieval):
- app.index.tsx        → mockCommandCenterMetrics, mockDatasheets, mockActivity
- app.datasheets.tsx   → mockDatasheets, mockCollections
- app.components.tsx   → mockComponents, mockEvidence
- command-palette.tsx  → mockDatasheets (recent documents)
- app-shell.tsx        → mockUser, mockWorkspaces, mockNotifications
```

### 3.2 Route structure (31 routes)
Key routes and their data sources:

| Route | File | Primary Data Source |
|------|------|-------------------|
| `/` | `app.index.tsx` | mock datasheets, metrics, activity |
| `/app` | `app.tsx` | AppShell wrapper |
| `/app/datasheets` | `app.datasheets.tsx` | mockDatasheets, mockCollections |
| `/app/upload` | `app.upload.tsx` | mockApi.uploadDatasheet (artificial latency) |
| `/app/search` | `app.search.tsx` | api.search(q, filters) — client-side mock filter |
| `/app/evidence` | `app.evidence.tsx` | mockEvidence (filtered by docId) |
| `/app/components` | `app.components.tsx` | mockComponents, mockEvidence |
| `/app/copilot` | `app.copilot.tsx` | copilotService.ask(q) |
| `/app/symbol-studio` | `app.symbol-studio.tsx` | api.generateSymbol(mpn) — mock return |
| `/app/analytics` | `app.analytics.tsx` | mockAnalytics |
| `/app/monitor` | `app.monitor.tsx` | mockJobs |
| `/app/collections` | `app.collections.tsx` | mockCollections |
| `/app/history` | `app.history.tsx` | mockHistory |
| `/app/settings` | `app.settings.tsx` | mockUser, mockWorkspaces, DEMO_MODE flag |
| `/app/help` | `app.help.tsx` | static FAQs |
| `/app/developer` | `app.developer.tsx` | api.* calls (mixed mock/real) |

### 3.3 Authentication
- `DEMO_MODE = true` in `src/lib/speclens/config.ts`
- Login/register forms not validated; any submit navigates to `/app` after 400ms delay
- No auth library installed. No session cookie/token logic.
- `mockUser` and `mockWorkspaces` defined; rendered only in workspace switcher in sidebar
- `AuthLayout` in `login.tsx` exports: "Demo mode — authentication is not connected; any input opens the workspace."
- **Missing**: real OAuth/SSO, session management, token persistence

### 3.4 Demo mode handling
- `src/lib/speclens/config.ts` — `export const DEMO_MODE = true`
- When true: All UI uses mock data via `mockApi`
- When false: UI switches to `realApi` (backend not connected)
- `DemoNotice` component renders "Demo data — values are illustrative until the SpecLens backend is connected." when `DEMO_MODE=true`, null otherwise
- Single-file change to flip between mock and real

### 3.5 Stage vocabulary divergence
- Upload page uses 8 stages: `PDF validated`, `Document loaded`, `Pages rendered`, `Layout analyzed`, `Visual regions detected`, `Building retrieval index`, `Evidence verification`, `Ready`
- `ProcessingJob.stages` mock data uses 7 stages: `PDF ingestion`, `Page rendering`, `Layout analysis`, `Region detection`, `Embedding`, `Vector indexing`, `Verification`
- **Convergence needed**: backend should commit to one vocabulary, or frontend should map between them

---

## 4. Backend Architecture

### 4.1 No backend exists
- **Zero** Python, Node service, Go, Rust, or other language sources in the tree
- **No** Dockerfile, docker-compose.yml, pyproject.toml, requirements.txt, Pipfile
- **No** .env, .env.example, wrangler.toml, or other runtime config
- **No** prisma/, drizzle/, migrations/, or schema files
- **No** qdrant/, weaviate/, chroma/, or vector DB config
- **No** scripts directory

### 4.2 Server-side code (pure Node-edge plumbing)
- `src/server.ts` — Nitro SSR entry, h3 error normalization, error recovery
- `src/start.ts` — TanStack Start middleware: error handler + CSRF protection
- Both are pure plumbing; they do not call any external service and do not persist data

### 4.3 API service facade
```typescript
// src/services/index.ts
export const api: SpecLensApi = DEMO_MODE ? mockApi : realApi;
```

### 4.4 Mock API (satisfies full contract)
- `src/services/mock-api.ts` — 14 methods with artificial latency (60-900ms `setTimeout`)
- Linear filter over `mockEvidence` by token presence in `{title, caption, mpn, manufacturer, evidenceTypeLabel}`
- Returns facet counts, confidence-based filtering, sorting by `retrievalScore`
- Methods: `listDatasheets`, `getDatasheet`, `uploadDatasheet`, `indexDatasheet`, `listJobs`, `getJob`, `search`, `getEvidence`, `listEvidence`, `getComponent`, `askCopilot`, `generateSymbol`, `getAnalytics`, `listCollections`

### 4.5 Real API (thin fetch, not connected)
- `src/services/real-api.ts` — same 14 method signatures using `fetch` over `/api` base
- Throws `ApiError` on non-2xx responses
- Uses `API_BASE` from config (`/api`)
- **Not exercised** while `DEMO_MODE` is true

### 4.6 API endpoint contract (27 endpoints, documented but not implemented)
See `SPECLENS_REPOSITORY_AUDIT.md §7` for the full list. Key endpoints:
- `POST /api/datasheets/upload` → `uploadDatasheet`
- `GET /api/datasheets` → `listDatasheets`
- `GET /api/datasheets/:id` → `getDatasheet`
- `POST /api/datasheets/:id/index` → `indexDatasheet`
- `GET /api/jobs` → `listJobs`
- `GET /api/jobs/:id` → `getJob`
- `POST /api/search` → `search`
- `GET /api/evidence/:id` → `getEvidence`
- `GET /api/components/:mpn` → `getComponent`
- `POST /api/copilot` → `askCopilot`
- `POST /api/symbols/generate` → `generateSymbol`
- `GET /api/analytics` → `getAnalytics`
- `GET /api/collections` → `listCollections`
- `GET /api/session` → `getSession`
- `GET /api/activity` → `listActivity`
- `GET /api/notifications` → `listNotifications`
- `GET /api/history` → `listHistory`

---

## 5. Data Architecture

### 5.1 Domain model (all in `src/types/speclens.ts`)
- **User** — id, name, email, role, initials
- **Workspace** — id, name, plan, members
- **Datasheet** — id, mpn, manufacturer, title, fileName, pages, sizeMb, status, evidenceCount, updatedAt, favorite, collections, accent
- **EvidenceType** — 11 types: pinout, package, block-diagram, timing, application-circuit, electrical-curve, mechanical, table, absolute-maximum, functional-diagram, other
- **BoundingBox** — normalized 0..1 (x, y, w, h) relative to page
- **Evidence** — id, documentId, mpn, manufacturer, title, type, page, totalPages, bbox, confidence, verification, caption, cropUri, matchedBy[], retrievalScore, modelVersion, timestamp
- **SearchResultSet** — query, latencyMs, total, results[], facets[]
- **SearchFilters** — types?, manufacturer?, documentId?, minConfidence?, page?
- **ComponentIntel** — mpn, manufacturer, family, description, packages, channels, specs, verified[], related[], history[]
- **Collection** — id, name, description, datasheets, evidence, components, updatedAt
- **ProcessingJob** — id, fileName, mpn, status, progress, pages, sizeMb, stages[], logs[], startedAt, duration
- **Analytics** — metrics[], retrieval[], evidenceDistribution[], queryTypes[], throughput[], confidence[]
- **CopilotMessage** — id, role, content, sources?, confidence?, pending?
- **SymbolSpec** — mpn, package, pins[], validation[], stage

### 5.2 Mock data (837 lines, `src/mock/data.ts`)
- `mockUser` — Vishal L, Engineer, vishal@speclens.dev
- `mockWorkspaces` — 3 demo workspaces
- `mockDatasheets` — 8 datasheets (LM358, TPS5430, STM32F405, DRV8301, TL072, INA219, LM324, ESP32)
- `mockEvidence` — 13 evidence entries across 3 datasheets
- `mockComponents` — 1 component intel (LM358)
- `mockCollections` — 4 collections
- `mockJobs` — 5 processing jobs
- `mockActivity` — 5 activity events
- `mockCommandCenterMetrics` — 4 KPI metrics
- `mockPipelineStages` — 4 pipeline stages
- `mockNotifications` — 3 notifications
- `mockHistory` — 5 search history entries
- `mockAnalytics` — full analytics payload
- `mockCopilotSeed` — 2-message copilot seed
- `mockSymbolSpec` — LM358 symbol spec with 8 pins

### 5.3 Mock data import patterns
Pages using mock data **directly** (browse-only, bypass `api`):
- `app.index.tsx` — mockCommandCenterMetrics, mockDatasheets, mockActivity
- `app.datasheets.tsx` — mockDatasheets, mockCollections
- `app.components.tsx` — mockComponents, mockEvidence
- `command-palette.tsx` — mockDatasheets (recent documents)
- `app-shell.tsx` — mockUser, mockWorkspaces, mockNotifications

Pages using `api` object (mock or real, UI-agnostic):
- `app.search.tsx` — `api.search(q, filters)`
- `app.copilot.tsx` — `copilotService.ask(q)`
- Principle: "UI calls `api.search(...)`, never reaches into `mock-data.ts` directly for retrieval"

### 5.4 Crop URIs
- `Evidence.cropUri` is `s3://speclens-demo/crops/${id}.png` in mock data
- **No `<img>` rendering slot** in DocPage — crop URIs shown as text only
- Real backend would need to serve actual PNG/WebP crops

### 5.5 Stage vocabulary
- Two parallel stage lists exist (see §3.5)
- Backend will need to commit to one vocabulary

---

## 6. API Architecture

### 6.1 Single integration point
`src/lib/speclens/api.ts` re-exports `api` from `src/services`. All UI imports should go through this object.

### 6.2 Mock API details
- `src/services/mock-api.ts` implements `SpecLensApi` interface
- Each method has `delay(ms)` artificial latency (60-900ms)
- `search()` does linear token scoring over `mockEvidence`
- `askCopilot()` filters mock evidence by question keywords, returns grounded answer from top 3 matches
- `generateSymbol()` returns `{...mockSymbolSpec, mpn: mpn || mockSymbolSpec.mpn}`
- `getComponent()` finds component by MPN in `mockComponents`

### 6.3 Real API details
- `src/services/real-api.ts` thin `fetch` wrappers over `/api` base
- Uses `API_BASE` from `src/lib/speclens/config`
- Throws `ApiError` (with `status` and `message`) on non-2xx
- **Not connected** to any real backend

### 6.4 API endpoint mapping (from `src/lib/speclens/api.ts` comments)
```
POST /api/datasheets/upload       → uploadDatasheet
GET  /api/datasheets              → listDatasheets
GET  /api/datasheets/:id          → getDatasheet
POST /api/datasheets/:id/index   → indexDatasheet
GET  /api/jobs                    → listJobs
GET  /api/jobs/:id                → getJob
POST /api/search                  → search
GET  /api/evidence                → listEvidence
GET  /api/evidence/:id            → getEvidence
GET  /api/components/:mpn         → getComponent
POST /api/copilot                 → askCopilot
POST /api/symbols/generate        → generateSymbol
GET  /api/analytics               → getAnalytics
GET  /api/collections             → listCollections
GET  /api/session                 → getSession
GET  /api/activity                → listActivity
GET  /api/notifications           → listNotifications
GET  /api/history                 → listHistory
```

### 6.5 DEMO_MODE toggle
Single line change in `src/lib/speclens/config.ts`:
```typescript
export const DEMO_MODE = true;  // false when backend connected
```
This one line switches the entire `api` object from mock to real.

---

## 7. Feature-by-Feature Reality Check

| Feature | Current Status | Current Data Source | Missing Pieces | Recommended Implementation |
|---------|---------------|--------------------|----------------|--------------------------|
| **Authentication** | MOCK | `DEMO_MODE`, `mockUser`, `mockWorkspaces` | OAuth/SSO, session management, token persistence, login/regi form validation | Real auth flow; guard `/app` routes; `getSession` server-side; keep DEMO_MODE for developer experience |
| **Dashboard (Command Center)** | MOCK | `mockCommandCenterMetrics`, `mockDatasheets`, `mockActivity` | Real KPI values from backend; live activity feed | Backend `/api/analytics` summary, `/api/activity` feed; keep mock for demo |
| **Datasheets** | MOCK | `mockDatasheets`, `mockCollections` | Real search/filter/sort from backend datasheet index | `listDatasheets`, `getDatasheet`; `POST /api/datasheets/upload` with real jobs |
| **Upload** | MOCK | `mockApi.uploadDatasheet` + artificial latency | Real PDF ingestion worker, presigned URL/multipart, SSE/polling for stage updates | `POST /api/datasheets/upload`; replace `setTimeout` simulation with real progress |
| **PDF processing** | MOCK | Synthetic SVG `DocPage` | PDF.js integration, text layer, real page rendering, crop image rendering | Real PDF renderer; promote `DocPage` to feature folder with synthetic + PDF implementations |
| **Evidence** | MOCK | `mockEvidence`, client-side filtering | Vector index, embeddings, reranker, OCR, provenance chain | Real vector store (pgvector); retrieval/rerank service; `api.search` plug-in |
| **Search** | MOCK | `api.search(q, filters)` — client-side mock filter | Vector search, semantic similarity, reranker, facet counts from backend | `POST /api/search` with real vector index; UI stays the same |
| **Visual Search** | MOCK | Same as Search | Same as Search | Same as Search |
| **Components** | MOCK | `mockComponents`, `mockEvidence` | Real `/api/components/:mpn` with ComponentIntel | `getComponent(mpn)` from backend; evidence graph from server-provided edges |
| **Copilot** | PARTIALLY | `NemotronCopilotService` falls back to `MockCopilotService` | Real Nemotron API integration, streaming responses, grounding contract | Wire abstract provider; Nemotron fallback; stream responses; enforce `sources[]` + `confidence` contract |
| **Nemotron** | MOCK/PLACEHOLDER | `NemotronCopilotService.ask()` delegates to `MockCopilotService` | Actual Nemotron API endpoint, API key management | **CRITICAL**: Never expose Nemotron API key to browser. Backend-only. Current: placeholder with fallback to mock. Fix: move to server-side only. |
| **Circuit Generation** | MISSING | No implementation | Real circuit generation service | Not yet — Symbol Studio handles symbol generation, circuit gen is separate |
| **Symbol Studio** | MOCK | `api.generateSymbol(mpn)` returns mock SymbolSpec | Real symbol generation service, validate/export endpoints | `POST /api/symbols/generate`; Keep Validate/Export as backend calls; defer KiCad/Eagle compilation |
| **Analytics** | MOCK | `mockAnalytics` | Real retrieval metrics from vector store | `api.getAnalytics()` from backend; UI stays the same |
| **Collections** | MOCK | `mockCollections` | Real collection persistence, add/remove evidence | `api.listCollections()`, collection CRUD endpoints |
| **History** | MOCK | `mockHistory` | Real search history persistence, re-run/delete | `api.listHistory()`, `DELETE /api/history/:id` |
| **Processing Monitor** | MOCK | `mockJobs` + artificial latency | Real job queue, SSE/polling for stage updates, real logs | `api.listJobs()`, `api.getJob()`; replace `setTimeout` simulation |
| **Developer Console** | MOCK | `app.developer.tsx` calls `api.*` | Real endpoint execution, response caching | UI already binds to `api.*`; backend provides real responses |
| **Help/FAQ** | MOCK | Static FAQ accordion | None (read-only) | Keep as static; no backend dependency |
| **Settings** | MOCK | `mockUser`, `mockWorkspaces`, `DEMO_MODE` flag | Real workspace settings, data export/delete, AI prefs | Backend endpoints; `DEMO_MODE` flag controls demo vs. real |
| **Onboarding** | MISSING (routes exist but minimal) | `routes/onboarding.tsx` | 3-step workspace setup, real preferences | Implement or remove — currently minimal |
| **Sign in / Sign up** | MOCK | Forms navigate to `/app` after 400ms delay | Real auth, OAuth/SSO, session management | Auth backend; form validation; session guard |

---

## 8. Existing Types and Contracts

**Canonical domain model:** `src/lib/speclens/types.ts` (290+ lines, 25+ interfaces)

Key types:
- `User`, `Workspace`, `IndexStatus`, `Datasheet`, `Document`, `Page`
- `EvidenceType` (11 values), `BoundingBox` (normalized 0..1), `VerificationState` (verified/unverified/flagged)
- `Evidence`, `SearchResultSet`, `SearchFilters`
- `ComponentIntel`, `Collection`
- `JobStage`, `ProcessingJob`
- `Analytics`, `CopilotSource`, `CopilotMessage`
- `SourceReference`, `EvidenceCitation`
- `Component`, `SymbolPin`, `SymbolSpec`
- `SearchHistoryEntry`, `ActivityEvent`, `AppNotification`

**API contract:** `src/lib/speclens/api.ts` (14 methods in `SpecLensApi` interface)

**Stage vocabularies:** `src/lib/speclens/stages.ts` — two parallel lists:
- `PROCESSING_STAGES` (7 keys): ingest, render, layout, regions, embed, index, verify
- `UPLOAD_STAGE_LABELS` (9 keys): validate, load, render, layout, regions, index, verify, ready + one more
- **Divergence**: these need convergence

**Type safety**: TypeScript 5.8 strict mode on; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled; codebase already uses `!` non-null assertions in hot paths

---

## 9. Existing Mock/Demo Dependencies

### 9.1 Direct mock data imports (browse-only, no retrieval)
These pages import from ` "@/lib/speclens/mock-data"` or ` "@/mock/data"` directly, bypassing the `api` object:

| File | Imports | Purpose |
|------|---------|---------|
| `app.index.tsx` | `mockCommandCenterMetrics`, `mockDatasheets`, `mockActivity` | Command Center dashboard |
| `app.datasheets.tsx` | `mockDatasheets`, `mockCollections` | Datasheet library |
| `app.components.tsx` | `mockComponents`, `mockEvidence` | Component intelligence page |
| `command-palette.tsx` | `mockDatasheets` | Recent documents in palette |
| `app-shell.tsx` | `mockUser`, `mockWorkspaces`, `mockNotifications` | Sidebar workspace switcher, notification bell |

### 9.2 API-dependent pages (mock or real, UI-agnostic)
These pages call `api.*` and would swap to real backend with `DEMO_MODE = false`:

| File | `api` methods used |
|------|-------------------|
| `app.search.tsx` | `api.search(q, filters)` |
| `app.copilot.tsx` | `copilotService.ask(q)` |
| `app.components.tsx` | `api.getComponent(mpn)` |
| `app.symbol-studio.tsx` | `api.generateSymbol(mpn)` |
| `app.jobs.tsx` | indirectly via `mockJobs` |
| `app.evidence.tsx` | `api.listEvidence(datasourceId)` (via `useApiQuery`) |

### 9.3 Mock data purpose
- `src/mock/data.ts` — 837 lines of typed fixtures; serves as development dataset, Storybook data, and test data
- `src/lib/speclens/mock-data.ts` — compatibility re-export (`export * from "@/mock/data"`)
- UI mock imports should gradually migrate to `api` calls, but mock data can remain for dev/tests

### 9.4 Artificial latency
- `src/services/mock-api.ts` — every method has `delay(ms)` (60-900ms `setTimeout`)
- Purpose: simulate network latency in demo mode
- Will be removed when real backend connects

### 9.5 Stage vocabulary divergence
- Upload page: 8 stages with different labels than `ProcessingJob.stages` mock data
- **Issue**: frontend has two parallel stage vocabularies; backend should commit to one

---

## 10. Existing Technical Debt

1. **Two parallel stage vocabularies** — upload page uses 8 labels, `ProcessingJob.stages` uses 7 different labels (overlap but don't match)
2. **No real PDF rendering** — every "PDF page" is a hand-drawn SVG in `DocPage`
3. **No image rendering of crops** — `Evidence.cropUri` is `s3://...` URL, no `<img>` slot
4. **No pagination / virtualization** — all lists render all items; fine for mock, needs virtualization for production
5. **No tests** — Vitest + Testing Library not configured; every change verified by eye against mock data
6. **Artificial latency in mock API** — 60-900ms `setTimeout` per call; documented, will be removed on real backend
7. **No env-file convention** — `API_BASE` hardcoded to `/api`; if backend on different origin, need `VITE_API_BASE`
8. **No rate limiting or auth on mock** — fine for demo, not fine for production
9. **`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on** — codebase already uses `!` non-null assertions; consistent pattern
10. **TanStack Start labeled beta** (1.168.x) — expect rough edges around server functions, particularly on edge runtimes
11. **No favicon / OG image / brand kit** — only `favicon.ico` (Lovable default) + `robots.txt`
12. **No CONTRIBUTING / DEVELOPMENT guide** — `CLAUDE.md` exists but covers Claude-Code-specific guidance
13. **Crop URI not rendered** — `DocPage` only draws bounding box; no actual bitmap rendering
14. **Divergent processing stage lists** between upload page and mock job stages
15. **ESLint warnings** — 13 pre-existing (6 `react-refresh/only-export-components`, 5 `react-hooks/exhaustive-deps`)

---

## 11. Security Issues

### 11.1 Nemotron API key exposure
- `src/services/nemotron-service.ts` is a **placeholder** that currently delegates to `MockCopilotService` via dynamic import
- The Nemotron API endpoint is commented out // TODO
- **CRITICAL**: No API key handling exists in the current codebase
- **Current situation**: The service has no real Nemotron integration — it's a stub that falls back to mock data
- **Future**: When Nemotron endpoint is available, the key must be loaded server-side (Node env vars), never exposed to browser
- **Status**: Placeholder only; UI works without real Nemotron deployment

### 11.2 No authentication security
- No session management, no token storage, no OAuth/SSO
- `DEMO_MODE = true` means all data is illustrative
- Login/register forms have no validation; any submit navigates to `/app`
- **Missing**: rate limiting, auth guards, token refresh, session expiry

### 11.3 No CSP, no secrets management
- No Content Security Policy configuration
- No `.env` files or secrets in the repository
- `API_BASE` hardcoded to `/api` in `config.ts`

### 11.4 Crop URI exposure
- `Evidence.cropUri` contains `s3://speclens-demo/crops/${id}.png` paths in mock data
- These are demo paths; real implementation would use signed URLs or proper auth
- Currently no security issue since they're synthetic, but real S3 URIs would need protection

---

## 12. Performance Concerns

1. **Artificial latency** — all mock API calls have 60-900ms `setTimeout`; will be removed on real backend
2. **No virtualization** — library lists, search results, evidence lists render all items at once; dataset small mock (8 datasheets, 13 evidence, 1 component) but needs `react-virtual`/`@tanstack/react-virtual` for production with real data
3. **No pagination** — datasheet library, search results, evidence lists, component lists; fine for mock, needs pagination for real workspace scalability
4. **Large Recharts bundle** — 592.67 kB gzipped for analytics; acceptable for dashboard but could code-split
5. **No image loading** — synthetic SVG pages mean no external image downloads (performance advantage), but real PDF.js + crop images will change this
6. **Dynamic import** — `src/services/mock-service.ts` dynamically imported by `nemotron-service.ts`; noted for future optimization
7. **Inline dynamic imports option ignored** — `codeSplitting` specified in Vite config, but dynamic import still occurs

---

## 13. Architecture Risks

1. **`routeTree.gen.ts` regenerated on every build** — any manual edit lost; treat as binary
2. **Two parallel stage vocabularies** — upload page vs. `ProcessingJob.stages`; backend must commit to one, or frontend must map
3. **Bounding box normalized but synthetic `DocPage` uses fixed 240×320 viewport** — real PDF renderer may use different aspect ratio; same region at different page sizes appears at different positions unless backend returns page dimensions or renderer enforces consistent viewBox
4. **No real PDF rendering anywhere** — all "PDF pages" are hand-drawn SVG. Real renderer needs accessibility, page caching, text-layer search, zoom-to-region design
5. **No image rendering of evidence crops** — DocPage only draws bounding box; backend will need crop images (PNG/WebP) per `Evidence.cropUri`; frontend has no `<img>` slot today
6. **No real PDF text extraction / OCR** — `DocPage` has no text layer; real implementation needs PDF.js
7. **No tests** — every change verified by eye against mock data; mock layer makes testing easy once added
8. **Copilot chat is 1:1 with `api.askCopilot`** — no streaming UI; user waits 900ms and whole message appears. Real backend should stream; UI should grow typing indicator
9. **No env-file convention** — `API_BASE` hardcoded to `/api`; if backend on different origin, need `VITE_API_BASE` plumbing
10. **The README and `AGENTS.md` commit to Lovable editor connection** — force-push, rebase, or amend on pushed commits breaks history sync on Lovable's side; adopt no-rebase-on-pushed-commits policy
11. **Nemotron API key if/when integrated** — must never expose to browser; must be server-side only; current placeholder has no key handling
12. **Dark-first oklch tokens generally ok but some text on gradients may have marginal contrast** — audit needed for production WCAG compliance
13. **No rate limiting or auth guards** on any API — fine for demo, not fine for production

---

## 14. Recommended Production Architecture

### 14.1 High-level recommendations
1. **Keep `api` object as single integration point** — all 14 service methods as thin fetch wrappers over real backend; `mock-data.ts` stays for dev/tests/Storybook
2. **Add request layer in `src/lib/speclens/transport.ts`** — handles base URL, auth header injection, error normalization, abort signals; `api` methods call into it
3. **Add `useApiQuery` helper** — wraps React Query with `api` methods, gives cancel-on-unmount, retry, stale-while-revalidate for free
4. **Promote `DocPage` to feature folder** — two implementations: `SyntheticDocPage` (existing SVG) and `PdfDocPage` (React-PDF wrapper); `<DocPage variant="auto" />` chooses based on `DEMO_MODE`
5. **Promote bbox overlay to own component** — `<BboxOverlay bbox={...} page={...} />` reusable on both synthetic and real PDF pages
6. **Unify processing-stage vocabulary** — single canonical list in `lib/speclens/stages.ts`; backend returns from canonical list; upload page maps to user-facing labels
7. **Convert synthetic schemas to Zod schema** in `lib/speclens/schema.ts` — validate at boundary; catch bad backend responses at network edge
8. **Add `routes/app.evidence.$evidenceId.tsx` deep link** — so Copilot source can land directly on single evidence region
9. **Add `react-virtual` or `@tanstack/react-virtual`** — datasheet library, search results, evidence list before workspace has >100 items
10. **Add `routes/__guard.tsx`** — redirects unauthenticated users to `/login` once real auth lands

### 14.2 Backend priority order (from audit §16)
1. Lock the contract — export types as JSON Schema (via zod-to-json-schema)
2. Stand up the transport — `src/lib/speclens/transport.ts` + `DEMO_MODE=false` toggle
3. Auth + session — `__root.tsx` session loader + guard
4. Datasheet library backend — `listDatasheets`, `getDatasheet`, `POST /api/datasheets/upload`
5. Processing pipeline — real ingestion worker, real stages, real logs, SSE/polling
6. Search backend — real vector index, reranker, facet counts; `api.search` swap is one file
7. Evidence viewer — real PDF.js rendering, `<img>` for crops, deep link `/app/evidence/$id`
8. Component intelligence + graph — real `/api/components/:mpn`, graph from server-provided edges
9. Copilot — wire abstract provider, stream responses, keep grounding contract (`sources[]`, `confidence`)
10. Symbol Studio — `POST /api/symbols/generate`; Validate/Export as backend calls; defer KiCad/Eagle
11. Analytics, Collections, History, Notifications — wire each; none change UI shape
12. Real-time + virtualization + tests — TanStack Virtual, Vitest, Playwright

---

## 15. Phased Implementation Plan (ordered by dependency, based on actual repository findings)

### Foundation
1. **Lock the contract** — Export TypeScript types from `lib/speclens/types.ts` as JSON Schema; shared schema between frontend and backend. No code runs yet; demo continues on mock.
2. **Stand up the transport** — Add `src/lib/speclens/transport.ts`; single `DEMO_MODE=false` toggle that calls transport instead of mock; keep mock as fallback for unfinished endpoints.
3. **Auth + session** — Wire `__root.tsx` to a session loader. Add a guard on `/app` routes. Implement `getSession` server-side. Login form stays as stub until real OAuth/SSO flows land.

### Data Ingestion
4. **Datasheet library backend** — Implement `listDatasheets`, `getDatasheet`, and `POST /api/datasheets/upload` that returns a `ProcessingJob`. Frontend continues to use `mockJobs` for the monitor until step 5.
5. **Processing pipeline** — Real ingestion worker, real stages, real logs. Wire SSE or polling to `app.upload.tsx` and `app.monitor.tsx`. Replace the `setTimeout` simulation in the upload page.

### Retrieval
6. **Search backend** — Real vector index, real reranker, real facet counts. The `api.search` swap is one file; the UI doesn't change.

### Grounded AI
7. **Copilot** — Wire the abstract provider. Stream responses. Keep the grounding contract (`sources[]`, `confidence`). **Nemotron integration**: backend-only API key; never expose to browser. Current stub falls back to mock; replace with real provider when endpoint available.

### Symbolic & Visual
8. **Evidence viewer** — Add real PDF.js rendering. Add `<img>` for crops. Add deep link `/app/evidence/$id`. Add `routes/app.evidence.$id.tsx` route.
9. **Component intelligence + graph** — Real `/api/components/:mpn`. Render the graph from server-provided edges (currently derived from `mockEvidence.filter(e => e.mpn === ...)`).
10. **Symbol Studio** — Wire `POST /api/symbols/generate`. Keep Validate and Export as backend calls. Defer actual KiCad/Eagle compilation to separate workstream.

### Analytics & Ops
11. **Analytics, Collections, History, Notifications** — Wire each. None of them change the UI shape.
12. **Real-time + virtualization + tests** — After functional parity, add TanStack Virtual, Vitest, and Playwright in that order.

---

## 16. What Already Good

✅ **Complete frontend shell** — sidebar, header, command palette (⌘K), notification bell, mobile drawer, all 31 routes working
✅ **Typed domain model** — `src/lib/speclens/types.ts` 290+ lines, 25+ interfaces as canonical source of truth
✅ **API facade pattern** — single `api` object in `src/services/index.ts` switching by `DEMO_MODE`; UI never needs to know mock vs. real
✅ **Full product surface modeled** — every SpecLens feature has a UI representation, even if backed by mocks
✅ **Demo mode indicator** — `DemoNotice` component + "Demo workspace" badge in app-shell; single-line `DEMO_MODE` toggle
✅ **shadcn/ui primitives** — 40+ well-designed primitives via `cn()` helper; consistent design tokens
✅ **Type safety** — TypeScript 5.8 strict; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; codebase already uses consistent `!` pattern
✅ **Evidence visualization vocabulary** — `EvidenceTypeBadge`, `VerificationBadge`, `ConfidenceBar`, `evidenceIcon` map, `BboxOverlay`, `DocPage` all working with synthetic SVG
✅ **Processing pipeline visualization** — 8-stage upload timeline with per-stage state; `StatusPill` for datasheet status
✅ **Search & retrieval wired** — `api.search(q, filters)` returns `SearchResultSet` with facets; type facets, confidence slider, manufacturer filter all UI-ready
✅ **Copilot grounded contract** — all answers carry `sources[]` and `confidence`; no unconstrained chatbot design
✅ **Symbol Studio architecture ready** — pin provenance (`evidenceId`), validation checklist, 5-step pipeline chips all modeled; real compilation deferred
✅ **Analytics infrastructure** — Recharts line/bar/pie/area charts; date-range filter; all 6 metric cards; UI fully spec'd
✅ **File-based routing** — TanStack Router 1.170.x; `routeTree.gen.ts` auto-generated; 31 routes under `/app/` layout
✅ **Design system consistency** — Tailwind v4 oklch tokens; `--primary`, `--surface`, `--success`, `--warning`, `--destructive`, `--border`, `--chart-1..5`
✅ **Accessibility fundamentals** — `prefers-reduced-motion` honored globally; `focus-visible` rings; most interactive elements have `aria-label`; `aria-live="polite"` on Copilot thinking

---

## 17. What Must Be Preserved

- **`src/lib/speclens/types.ts`** — the canonical domain model; any backend must conform to these types
- **`src/services/index.ts`** — the `api` object facade; the single integration point that swaps mock↔real with one line
- **`src/lib/speclens/config.ts`** — `DEMO_MODE` flag, `API_BASE`, `APP_NAME`/`APP_TAGLINE`; the single-file flip
- **`src/mock/data.ts`** — 837 lines of typed mock fixtures; keep for development, Storybook, and tests
- **`src/services/mock-api.ts`** — full 14-method contract implementation; useful for tests, Storybook, Developer Console
- **`src/services/real-api.ts`** — thin `fetch` wrappers; template for real backend implementation
- **`src/components/speclens/app-shell.tsx`** — entire information architecture: primary/secondary/tertiary nav, workspace switcher, mobile drawer, notification bell, ⌘K
- **`src/components/speclens/primitives.tsx`** — `PageHeader`, `Section`, `KpiCard`, `EmptyState`, `ErrorState`, `DemoNotice`; use on every new page
- **`src/components/speclens/evidence-ui.tsx`** — `evidenceIcon` map, `EvidenceTypeBadge`, `VerificationBadge`, `ConfidenceBar`, `StatDelta`
- **`src/components/speclens/doc-page.tsx`** — synthetic PDF page SVG renderer with bbox overlay; the swap point for real PDF renderer
- **`src/components/speclens/status-pill.tsx`** — `IndexStatus` pill color coding
- **`src/lib/speclens/stages.ts`** — canonical stage vocabulary (converge the two parallel lists)
- **All 31 TanStack Router routes** — file-based routing structure; never edit `routeTree.gen.ts` by hand
- **shadcn/ui primitives** in `src/components/ui/` — 40+ components; do not redesign
- **Tailwind v4 design tokens** in `src/styles.css` — oklch variables; do not rename without updating all consumers
- **`DemoNotice` component** — renders when `DEMO_MODE=true`; null otherwise; user-facing demo indicator
- **Command palette** (`command-palette.tsx`) — ⌘K trigger, 8 actions, recent documents navigation
- **Bounding box normalized 0..1 system** — `BoundingBox` type and all UI that consumes it; backend must preserve this coordinate system
- **Evidence provenance chain** — `documentId` → `mpn` → `page` → `bbox` → `cropUri` → `modelVersion` → `timestamp`; `cropUri` as `s3://` URL pattern
- **Verification tri-state** — `verified`/`unverified`/`flagged` as independent signals from `confidence` (0..1)
- **Component intelligence shape** — `ComponentIntel` with specs, verified, related, history; pin provenance through `evidenceId`
- **SymbolSpec shape** — `mpn`, `package`, `pins[]` with `evidenceId` provenance, `validation[]`, `stage`
- **SearchResultSet shape** — `query`, `latencyMs`, `total`, `results[]`, `facets[]`
- **All existing TypeScript types** — do not remove or rename without updating every consumer

---

## 18. What Must Be Replaced

- **Replace mock API calls with real backend calls** — `DEMO_MODE = false` in `config.ts`; `realApi` instead of `mockApi`
- **Replace synthetic PDF rendering** — `DocPage` SVG renderer with real PDF.js integration; add text layer, search capability
- **Replace crop URI text with `<img>` rendering** — add `<img src={evidence.cropUri} />` inside `DocPage` for selected region
- **Replace artificial latency** — remove `setTimeout` delays from mock API (or they'll be removed when real backend connects)
- **Replace mock datasheet data** — real datasheets from backend `listDatasheets` instead of `mockDatasheets`
- **Replace mock evidence data** — real evidence from backend `listEvidence`/`search` instead of `mockEvidence`
- **Replace mock component data** — real ComponentIntel from backend `getComponent(mpn)` instead of `mockComponents`
- **Replace mock collections** — real collections from backend `listCollections` + persistence instead of `mockCollections`
- **Replace mock analytics** — real retrieval metrics from vector store instead of `mockAnalytics`
- **Replace mock jobs** — real processing jobs from backend queue instead of `mockJobs`
- **Replace mock activity** — real activity events from backend worker instead of `mockActivity`
- **Replace mock history** — real search history from backend instead of `mockHistory`
- **Replace mock notifications** — real notifications from backend + WS push instead of `mockNotifications`
- **Replace mock user/workspaces** — real auth session instead of `mockUser`/`mockWorkspaces`
- **Converge stage vocabularies** — single canonical list; map between upload page labels and processing job stages
- **Add real authentication** — OAuth/SSO, session management, token persistence, login/regi form validation
- **Add Nemotron API integration** — backend-only; never expose key to browser; current placeholder falls back to mock
- **Add real-time job progress** — SSE or polling to replace `setTimeout` simulation in upload monitor
- **Add rate limiting and auth guards** on all API endpoints
- **Add pagination / virtualization** on all lists for production data volumes
- **Add skip links and landmark regions** for screen reader navigation
- **Add comprehensive a11y audit** — ESLint `eslint-plugin-jsx-a11y` + axe-core
- **Add favicon / OG image / brand kit** — replace Lovable default
- **Add CONTRIBUTING / DEVELOPMENT guide** — human-facing
- **Add unit tests** — Vitest + Testing Library for components, services, hooks
- **Add e2e tests** — Playwright for critical user flows (upload → process → search → inspect)

---

## 19. What Is Completely Missing

- **No backend of any kind** — zero server code, no Python/Node/Rust service, no ML pipeline, no vector database, no PostgreSQL, no pgvector
- **No PDF processing pipeline** — no ingestion worker, no layout analysis, no region detection, no figure classification, no embedding generation, no vector indexing, no verification
- **No real PDF.js integration** — every PDF page is a hand-drawn SVG; no text extraction, no OCR, no real rasterization
- **No image hosting** — no S3, no signed URLs, no crop image serving; `Evidence.cropUri` is synthetic `s3://speclens-demo/...`
- **No real authentication** — no OAuth, no SSO, no session cookies, no token management, no form validation
- **No vector store / retrieval** — no embeddings, no semantic search, no reranker, no facet counts beyond client-side token matching
- **No OCR** — no text layer extraction from PDF pages; `confidence` and `retrievalScore` have no ML-backed basis
- **No real-time job progress** — no queue system, no worker, no SSE/WebSocket for live stage updates; upload progress simulated with `setTimeout`
- **No Copilot streaming** — `api.askCopilot` returns whole message after 900ms artificial delay; no streaming UI
- **No symbol compilation** — no KiCad/Eagle/Altium backend; Symbol Studio UI shell only; Generate returns mock SymbolSpec; Validate/Export are toast-only
- **No database** — no users table, no workspaces table, no datasheets table, no evidence table, no collections table, no jobs table, no search history table, no notifications table
- **No API rate limiting** — no guards on any endpoint
- **No CI/CD** — no `.github/workflows/`, no Dockerfile, no wrangler config, no preview deploys
- **No test suite** — no Vitest, no Testing Library, no Playwright; every change verified by eye against mock data
- **No env-file convention** — `API_BASE` hardcoded to `/api`; no `.env.example`, no `VITE_API_BASE` plumbing
- **No CONTRIBUTING guide** — human-facing development instructions missing
- **No brand kit** — only Lovable default `favicon.ico`; no OG images, no custom logos beyond `SpecLensMark`/`SpecLensLogo`
- **No CONTRIBUTING or DEVELOPMENT guide** for human team members
- **No DEVTOOLS** beyond what's already in the TanStack ecosystem

---

## 20. The Single Best Next Implementation Step

**Lock the TypeScript contract and stand up the transport layer.**

**Step 1:** Export the type schema from `src/lib/speclens/types.ts` as JSON (e.g., via `zod-to-json-schema` or manual schema definition). This becomes the frontend-backend contract that both teams agree on. The demo continues to run on mock data unchanged.

**Step 2:** Add `src/lib/speclens/transport.ts` — a thin request layer that:
- Resolves `API_BASE` from config (`/api` by default)
- Injects auth headers if a session token is present (initially empty/none in demo mode)
- Normalizes `ApiError` responses
- Forwards abort signals for cancel-on-unmount
- Is called by the `api` methods instead of direct `fetch`

**Step 3:** Add a `DEMO_MODE = false` toggle that, when flipped, makes the `api` object use `realApi` (which calls `transport`) instead of `mockApi`. Keep the mock as fallback so any unfinished endpoint still works in the UI.

**Why this is the best next step:**
- It's the foundation for everything else — without a transport layer, no real backend integration is possible
- It's a single-file change that enables all subsequent backend work
- It can be done entirely on the frontend; no backend team coordination needed yet
- It preserves the existing demo mode experience (`DEMO_MODE = true` keeps everything working as-is)
- It establishes the exact API contract shape that the backend team needs to implement
- It takes ~1 hour to implement and verify

This step aligns with the audit's recommended order: "Lock the contract → Stand up the transport → Auth + session → Datasheet library backend → Search backend → ..."

Once this is done, the backend team can implement endpoints knowing the exact shape the frontend expects, and the frontend can swap to real data by flipping one flag.