from __future__ import annotations

from app.engine import simulate
from app.models import GraphEdge, GraphNode
from app.store import build_store


def _node(nid: str, ntype: str = "substation", crit: int = 3) -> GraphNode:
    dept_map = {
        "substation": "electricity",
        "water_pump": "water",
        "cell_tower": "telecom",
        "signal_cluster": "traffic",
        "hospital": "health",
    }
    return GraphNode(
        id=nid,
        name=f"Node {nid}",
        type=ntype,  # type: ignore[arg-type]
        dept=dept_map[ntype],  # type: ignore[arg-type]
        lat=12.95,
        lng=77.70,
        criticality=crit,
    )


def _edge(
    eid: str,
    src: str,
    dst: str,
    buf: int,
    group: str = "g1",
    rel: str = "powers",
) -> GraphEdge:
    return GraphEdge(
        id=eid,
        source=src,
        target=dst,
        relation=rel,  # type: ignore[arg-type]
        buffer_minutes=buf,
        group=group,
    )


def test_chain() -> None:
    nodes = [_node("A"), _node("B", "water_pump"), _node("C", "hospital")]
    edges = [
        _edge("e1", "A", "B", 30, "power", "powers"),
        _edge("e2", "B", "C", 60, "water", "supplies_water"),
    ]
    store = build_store(nodes, edges)
    res = {a.node_id: a for a in simulate(store, ["A"], horizon_minutes=360)}

    assert res["A"].lost_input_at == 0
    assert res["A"].fails_at == 0
    assert res["A"].caused_by is None
    assert res["A"].depth == 0

    assert res["B"].lost_input_at == 0
    assert res["B"].fails_at == 30
    assert res["B"].caused_by is not None and res["B"].caused_by.source_id == "A"
    assert res["B"].depth == 1

    assert res["C"].lost_input_at == 30
    assert res["C"].fails_at == 90
    assert res["C"].caused_by is not None and res["C"].caused_by.source_id == "B"
    assert res["C"].depth == 2


def test_redundancy_both_fail_and_partial_fail() -> None:
    # C fed by A and B in the same group "power"
    nodes = [
        _node("T"),
        _node("A"),
        _node("B"),
        _node("C", "cell_tower"),
    ]
    edges = [
        _edge("e0", "T", "A", 0, "g0", "powers"),
        _edge("e1", "T", "B", 50, "g0", "powers"),
        _edge("e2", "A", "C", 10, "power", "powers"),
        _edge("e3", "B", "C", 10, "power", "powers"),
    ]
    store = build_store(nodes, edges)
    res = {a.node_id: a for a in simulate(store, ["T"], horizon_minutes=360)}

    assert res["A"].fails_at == 0
    assert res["B"].fails_at == 50
    assert res["C"].lost_input_at == 0
    assert res["C"].fails_at == 60
    assert res["C"].caused_by is not None and res["C"].caused_by.source_id == "B"

    # Now if B never fails (trigger only A), C stays at_risk with fails_at None
    res_partial = {a.node_id: a for a in simulate(store, ["A"], horizon_minutes=360)}
    assert res_partial["C"].lost_input_at == 0
    assert res_partial["C"].fails_at is None
    assert res_partial["C"].caused_by is not None
    assert res_partial["C"].caused_by.source_id == "A"


def test_series_earlier_group_wins() -> None:
    nodes = [
        _node("T"),
        _node("A", "water_pump"),
        _node("B", "cell_tower"),
        _node("C", "hospital"),
    ]
    edges = [
        _edge("e1", "T", "A", 10, "g1", "powers"),
        _edge("e2", "T", "B", 5, "g2", "powers"),
        _edge("e3", "A", "C", 100, "water", "supplies_water"),  # fails C at 110
        _edge("e4", "B", "C", 20, "telecom", "telecom_link"),   # fails C at 25
    ]
    store = build_store(nodes, edges)
    res = {a.node_id: a for a in simulate(store, ["T"], horizon_minutes=360)}

    assert res["C"].fails_at == 25
    assert res["C"].caused_by is not None
    assert res["C"].caused_by.source_id == "B"
    assert res["C"].caused_by.relation == "telecom_link"


def test_cycle_terminates_safely() -> None:
    nodes = [_node("A"), _node("B")]
    edges = [
        _edge("e1", "A", "B", 10, "power", "powers"),
        _edge("e2", "B", "A", 10, "power", "powers"),
    ]
    store = build_store(nodes, edges)
    res = {a.node_id: a for a in simulate(store, ["A"], horizon_minutes=360)}

    assert res["A"].fails_at == 0
    assert res["B"].fails_at == 10
    assert len(res) == 2


def test_horizon_filtering() -> None:
    nodes = [
        _node("A"),
        _node("B", "water_pump"),
        _node("C", "hospital"),
        _node("D", "cell_tower"),
    ]
    edges = [
        _edge("e1", "A", "B", 50, "power", "powers"),           # B lost_input 0, fails 50
        _edge("e2", "B", "C", 100, "water", "supplies_water"), # C lost_input 50, fails 150
        _edge("e3", "A", "D", 120, "power", "powers"),         # D lost_input 0, fails 120
    ]
    store = build_store(nodes, edges)

    # Horizon = 40: C has lost_input_at 50 > 40 -> omitted; B and D have lost_input_at 0 <= 40, fails_at > 40 -> None
    res = {a.node_id: a for a in simulate(store, ["A"], horizon_minutes=40)}
    assert set(res.keys()) == {"A", "B", "D"}
    assert res["B"].fails_at is None
    assert res["D"].fails_at is None


def test_determinism() -> None:
    nodes = [_node("A"), _node("B", "water_pump"), _node("C", "cell_tower")]
    edges = [
        _edge("e1", "A", "B", 10, "p", "powers"),
        _edge("e2", "A", "C", 10, "p", "powers"),
    ]
    store = build_store(nodes, edges)
    r1 = [a.model_dump() for a in simulate(store, ["A"], horizon_minutes=360)]
    r2 = [a.model_dump() for a in simulate(store, ["A"], horizon_minutes=360)]
    assert r1 == r2
