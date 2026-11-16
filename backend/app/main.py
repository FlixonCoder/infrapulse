from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.actions import build_actions, build_summary
from app.briefing import build_briefing
from app.engine import simulate
from app.models import (
    GraphResponse,
    HealthResponse,
    Scenario,
    SimulateRequest,
    SimulationResult,
    SimulationScenarioInfo,
)
from app.store import CityStore, load_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = load_store()
    yield


app = FastAPI(
    title="InfraPulse API",
    version="1.0.0",
    description="Deterministic cascade-failure simulator over a city infrastructure dependency graph.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_store(request: Request) -> CityStore:
    store: CityStore | None = getattr(request.app.state, "store", None)
    if store is None:
        store = load_store()
        request.app.state.store = store
    return store


@app.get("/api/health", response_model=HealthResponse)
def get_health(request: Request) -> HealthResponse:
    store = _get_store(request)
    return HealthResponse(
        status="ok",
        nodes=len(store.nodes),
        edges=len(store.edges),
    )


@app.get("/api/graph", response_model=GraphResponse)
def get_graph(request: Request) -> GraphResponse:
    store = _get_store(request)
    return GraphResponse(nodes=store.nodes, edges=store.edges)


@app.get("/api/scenarios", response_model=list[Scenario])
def get_scenarios(request: Request) -> list[Scenario]:
    store = _get_store(request)
    return store.scenarios


@app.post("/api/simulate", response_model=SimulationResult)
def post_simulate(body: SimulateRequest, request: Request) -> SimulationResult:
    store = _get_store(request)

    unknown = [nid for nid in body.trigger_node_ids if nid not in store.nodes_by_id]
    if unknown:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown trigger node id(s): {', '.join(unknown)}",
        )

    affected = simulate(store, body.trigger_node_ids, body.horizon_minutes)
    summary = build_summary(store, affected)
    actions = build_actions(store, affected)
    briefing = build_briefing(
        store,
        body.trigger_node_ids,
        body.horizon_minutes,
        affected,
        summary,
        actions,
    )

    return SimulationResult(
        scenario=SimulationScenarioInfo(
            trigger_node_ids=body.trigger_node_ids,
            horizon_minutes=body.horizon_minutes,
        ),
        nodes=affected,
        summary=summary,
        actions=actions,
        briefing=briefing,
    )
