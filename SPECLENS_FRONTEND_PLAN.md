# SPECLENS_FRONTEND_PLAN.md

A mapping from **what the repository already exposes** (data shapes, service methods, UI primitives, design tokens) to **the SpecLens product features** the frontend will eventually represent. The repo today is a frontend-only demo running against typed mocks — the mapping is therefore drawn against `src/lib/speclens/types.ts`, `src/lib/speclens/api.ts`, `src/lib/speclens/mock-data.ts`, and the existing routes/components.

Each row shows: **UI feature → existing repo capability that already serves it → what it represents → backend dependency that completes it**.

---

## A. Product shell & navigation

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Marketing landing | `routes/index.tsx` | Hero, pipeline viz, product preview (synthetic PDF + bbox), capabilities grid, CTA | none |
| Sign in | `routes/login.tsx` + `AuthLayout` | Email/password, SSO buttons, 400ms simulated submit | real auth (OAuth / SSO) |
| Sign up | `routes/register.tsx` | Name / email / password / workspace / role (`UserRole` enum) | real auth + workspace creation |
| Onboarding (3 steps) | `routes/onboarding.tsx` | Focus areas, first collection, invite team | real preferences + collections + members |
| Authenticated shell | `components/speclens/app-shell.tsx` | Sidebar (primary/secondary/tertiary), header, breadcrumb, ⌘K, notification bell, workspace switcher, mobile drawer | real session + workspaces |
| Command palette | `components/speclens/command-palette.tsx` | 8 hard-coded actions, "Recent documents" | real action registry; deep link to recent evidence |
| Notification center | `NotificationBell` in `app-shell.tsx` | Bell + dot + popover list, unread count | real `/api/notifications` + WS push |

## B. Command Center & monitoring

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| KPI cards | `KpiCard` (`primitives.tsx`) + `KpiCard` usage in `app.index.tsx` | Datasheets indexed, evidence regions, searches, verified results | real `/api/analytics` summary |
| Recent datasheets | `app.index.tsx` Recent list | Top 5 most-recent datasheets | `listDatasheets` sorted by `updatedAt` |
| Intelligence activity feed | `mockActivity` + `app.index.tsx` panel | Last index / detect / verify / query / error events | real `/api/activity` |
| Processing monitor | `routes/app.monitor.tsx` | Job list + stage grid + log panel + `ErrorState` for failed jobs | real `/api/jobs` + `/api/jobs/:id` + SSE for stage updates |
| Job stages | `ProcessingJob.stages[]` (`types.ts`) | 7-stage pipeline: ingest → render → layout → regions → embed → index → verify | real worker emitting per-stage events |
| Job logs | `ProcessingJob.logs[]` | `{ at, line, level }` records, terminal-style render in `<pre>` | real log stream from worker |

## C. Datasheet ingestion & library

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Drag-and-drop upload | `routes/app.upload.tsx` | Drop zone, file picker, animated 8-stage progress (per file) | real `POST /api/datasheets/upload` + presigned URL or multipart |
| Upload stage list | `STAGES` constant in `app.upload.tsx` | PDF validated → Document loaded → Pages rendered → Layout analyzed → Visual regions detected → Building retrieval index → Evidence verification → Ready | real worker emitting per-stage events; unify with `ProcessingJob.stages` |
| Datasheet library | `routes/app.datasheets.tsx` | Search, sort (updated / evidence / pages), favorites toggle, grid/list view | real `/api/datasheets` with query + sort |
| Datasheet card | `DocPage` thumbnail + `StatusPill` + MPN/manufacturer/title + pages/MB/evidence count | A document in the workspace | one `Datasheet` row |
| Status pill | `components/speclens/status-pill.tsx` | indexed / indexing / queued / failed | `Datasheet.status` (`IndexStatus`) |
| Favorites | `Datasheet.favorite` | Local boolean flag | real favorites per user |
| Collections | `routes/app.collections.tsx` | Card grid with datasheet / evidence / component counts | real `/api/collections` |

