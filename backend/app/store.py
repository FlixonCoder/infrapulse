from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from app.models import (
    SOURCE_TYPE_TO_RELATION,
    TYPE_TO_DEPT,
    GraphEdge,
    GraphNode,
    Scenario,
)

LAT_MIN = 12.92
LAT_MAX = 12.98
LNG_MIN = 77.67
LNG_MAX = 77.75

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass(frozen=True)
class CityStore:
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    scenarios: list[Scenario]
    nodes_by_id: dict[str, GraphNode]
    outgoing: dict[str, tuple[GraphEdge, ...]]
    incoming: dict[str, tuple[GraphEdge, ...]]
    group_sizes: dict[tuple[str, str], int]


def validate_graph(nodes: list[GraphNode], edges: list[GraphEdge]) -> None:
    """Validate graph invariants and fail fast with a clear ValueError."""
    seen_node_ids: set[str] = set()
    nodes_by_id: dict[str, GraphNode] = {}

    for node in nodes:
        if node.id in seen_node_ids:
            raise ValueError(f"Duplicate node id: '{node.id}'")
        seen_node_ids.add(node.id)
        nodes_by_id[node.id] = node

        if not (1 <= node.criticality <= 5):
            raise ValueError(
                f"Node '{node.id}' has criticality {node.criticality} outside 1..5"
            )

        expected_dept = TYPE_TO_DEPT[node.type]
        if node.dept != expected_dept:
            raise ValueError(
                f"Node '{node.id}' of type '{node.type}' has dept '{node.dept}', expected '{expected_dept}'"
            )

        if not (LAT_MIN <= node.lat <= LAT_MAX):
            raise ValueError(
                f"Node '{node.id}' lat {node.lat} outside bounding box [{LAT_MIN}, {LAT_MAX}]"
            )
        if not (LNG_MIN <= node.lng <= LNG_MAX):
            raise ValueError(
                f"Node '{node.id}' lng {node.lng} outside bounding box [{LNG_MIN}, {LNG_MAX}]"
            )

    seen_edge_ids: set[str] = set()
    incoming_counts: dict[str, int] = defaultdict(int)

    for edge in edges:
        if edge.id in seen_edge_ids:
            raise ValueError(f"Duplicate edge id: '{edge.id}'")
        seen_edge_ids.add(edge.id)

        if edge.source not in nodes_by_id:
            raise ValueError(f"Edge '{edge.id}' references unknown source '{edge.source}'")
        if edge.target not in nodes_by_id:
            raise ValueError(f"Edge '{edge.id}' references unknown target '{edge.target}'")
        if edge.buffer_minutes < 0:
            raise ValueError(f"Edge '{edge.id}' has negative buffer_minutes: {edge.buffer_minutes}")

        source_node = nodes_by_id[edge.source]
        allowed_relation = SOURCE_TYPE_TO_RELATION.get(source_node.type)
        if allowed_relation is None or edge.relation != allowed_relation:
            raise ValueError(
                f"Edge '{edge.id}' has invalid relation '{edge.relation}' for source type '{source_node.type}'"
            )

        incoming_counts[edge.target] += 1

    for node in nodes:
        if node.type != "substation" and incoming_counts[node.id] == 0:
            raise ValueError(
                f"Non-substation node '{node.id}' (type '{node.type}') has no incoming edge"
            )


def build_store(
    nodes: list[GraphNode],
    edges: list[GraphEdge],
    scenarios: list[Scenario] | None = None,
) -> CityStore:
    """Validate nodes and edges and build immutable lookup indexes."""
    validate_graph(nodes, edges)

    nodes_by_id = {n.id: n for n in nodes}
    outgoing_tmp: dict[str, list[GraphEdge]] = defaultdict(list)
    incoming_tmp: dict[str, list[GraphEdge]] = defaultdict(list)
    group_sizes: dict[tuple[str, str], int] = defaultdict(int)

    for edge in sorted(edges, key=lambda e: (e.source, e.target, e.id)):
        outgoing_tmp[edge.source].append(edge)
        incoming_tmp[edge.target].append(edge)
        group_sizes[(edge.target, edge.group)] += 1

    outgoing = {nid: tuple(outgoing_tmp.get(nid, ())) for nid in nodes_by_id}
    incoming = {nid: tuple(incoming_tmp.get(nid, ())) for nid in nodes_by_id}

    scenario_list = scenarios or []
    for scenario in scenario_list:
        for tid in scenario.trigger_node_ids:
            if tid not in nodes_by_id:
                raise ValueError(
                    f"Scenario '{scenario.id}' references unknown trigger node '{tid}'"
                )

    return CityStore(
        nodes=list(nodes),
        edges=list(edges),
        scenarios=list(scenario_list),
        nodes_by_id=nodes_by_id,
        outgoing=outgoing,
        incoming=incoming,
        group_sizes=dict(group_sizes),
    )


def load_store(data_dir: Path = DATA_DIR) -> CityStore:
    """Load city.json and scenarios.json from disk and build a validated CityStore."""
    city_path = data_dir / "city.json"
    scenarios_path = data_dir / "scenarios.json"

    with city_path.open("r", encoding="utf-8") as f:
        city_raw = json.load(f)

    nodes = [GraphNode.model_validate(item) for item in city_raw["nodes"]]
    edges = [GraphEdge.model_validate(item) for item in city_raw["edges"]]

    scenarios: list[Scenario] = []
    if scenarios_path.exists():
        with scenarios_path.open("r", encoding="utf-8") as f:
            scenarios_raw = json.load(f)
        scenarios = [Scenario.model_validate(item) for item in scenarios_raw]

    return build_store(nodes, edges, scenarios)
