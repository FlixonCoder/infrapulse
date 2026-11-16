# InfraPulse API contract v1 (frozen)

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

Units: integer minutes. Missing result nodes are operational; fails_at null means backup holds through the window. Same-group incoming edges are redundant; different groups act in series.