## D. Visual search

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Search input | `routes/app.search.tsx` | URL-stateful (`?q=...`), example chips, submits → navigate | none (UI-only) |
| Search examples | `searchExamples` in `mock-data.ts` | 6 starter queries (find pinout, application circuits, etc.) | none (UI affordance) |
| Evidence-type facets | Type list in `app.search.tsx` sidebar | Per-`EvidenceType` count badge, click-to-filter | `SearchResultSet.facets[]` from backend |
| Min-confidence slider | `minConf` state in `app.search.tsx` | 0–99% floor | `SearchFilters.minConfidence` from backend |
| Result count + latency | Header in `app.search.tsx` | "12 verified evidence regions · 218 ms · demo index" | `SearchResultSet.total` and `.latencyMs` |
| Result card | `DocPage` + `EvidenceTypeBadge` + `VerificationBadge` + `ConfidenceBar` + "Matched using" + 3 actions (Inspect, Open Page, Add to Collection) | A retrieved `Evidence` row | one `Evidence` from `SearchResultSet.results[]` |
| Bbox visualization | `DocPage` overlay with corner dots and animated pulse | The retrieved region on the page | `Evidence.bbox` (normalized 0..1) |
| Matched-by explainability | `Evidence.matchedBy[]` rendered as "Matched using: …" | Why the region matched | backend populates `matchedBy` |
| Ranking | `retrievalScore` descending | Order of the result list | backend's reranker |
| Empty state | `EmptyState` from `primitives.tsx` | "No evidence matched this query" with suggestions | none |

## E. Evidence Explorer

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Split view | `routes/app.evidence.tsx` | Left: PDF + page nav + zoom; right: inspector | none |
| Page navigation | `<` / `>` buttons + `n / total` indicator | Move between pages of a datasheet | per-datasheet page count |
| Zoom | `−` / `+` / Fit width / Fullscreen | 60%–200% zoom in 20% steps | real PDF.js |
| Selected evidence | Thumbnail strip below main viewer | All evidence in the document, click-to-select | `listEvidence` filtered by `documentId` |
| Bbox highlight | `DocPage` `highlight` prop | Animated pulse on the currently selected region | `Evidence.bbox` |
| Type + title + caption | Inspector right column | `EvidenceTypeBadge`, `Evidence.title`, `Evidence.caption` | `Evidence` |
| Confidence bar | `ConfidenceBar` | Color-coded 0.85/0.93 thresholds | `Evidence.confidence` |
| Verification badge | `VerificationBadge` | Verified / Unverified / Flagged | `Evidence.verification` |
| Metadata grid | Inspector dl | Document / MPN / Manufacturer / Page / Retrieval score / Model version | `Evidence` fields |
| Technical metadata | Inspector `<details>` | Bbox coords, crop URI, timestamp, retrieval method | `Evidence` fields |
| Raw metadata | Inspector toggle | Pretty-printed JSON | `Evidence` row |
| Evidence ID copy | "Copy Evidence ID" button | Clipboard of `Evidence.id` | none |
| Add to Collection | Inspector button | Navigate to collections | real `/api/collections/:id/evidence` (POST) |

## F. Component intelligence

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| MPN search | `routes/app.components.tsx` | Single-input search, no submit needed (live filter) | `getComponent(mpn)` |
| Header card | Name, manufacturer, family, channels | Component identity | `ComponentIntel` |
| Specifications | `Section "Specifications"` dl | All spec rows | `ComponentIntel.specs[]` |
| Known packages | Package list with monospace pills | Package variants the part ships in | `ComponentIntel.packages[]` |
| Verified evidence | Checklist of 5 evidence categories | Which evidence types have been verified for the part | `ComponentIntel.verified[]` |
| Evidence tab | Grid of evidence cards with `DocPage` thumbnails | All evidence for the MPN | `listEvidence` filtered by `mpn` |
| Evidence graph | `EvidenceGraph` SVG in `app.components.tsx` | MPN at center, evidence regions as connected nodes with dashed edges | graph data: currently derived from `mockEvidence`; real backend should serve edges |
| Related parts | `routes/app.components.tsx` "Related" tab | Other MPNs + a short note | `ComponentIntel.related[]` |
| History tab | Event log per MPN | Add-to-collection, re-process, etc. | `ComponentIntel.history[]` |

