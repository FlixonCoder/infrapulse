# InfraPulse - 2. Backend Prompt (Dev B)

**Owner:** Backend dev | **Folder:** /backend | **Talks to frontend only through the frozen API contract in section 5**

Paste everything between PROMPT START and PROMPT END into your AI coding tool (Antigravity). Build only inside /backend. Never edit /frontend or /contract.

---

## PROMPT START

### 1. Role and goal

You are a senior backend engineer. Build the **InfraPulse** API: a deterministic cascade-failure simulator over a city infrastructure dependency graph. Given one or more failed nodes, it computes what else fails, when, who is responsible, and what each department should do first.

### 2. Product in three sentences

Water pumps, power substations, cell towers, traffic signals and hospitals depend on each other, but each team sees only its own service. Dependencies carry time buffers (tower battery, hospital generator, water tank), so failures cascade over minutes and hours, not instantly. The API turns a trigger into a cascade timeline plus a prioritised action list per department.

### 3. Tech stack (fixed)

- Python 3.11, FastAPI, Pydantic v2, Uvicorn
- No database. The graph lives in `data/city.json`, loaded and validated into memory at startup
- pytest + httpx for tests
- No ML and no GPU. Pure graph logic. The whole simulation must run in under 100 ms

### 4. Folder structure

```
backend/
  app/
    main.py          FastAPI app, CORS, routers, startup validation
    models.py        Pydantic models mirroring the contract
    store.py         load + validate city.json, build indexes
    engine.py        simulate(trigger_ids, horizon) -> raw cascade
    actions.py       build prioritised Action list
    briefing.py      template based plain-language briefing
  data/
    city.json        nodes + edges (synthetic, see section 7)
    scenarios.json   3 presets
  scripts/
    export_fixtures.py   dumps real API responses into ../contract/fixtures/
  tests/
    test_engine.py  test_actions.py  test_api.py  test_seed.py
  requirements.txt   README.md
```

### 5. API contract v1 (FROZEN - identical in the frontend prompt)

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

Semantics you must implement:

- `nodes` in SimulationResult lists only nodes with lost\_input\_at <= horizon. Trigger nodes: lost\_input\_at=0, fails\_at=0, caused\_by=null, depth=0.
- `fails_at` is null when the node loses an input but survives the whole horizon (or would fail after the horizon).
- `actions` sorted by priority desc, max 20. Output must be deterministic (same input, same output, stable tie-breaks by node id).
- Enable CORS for http://localhost:5173 and http://127.0.0.1:5173.
- Use Pydantic models with `extra='forbid'` on responses so contract drift is caught in tests.

### 6. Cascade algorithm (implement exactly, in engine.py)

Definitions: an edge (source -> target) with buffer b means that when the source fails at time t, that dependency of the target is exhausted at time `d = t + b`. A target has dependency groups; edges into the same target sharing a `group` string are redundant alternatives. The target's group is exhausted only when ALL its sources have failed, at time `max(d)` over the group. The target fails at the **minimum** over its groups of the group exhaustion time.

Use a Dijkstra-style event queue:

```
incoming/outgoing indexes built once at startup
group_state[(node, group)] = { remaining: number of edges in group, max_d: 0, argmax_edge: None }
heap = [(0, trigger_id)] for each trigger; best[trigger]=0; depth[trigger]=0; caused_by[trigger]=None
while heap:
  t, n = heappop(heap)
  if n in fails_at (finalized): continue
  fails_at[n] = t
  for e in outgoing[n]:
    m = e.target
    if m in fails_at: continue
    if m not in lost_input_at: lost_input_at[m] = t; first_lost_edge[m] = e   # heap order => first is earliest
    st = group_state[(m, e.group)]
    st.remaining -= 1
    d = t + e.buffer_minutes
    if d >= st.max_d: st.max_d = d; st.argmax_edge = e
    if st.remaining == 0 and (m not in best or st.max_d < best[m]):
       best[m] = st.max_d; push (st.max_d, m)
       caused_by[m] = st.argmax_edge; depth[m] = depth[st.argmax_edge.source] + 1
```

