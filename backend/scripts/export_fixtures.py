"""Export real API responses into ../contract/fixtures/ for frontend & contract consumers."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    fixtures_dir = BACKEND_DIR.parent / "contract" / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    with TestClient(app) as client:
        graph_resp = client.get("/api/graph")
        graph_resp.raise_for_status()
        (fixtures_dir / "graph.json").write_text(
            json.dumps(graph_resp.json(), indent=2), encoding="utf-8"
        )

        scenarios_resp = client.get("/api/scenarios")
        scenarios_resp.raise_for_status()
        scenarios = scenarios_resp.json()
        (fixtures_dir / "scenarios.json").write_text(
            json.dumps(scenarios, indent=2), encoding="utf-8"
        )

        for scenario in scenarios:
            sim_resp = client.post(
                "/api/simulate",
                json={
                    "trigger_node_ids": scenario["trigger_node_ids"],
                    "horizon_minutes": scenario["horizon_minutes"],
                },
            )
            sim_resp.raise_for_status()
            out_path = fixtures_dir / f"simulate_{scenario['id']}.json"
            out_path.write_text(
                json.dumps(sim_resp.json(), indent=2), encoding="utf-8"
            )

    print(f"Exported fixtures to {fixtures_dir}")


if __name__ == "__main__":
    main()