## G. SpecLens Copilot

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Chat thread | `routes/app.copilot.tsx` | User / assistant bubbles, sticky composer | real streaming `/api/copilot` |
| Grounded answer | Assistant card with "Grounded answer" eyebrow + confidence % | The answer with explicit grounding emphasis | `CopilotMessage.confidence` |
| Sources list | Clickable rows: `EV-xxxx` + label + page + confidence | Every claim is anchored to an evidence region | `CopilotMessage.sources[]` |
| Thinking indicator | "Retrieving evidence" with bouncing dots | The model's still working | real streaming events |
| Provider abstraction | `api.askCopilot` + README §19 | Model is swappable; NVIDIA Nemotron is the named future | real provider (Nemotron, Claude, etc.) |
| "No unconstrained chatbot" | All answers carry sources | Hard contract: the assistant cannot answer without evidence | enforced server-side |

## H. Symbol Studio

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| MPN input | `routes/app.symbols.tsx` | The part to generate a symbol for | input to `generateSymbol` |
| Pipeline chips | 5 stages: Verified Evidence → Symbol Specification → Validation → Compilation → Preview | User-visible progress through the workflow | `SymbolSpec.stage` |
| Generate / Validate / Export | Buttons, all currently stubbed to toasts | The 3 user actions | real `/api/symbols/generate`, `/api/symbols/validate`, `/api/symbols/export` |
| Symbol preview | Hand-drawn SVG | The spec rendered as a schematic | `SymbolSpec.pins[]` (sides + names) |
| Validation checklist | List of `validation[]` rows with check icons | "Pin names verified", "Pin numbers verified", "Electrical types verified", "Evidence linked" | `SymbolSpec.validation[]` |
| Pin list | `Pin` row with number, name, electrical, evidenceId | Every pin and its evidence provenance | `SymbolSpec.pins[]` |
| Pin → evidence provenance | `evidenceId` link per pin | The pin is grounded to an evidence region | `SymbolPin.evidenceId` (preserved through the API) |
| (future) KiCad / Eagle / Altium export | Not implemented; backend-owned per README §20 | Real schematic compilation | backend compile service |

## I. Analytics

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Date range filter | `ranges = ["24h","7d","30d","90d"]` in `app.analytics.tsx` | 4 fixed windows | `Analytics` over a time range |
| Metric cards | Re-render of the same 6 metrics | Precision@5, Recall@5, Evidence confidence, Retrieval latency, Verification latency, Queries/day | `Analytics.metrics[]` |
| Retrieval performance (line) | Recharts `LineChart` | Precision + recall per day | `Analytics.retrieval[]` |
| Evidence distribution (bar) | Recharts `BarChart` | Count per evidence type | `Analytics.evidenceDistribution[]` |
| Query types (pie) | Recharts `PieChart` | Share of query categories | `Analytics.queryTypes[]` |
| Processing throughput (area) | Recharts `AreaChart` | Pages indexed per hour | `Analytics.throughput[]` |
| Confidence distribution (bar) | Recharts `BarChart` | Bucketed evidence confidence | `Analytics.confidence[]` |

## J. Search history & notifications

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Search history list | `routes/app.history.tsx` | Per query: results count, best confidence, timestamp | real `/api/history` |
| Re-run query | "Re-run" link → `navigate({ to: "/app/search", search: { q } })` | Open the same query in Visual Search | none |
| Delete history | "Trash" button (local state today) | Remove from history | real `DELETE /api/history/:id` |
| Notifications list | `NotificationBell` + popover | Unread dot, list with tone (success/info/error) | real `/api/notifications` + WS push |