Output assembly:

- Triggers: lost\_input\_at = 0, fails\_at = 0.
- For every node in lost\_input\_at with lost\_input\_at <= horizon: emit AffectedNode. fails\_at = its finalized time if <= horizon else null. caused\_by comes from the argmax edge that set the failure time, or from first\_lost\_edge if the node never failed. depth likewise (source depth + 1).
- Reset group\_state for every request (do not mutate shared indexes). Handle cycles safely because finalized nodes are never revisited.

### 7. Seed data (data/city.json) - synthetic but plausible

Area: east Bengaluru, bounding box lat 12.92 to 12.98, lng 77.67 to 77.75 (around Marathahalli / Bellandur / Whitefield). Use real hospital names where you are confident, otherwise invented names. Mark the file with a `_note` field: dependencies and buffers are assumed for demonstration.

**Nodes (33 total):** 1 transmission substation (220kV, criticality 5), 3 local substations (66kV, criticality 4), 6 water pumps (3), 8 cell towers (3), 10 signal clusters (2), 5 hospitals (5). Ids are readable slugs such as `sub_220_whitefield`, `sub_66_marathahalli`, `pump_bellandur_1`, `tower_07`, `sig_outer_ring_3`, `hosp_01`.

**Edge rules (typical buffer\_minutes in brackets):**

| relation | from -> to | buffer | group |
| --- | --- | --- | --- |
| powers | 220kV substation -> each 66kV substation | 0 | power |
| powers | 66kV substation -> cell\_tower | 120-360 (battery) | power |
| powers | 66kV substation -> signal\_cluster | 0-20 (mostly no backup) | power |
| powers | 66kV substation -> water\_pump | 0-45 | power |
| powers | 66kV substation -> hospital | 600-720 (generator fuel); give each hospital 1 or 2 feeds | power (redundant if 2) |
| supplies\_water | water\_pump -> hospital | 480-1440 (storage tank); 1 or 2 pumps | water |
| telecom\_link | cell\_tower -> hospital | 30-60; 2 towers per hospital | telecom |
| road\_access | signal\_cluster -> hospital | 10-20; 2 clusters per hospital | road |

Every non-substation node must have at least one incoming edge. Give some towers and signals two power feeds from different substations to demonstrate redundancy. Edge ids: `e001`, `e002`, ...

**Design check for the demo scenario S1 (trip of one 66kV substation):** at least 12 affected nodes, at least one hospital reaching `down` inside 360 minutes (via road or telecom groups), at least 4 departments with actions due within 30 minutes, and at least 2 nodes that stay at\_risk the whole horizon.

**data/scenarios.json:** S1 `Local substation trip` (one 66kV, horizon 360), S2 `Transmission station failure` (the 220kV, horizon 480), S3 `Storm - two substations` (two 66kV, horizon 360). Use readable descriptions.

### 8. Action rules (actions.py)

Create one candidate action per node with fails\_at not null, plus one for each trigger. Fields:

- `act_by_minute = max(0, fails_at - lead)` with lead by type: substation 0, signal\_cluster 0, water\_pump 45, cell\_tower 60, hospital 120.
- `priority = (criticality / 5) * (1 / (1 + act_by_minute / 60))`, rounded to 3 decimals.
- `severity`: critical if hospital or priority >= 0.6; high if priority >= 0.35; otherwise medium.
- Title and detail templates use the node name, fails\_at, and `caused_by.relation`:
  - substation (trigger): `Restore or reroute load for <name>` / `Fault at T+0. Isolate the fault, reroute load, and brief the other teams. <N> downstream nodes depend on it.`
  - cell\_tower: `Dispatch backup power to <name>` / `Battery ends at T+<fails_at>. Send a generator or fuel before T+<act_by>.`
  - water\_pump: `Arrange tankers or backup supply for <name>` / `Pump loses power and stops at T+<fails_at>.`
  - signal\_cluster: `Deploy traffic police at <name>` / `Signals go dark at T+<fails_at>. Expect jams within 10-15 minutes.`
  - hospital with relation road\_access: `Reroute ambulances away from <name> access roads`; telecom\_link: `Set up an alternate communication channel for <name>`; powers: `Check generator fuel at <name>`; supplies\_water: `Arrange water supply for <name>`.
