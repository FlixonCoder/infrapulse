from __future__ import annotations

import pytest

from app.actions import build_actions, build_summary
from app.engine import simulate
from app.models import GraphEdge, GraphNode
from app.store import load_store, validate_graph


def test_seed_data_validates_and_counts() -> None:
    store = load_store()
    assert len(store.nodes) == 33
    assert len(store.scenarios) == 3

    by_type: dict[str, int] = {}
    for n in store.nodes:
        by_type[n.type] = by_type.get(n.type, 0) + 1

    assert by_type["substation"] == 4
    assert by_type["water_pump"] == 6
    assert by_type["cell_tower"] == 8
    assert by_type["signal_cluster"] == 10
    assert by_type["hospital"] == 5


def test_s1_design_check() -> None:
    store = load_store()
    s1 = next(s for s in store.scenarios if s.id == "S1")
    affected = simulate(store, s1.trigger_node_ids, s1.horizon_minutes)
    summary = build_summary(store, affected)
    actions = build_actions(store, affected)

    assert len(affected) >= 12
    assert summary.first_hospital_down_at is not None
    assert summary.first_hospital_down_at <= 360
    assert len(summary.hospitals_down) >= 1

    urgent_depts = {a.dept for a in actions if a.act_by_minute <= 30}
    assert len(urgent_depts) >= 4
    assert summary.nodes_at_risk >= 2


def test_validation_rejects_bad_graph() -> None:
    n1 = GraphNode(
        id="sub_1",
        name="Sub 1",
        type="substation",
        dept="electricity",
        lat=12.95,
        lng=77.70,
        criticality=4,
    )
    n2 = GraphNode(
        id="hosp_1",
        name="Hosp 1",
        type="hospital",
        dept="health",
        lat=12.95,
        lng=77.70,
        criticality=5,
    )
    e1 = GraphEdge(
        id="e1",
        source="sub_1",
        target="hosp_1",
        relation="powers",
        buffer_minutes=600,
        group="power",
    )

    # Valid passes
    validate_graph([n1, n2], [e1])

    # Duplicate node id
    with pytest.raises(ValueError, match="Duplicate node id"):
        validate_graph([n1, n1], [])

    # Unknown edge target
    bad_edge = GraphEdge(
        id="e2",
        source="sub_1",
        target="missing",
        relation="powers",
        buffer_minutes=10,
        group="power",
    )
    with pytest.raises(ValueError, match="unknown target"):
        validate_graph([n1, n2], [e1, bad_edge])

    # Orphan non-substation
    with pytest.raises(ValueError, match="no incoming edge"):
        validate_graph([n1, n2], [])

    # Wrong relation for source type
    bad_rel = GraphEdge(
        id="e3",
        source="hosp_1",
        target="sub_1",
        relation="powers",
        buffer_minutes=10,
        group="power",
    )
    with pytest.raises(ValueError, match="invalid relation"):
        validate_graph([n1, n2], [e1, bad_rel])

    # Out of bounding box
    oob = n1.model_copy(update={"lat": 13.50})
    with pytest.raises(ValueError, match="outside bounding box"):
        validate_graph([oob, n2], [e1])