## K. Developer console & settings

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Endpoint picker | `routes/app.developer.tsx` | 6 endpoints (POST /api/search, GET /api/datasheets, etc.) with sample bodies | none (uses `api.*`) |
| Run | Calls the bound `api.*` method, measures latency, shows JSON | Execute the call against whatever the service object points to | live `api.*` |
| Copy response | Clipboard of the response | Share the JSON | none |
| Settings: profile | Name, email, role | `User` fields | real `PATCH /api/users/me` |
| Settings: workspace | Workspace name, plan, members | `Workspace` fields | real `/api/workspaces/:id` |
| Settings: appearance | "Reduce motion" toggle | Honors `prefers-reduced-motion` (already global) | none |
| Settings: notifications | 3 toggles for notification types | Routing rules | real `/api/preferences/notifications` |
| Settings: search | 3 toggles: prefer verified, include unverified, expand MPN aliases | Default filters for `SearchFilters` | real `/api/preferences/search` |
| Settings: AI | "Provider unbound (demo)" panel | Copilot provider config | real `/api/preferences/ai` |
| Settings: data | "Demo mode: enabled" | `DEMO_MODE` flag | real data export / delete |
| Settings: developer | Connection status (API / backend / model / vector DB) | All "warn" in demo | real health checks |

## L. Design system

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Dark-first theme | `styles.css` oklch tokens | `--background`, `--surface`, `--surface-raised`, `--primary`, `--success`, `--warning`, `--destructive`, `--border`, `--border-strong`, `--chart-1..5`, `--sidebar-*` | none |
| Typography | `styles.css` `--font-sans` (Geist) + `--font-mono` (Geist Mono) | Consistent engineering type system | none |
| Panel surface | `@utility panel` | Standard surface used by every card | none |
| Backdrop / glow | `@utility grid-bg`, `@utility hero-glow` | Subtle engineering aesthetic | none |
| Animations | `animate-rise`, `animate-pulse-ring`, `flow-dash`, `scan-line` | Motion grammar; `prefers-reduced-motion` respected globally | none |
| shadcn primitives | `src/components/ui/` (40 files) | Buttons, dialogs, sheets, popovers, tooltips, tables, etc. | none |
| cn() helper | `src/lib/utils.ts` | Class composition | none |

## M. Cross-cutting product features

| UI feature | Existing capability | What it represents | Backend dependency |
| --- | --- | --- | --- |
| Demo mode indicator | `DemoNotice` + "Demo workspace" badge in `app-shell.tsx` | Per README §36, signals to the user that all data is illustrative | removed when real backend lands |
| Keyboard shortcuts | `command-palette.tsx` binds ⌘K; Help page lists `⌘S / ⌘U / ⌘,` but only `⌘K` is bound | Power-user navigation | none |
| Accessibility | `aria-*` attributes, `role="meter"` on `ConfidenceBar`, `aria-live="polite"` on Copilot thinking, reduced-motion support, focus-visible outline | A11y across every screen | none |
| Empty states | `EmptyState` from `primitives.tsx`, used in `app.search.tsx`, `app.history.tsx`, `app.datasheets.tsx` | Polished zero-data screens | none |
| Error states | `ErrorState` from `primitives.tsx`, used in `app.monitor.tsx` (with "Technical details" disclosure) | Recoverable error pattern with optional stack trace | none |
| Workspace switching | `SidebarBody` workspace dropdown with `mockWorkspaces` | Multi-workspace future | real `/api/session` + membership |
| Mobile layout | `useIsMobile` + `Sheet` drawer below 768px | Collapsed sidebar, mobile drawer nav, mobile-friendly panels | none |

## N. Data flow at a glance

```
[User action]
    │
    ▼
[Route component]   ── file-based, auto-generated routeTree
    │   (uses primitives, DocPage, badges, etc.)
    ▼
[api.*()]           ── single integration point (src/lib/speclens/api.ts)
    │   (currently 60–900ms simulated latency; will be a real fetch)
    ▼
[Types]             ── single source of truth (src/lib/speclens/types.ts)
    │
    ▼
[Mock today]   →   [Real backend tomorrow]
                       │
                       ├── Auth
                       ├── Ingestion worker → vector index
                       ├── Retrieval / rerank
                       ├── Copilot (grounded, abstract provider)
                       ├── Symbol generation
                       └── Storage (PDFs, rasters, crops)
```

The frontend already routes every screen through the `api` object. Swapping the implementations is a single-file change. The mapping above is what the backend team needs to keep in mind as they implement each endpoint: the shape, the fields, the named concepts, and the UI affordances that consume them.
