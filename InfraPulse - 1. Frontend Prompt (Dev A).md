# InfraPulse - 1. Frontend Prompt (Dev A)

**Owner:** Frontend dev | **Folder:** /frontend | **Talks to backend only through the frozen API contract in section 5**

Paste everything between PROMPT START and PROMPT END into your AI coding tool (Antigravity). Build only inside /frontend. Never edit /backend or /contract.

---

## PROMPT START

### 1. Role and goal

You are a senior frontend engineer. Build the **InfraPulse** web app: a map-based cascade-failure simulator for city infrastructure. The user picks a failing node (for example a substation). The app shows, on a map and a time slider, what else fails, when it fails, and which department must act first.

### 2. Product in three sentences

Water, power, mobile network, traffic signals and hospitals depend on each other, but each team sees only its own service. InfraPulse models those dependencies as a graph with time buffers (battery backup, generator fuel, water tank). The user drags a timeline and watches the cascade unfold, while an Action Board tells each department what to fix and by when.

### 3. Tech stack (fixed, do not substitute)

- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS, dark theme only, lucide-react icons
- react-leaflet + leaflet. Basemap: CARTO dark tiles `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` with proper attribution
- Zustand for state, zod for runtime validation of API responses
- Vitest for unit tests of pure logic
- Single page, no router, no UI kit

### 4. Folder structure

```
frontend/
  src/
    api/        types.ts  schemas.ts (zod)  client.ts
    mocks/      graph.json  simulate_sub.json  scenarios.json
    state/      store.ts
    logic/      status.ts  status.test.ts  format.ts
    components/ MapView  NodeMarker  EdgeLayer  TimelineBar  ActionBoard  ActionCard  SummaryStrip  ScenarioPicker  TriggerChips  Legend  Toast
    App.tsx  main.tsx  index.css
  .env.example   README.md
```

### 5. API contract v1 (FROZEN - identical in the backend prompt)

```ts
// Base URL http://localhost:8000, prefix /api, JSON, snake_case.
// All times are integer MINUTES since the trigger moment (T+0). lat/lng are WGS84 numbers.
type NodeType = 'substation' | 'water_pump' | 'cell_tower' | 'signal_cluster' | 'hospital';
type Dept = 'electricity' | 'water' | 'telecom' | 'traffic' | 'health';
// fixed mapping: substation=electricity, water_pump=water, cell_tower=telecom, signal_cluster=traffic, hospital=health
type Relation = 'powers' | 'supplies_water' | 'telecom_link' | 'road_access';
type Severity = 'critical' | 'high' | 'medium';

interface GraphNode { id: string; name: string; type: NodeType; dept: Dept; lat: number; lng: number; criticality: number /* 1..5 */ }
interface GraphEdge { id: string; source: string; target: string; relation: Relation; buffer_minutes: number; group: string }
// target depends on source. After source fails, target survives buffer_minutes more.
// Edges into the same target with the same group are REDUNDANT feeds (dependency lost only when ALL are exhausted).
// Different groups into one target are in SERIES (losing any one group fails the target).

interface Scenario { id: string; name: string; description: string; trigger_node_ids: string[]; horizon_minutes: number }
interface SimulateRequest { trigger_node_ids: string[] /* 1..5 */; horizon_minutes?: number /* 30..1440, default 360 */ }
interface AffectedNode { node_id: string; lost_input_at: number; fails_at: number | null; caused_by: { source_id: string; relation: Relation } | null; depth: number }
interface Summary { nodes_down: number; nodes_at_risk: number; down_by_type: Partial<Record<NodeType, number>>; first_hospital_down_at: number | null; hospitals_down: string[]; hospitals_at_risk: string[] }
interface Action { id: string; dept: Dept; node_id: string; severity: Severity; priority: number /* 0..1 */; act_by_minute: number; title: string; detail: string }
interface SimulationResult { scenario: { trigger_node_ids: string[]; horizon_minutes: number }; nodes: AffectedNode[]; summary: Summary; actions: Action[]; briefing: string }

// GET  /api/health     -> { status: 'ok', nodes: number, edges: number }
// GET  /api/graph      -> { nodes: GraphNode[], edges: GraphEdge[] }
// GET  /api/scenarios  -> Scenario[]
// POST /api/simulate   -> SimulationResult   (404 { detail } unknown node id, 422 bad body)
```

Semantics you must respect:

- `nodes` in SimulationResult lists only affected nodes. Trigger nodes have lost\_input\_at=0, fails\_at=0, caused\_by=null, depth=0.
- `fails_at = null` means the node lost an input but survives the whole horizon (running on backup or a redundant feed).
- Nodes not listed are unaffected. `actions` arrive already sorted by priority (desc), max 20.

### 6. Status derivation (pure function, unit-tested)

For a node n at slider time T (minutes):

- not in `nodes` -> `ok`
- T < lost\_input\_at -> `ok`
- fails\_at != null and T >= fails\_at -> `down`
- otherwise -> `at_risk` (also compute `minutes_left = fails_at - T` when fails\_at is not null)

Put this in `logic/status.ts` as `getStatus(affected, T)` and cover it with Vitest: unaffected node, before loss, at risk with countdown, exactly at fails\_at, trigger at T=0, fails\_at null.

An edge is **active** at time T when its source is `down` and its target is `at_risk` or `down`. Active edges are drawn as red animated dashed lines.

### 7. Data layer and mock mode

