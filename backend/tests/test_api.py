from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.main import app
from app.models import GraphResponse, HealthResponse, Scenario, SimulationResult


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        parsed = HealthResponse.model_validate(resp.json())
        assert parsed.status == "ok"
        assert parsed.nodes == 33
        assert parsed.edges > 0


def test_graph() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/graph")
        assert resp.status_code == 200
        parsed = GraphResponse.model_validate(resp.json())
        assert len(parsed.nodes) == 33


def test_scenarios() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        for item in data:
            Scenario.model_validate(item)


def test_simulate_happy_path_and_latency() -> None:
    with TestClient(app) as client:
        t0 = time.perf_counter()
        resp = client.post(
            "/api/simulate",
            json={"trigger_node_ids": ["sub_220_whitefield"], "horizon_minutes": 480},
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        assert resp.status_code == 200
        assert elapsed_ms < 100.0
        result = SimulationResult.model_validate(resp.json())
        assert result.summary.nodes_down > 0
        assert len(result.actions) <= 20
        assert len(result.briefing) > 0


def test_simulate_errors() -> None:
    with TestClient(app) as client:
        # Unknown node id -> 404
        r404 = client.post(
            "/api/simulate",
            json={"trigger_node_ids": ["nonexistent_node"], "horizon_minutes": 360},
        )
        assert r404.status_code == 404
        assert "detail" in r404.json()

        # Empty trigger list -> 422
        r422_empty = client.post(
            "/api/simulate",
            json={"trigger_node_ids": [], "horizon_minutes": 360},
        )
        assert r422_empty.status_code == 422

        # Horizon < 30 -> 422
        r422_horizon = client.post(
            "/api/simulate",
            json={"trigger_node_ids": ["sub_66_marathahalli"], "horizon_minutes": 5},
        )
        assert r422_horizon.status_code == 422
