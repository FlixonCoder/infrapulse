from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NodeType = Literal["substation", "water_pump", "cell_tower", "signal_cluster", "hospital"]
Dept = Literal["electricity", "water", "telecom", "traffic", "health"]
Relation = Literal["powers", "supplies_water", "telecom_link", "road_access"]
Severity = Literal["critical", "high", "medium"]

TYPE_TO_DEPT: dict[NodeType, Dept] = {
    "substation": "electricity",
    "water_pump": "water",
    "cell_tower": "telecom",
    "signal_cluster": "traffic",
    "hospital": "health",
}

SOURCE_TYPE_TO_RELATION: dict[NodeType, Relation] = {
    "substation": "powers",
    "water_pump": "supplies_water",
    "cell_tower": "telecom_link",
    "signal_cluster": "road_access",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GraphNode(StrictModel):
    id: str
    name: str
    type: NodeType
    dept: Dept
    lat: float
    lng: float
    criticality: int = Field(ge=1, le=5)


class GraphEdge(StrictModel):
    id: str
    source: str
    target: str
    relation: Relation
    buffer_minutes: int = Field(ge=0)
    group: str


class Scenario(StrictModel):
    id: str
    name: str
    description: str
    trigger_node_ids: list[str]
    horizon_minutes: int = Field(ge=30, le=1440)


class SimulateRequest(StrictModel):
    trigger_node_ids: list[str] = Field(min_length=1, max_length=5)
    horizon_minutes: int = Field(default=360, ge=30, le=1440)


class CausedBy(StrictModel):
    source_id: str
    relation: Relation


class AffectedNode(StrictModel):
    node_id: str
    lost_input_at: int
    fails_at: int | None
    caused_by: CausedBy | None
    depth: int


class Summary(StrictModel):
    nodes_down: int
    nodes_at_risk: int
    down_by_type: dict[NodeType, int]
    first_hospital_down_at: int | None
    hospitals_down: list[str]
    hospitals_at_risk: list[str]


class Action(StrictModel):
    id: str
    dept: Dept
    node_id: str
    severity: Severity
    priority: float = Field(ge=0.0, le=1.0)
    act_by_minute: int
    title: str
    detail: str


class SimulationScenarioInfo(StrictModel):
    trigger_node_ids: list[str]
    horizon_minutes: int


class SimulationResult(StrictModel):
    scenario: SimulationScenarioInfo
    nodes: list[AffectedNode]
    summary: Summary
    actions: list[Action]
    briefing: str


class HealthResponse(StrictModel):
    status: Literal["ok"]
    nodes: int
    edges: int


class GraphResponse(StrictModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