- `.env`: `VITE_API_BASE=http://localhost:8000` and `VITE_USE_MOCK=true`.
- `client.ts` exposes `getGraph()`, `getScenarios()`, `simulate(req)`. When VITE\_USE\_MOCK is true it returns the JSON files in /src/mocks (with a fake 300 ms delay). Otherwise it calls the backend with fetch.
- Validate every response with the zod schemas. In dev, on mismatch call console.error with the path of the bad field and show a toast; never crash.
- Hand-write mocks that obey the contract exactly: graph.json with at least 14 nodes (2 substations, 2 water pumps, 3 cell towers, 4 signal clusters, 3 hospitals), real-looking lat/lng around Marathahalli, Bengaluru (lat 12.92-12.98, lng 77.67-77.75), at least one redundant group, and simulate\_sub.json consistent with that graph (at least 10 affected nodes with varied fails\_at such as 0, 10, 25, 45, 240; at least 6 actions across 4 departments; a summary; a 3-4 sentence briefing). Also scenarios.json with 3 scenarios.
- Provide a small header badge showing `MOCK` or `LIVE` data mode.

### 8. UI specification

**Layout (laptop first, 1366x768 projector friendly):** full-screen map. Top bar: logo, scenario dropdown, Run button, MOCK/LIVE badge. Left floating panel: trigger chips + legend. Right panel (360 px): Summary strip on top, Action Board below. Bottom: timeline bar.

**Visual language:** background slate-950, panels slate-900 with subtle border and blur. Status colours: ok #22c55e, at\_risk #f59e0b, down #ef4444. Department colours: electricity #facc15, water #38bdf8, telecom #a78bfa, traffic #fb923c, health #f472b6. Never rely on colour alone: also change icon style and show a text label.

**Map:**

- Fit bounds to the graph on load.
- One marker per node (L.divIcon with a lucide icon per type). Marker size scales with criticality. Colour follows status at the current T. Trigger nodes get a pulsing red ring.
- Edges are thin grey polylines by default. Active edges (section 6) turn red with an animated dash.
- Clicking a node opens a popup: name, type, department, status at T, `Fails in X min` countdown or `Down since T+X`, and `caused_by` shown as `Caused by <source name> (<relation>)`. The popup has a **Fail this node** button that toggles it as a trigger.

**Triggers and scenarios:**

- Scenario dropdown loads presets from /api/scenarios and auto-runs the simulation.
- Trigger chips show chosen nodes (max 5) with an x to remove. Run button calls simulate with the chips. Disable Run while loading.

**Timeline bar:**

- Slider from 0 to horizon\_minutes, step 1, label like `T+2h 15m`.
- Play/Pause plus speed 1x / 4x / 16x. Default speed plays 6 hours in about 25 seconds. Stop at the end.
- Small tick marks on the track at each distinct fails\_at value, coloured by node department.
- Dragging the slider updates the map instantly, with no network call.

**Summary strip:** `Down N | At risk N | First hospital impact T+X` (or `No hospital impact in window`). Values follow the full result, not the slider.

**Action Board:**

- Cards sorted by priority. Each card shows department chip, severity badge, title, detail, and a live countdown: `Act within 25 min` computed as act\_by\_minute - T. At 0 or below show a red `ACT NOW`.
- Tabs to filter by department (All + 5).
- Clicking a card flies the map to the node and opens its popup.
- Below the cards, a collapsible **Briefing** block with the `briefing` text and a Copy button.

**States:** empty state (`Pick a scenario or click a node to start`), loading skeleton, error toast with a `Use demo data` button that flips to mock mode.

**Footer note (small):** `Dependencies and backup durations are assumed for demonstration.`

### 9. Build order (commit after each milestone)

1. **M1 Scaffold:** Vite + TS + Tailwind, types.ts, zod schemas, mocks, client.ts with mock flag, status.ts + tests.
2. **M2 Map:** render graph nodes and edges from getGraph, all `ok`, popups working.
3. **M3 Simulation:** simulate call, store, slider, status colouring, active-edge animation, trigger pulse.
4. **M4 Board:** Summary strip, Action Board with countdowns and filters, Scenario picker, trigger chips, Fail-this-node button.
5. **M5 Polish:** play/pause and speed, tick marks, briefing block, error/empty/loading states, README with run steps.
6. **M6 Integration (with backend dev):** set VITE\_USE\_MOCK=false and fix any contract mismatch the zod errors reveal.

### 10. Acceptance criteria

- `npm run dev` works with mock mode on a clean clone, and `npm run build` and `npm test` pass.
- Selecting a scenario colours nodes correctly while dragging the slider, with no flicker and no network calls.
- A node never shows `down` before its fails\_at, and at\_risk nodes show a correct countdown.
- Action cards count down as the slider moves and highlight when due.
- Switching to live mode needs only the env change.
- No TypeScript `any`, no unhandled promise rejections, no console errors in normal use.

### 11. Rules

- Do NOT recompute the cascade in the frontend. All cascade logic lives in the backend; the frontend only renders the result.
- Do NOT change the contract. If something seems missing, write it down in /frontend/CONTRACT\_REQUESTS.md and carry on.
- Keep components small and typed. Avoid new dependencies beyond the list in section 3.
- Do not store anything in localStorage.

### 12. Stretch (only after M5 is solid)

- Mitigation what-if toggle on action cards (needs backend v1.1).
- Print or export the briefing as a PDF.
- Keyboard shortcuts: space = play/pause, left/right = step 5 minutes.

## PROMPT END