- Sort by priority desc then node id, return at most 20. Action ids `a01`, `a02`, ... after sorting.

### 9. Summary and briefing

- Summary: `nodes_down` = count with fails\_at not null; `nodes_at_risk` = count with fails\_at null; `down_by_type`; `first_hospital_down_at` = min fails\_at among hospitals or null; `hospitals_down`, `hospitals_at_risk` (ids, sorted).
- Briefing (briefing.py, template based, 3-5 sentences, plain English): trigger names; how many nodes fail in the first 15 minutes and which departments are hit; the first hospital impact time or `no hospital is impacted in this window`; the top 2 actions by priority with their act-by times. No LLM needed for MVP.

### 10. Startup validation (fail fast with a clear message)

On startup, reject the dataset if: duplicate ids; an edge references an unknown node; buffer\_minutes < 0; criticality outside 1..5; dept does not match the type mapping; lat/lng outside the bounding box; a non-substation node with no incoming edge; relation not valid for the source type (powers only from substations, supplies\_water only from water\_pump, telecom\_link only from cell\_tower, road\_access only from signal\_cluster).

### 11. Tests (pytest, must pass)

- **Chain:** A -> B (buffer 30) -> C (buffer 60): fails\_at 0, 30, 90.
- **Redundancy:** C fed by A and B in the same group, A fails at 0 (buffer 10), B at 50 (buffer 10): C fails at 60; if B never fails, C stays at\_risk with fails\_at null.
- **Series:** two different groups: C fails at the earlier group time.
- **Cycle:** A <-> B does not loop forever.
- **Horizon:** nodes with lost\_input\_at beyond horizon are omitted; fails\_at beyond horizon is null.
- **Determinism:** two identical requests give identical JSON.
- **Seed:** the validation rules in section 10 pass on the real city.json; scenario S1 meets the design check in section 7.
- **API:** health, graph counts, scenarios, simulate happy path, unknown id gives 404, empty trigger list gives 422, horizon 5 gives 422.

### 12. Build order (commit after each milestone)

1. **B1 Walking skeleton (finish FIRST, within about 45 minutes):** FastAPI app, CORS, models, store with city.json (even 12 nodes), `/api/health`, `/api/graph`, `/api/scenarios`, and `/api/simulate` returning a hand-made valid SimulationResult. Tell your teammate so the frontend can go live early.
2. **B2 Engine:** engine.py exactly as in section 6, with tests.
3. **B3 Actions, summary, briefing** with tests.
4. **B4 Full seed data** (33 nodes) and validation, scenario tuning.
5. **B5 Export script:** `scripts/export_fixtures.py` writes graph.json, scenarios.json, and simulate\_\<scenario>.json into ../contract/fixtures/ using the real API responses.
6. **B6 README:** run steps, curl examples, how to add a node.

### 13. Acceptance criteria

- `uvicorn app.main:app --reload --port 8000` starts; `/docs` shows all four endpoints.
- `pytest` passes. Simulation latency under 100 ms for S2.
- Every response validates against the Pydantic models with extra forbidden.
- No endpoint ever returns a timestamp as a string or a time in seconds.

### 14. Rules

- Do NOT change the contract. If something is missing, note it in /backend/CONTRACT\_REQUESTS.md and tell your teammate.
- Keep the engine free of FastAPI imports so it can be tested on its own.
- No global mutable state between requests.

### 15. Stretch (only after B6)

- v1.1: optional `mitigations: [{ node_id, extra_buffer_minutes }]` in the request, so the UI can show the effect of sending a generator.
- Optional LLM-written briefing behind a flag, calling a hosted model API with a template fallback.
- A script that builds a seed from OpenStreetMap (hospitals, substations, traffic signals) in the bounding box.

## PROMPT END
