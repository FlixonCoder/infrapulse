# InfraPulse Backend

Deterministic cascade-failure simulator over a city infrastructure dependency graph.

## Setup & Run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs are available at `http://localhost:8000/docs`.

## Run Tests

```bash
cd backend
python -m pytest -v
```

## Export Contract Fixtures

```bash
cd backend
python scripts/export_fixtures.py
```

Writes `graph.json`, `scenarios.json`, and `simulate_<scenario>.json` into `../contract/fixtures/`.

## API Examples (`curl`)

Health check:
```bash
curl http://localhost:8000/api/health
```

Fetch dependency graph:
```bash
curl http://localhost:8000/api/graph
```

List preset scenarios:
```bash
curl http://localhost:8000/api/scenarios
```

Run a simulation:
```bash
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"trigger_node_ids": ["sub_66_marathahalli"], "horizon_minutes": 360}'
```

## How to Add a Node

1. Edit `backend/data/city.json` and append a new object to `"nodes"`:
   - `id`: unique slug (e.g., `tower_09`)
   - `type`: one of `substation`, `water_pump`, `cell_tower`, `signal_cluster`, `hospital`
   - `dept`: must match `type` (`electricity`, `water`, `telecom`, `traffic`, `health`)
   - `lat` / `lng`: must lie within east Bengaluru bounding box (`lat` `12.92..12.98`, `lng` `77.67..77.75`)
   - `criticality`: integer `1..5`
2. If the node is not a `substation`, add at least one incoming edge in `"edges"` with a valid `relation` for the source node's type (`powers`, `supplies_water`, `telecom_link`, or `road_access`), `buffer_minutes >= 0`, and a `group` name (shared `group` values on the same target act as redundant feeds; distinct `group` values act in series).
3. Restart the server or run `python -m pytest -v` to verify startup validation passes.
