from __future__ import annotations

from app.actions import build_actions, build_summary
from app.briefing import build_briefing
from app.engine import simulate
from app.models import GraphEdge, GraphNode
from app.store import build_store


def _make_sample_store():
    nodes = [
        GraphNode(
            id="sub_1",
            name="Substation 1",
            type="substation",
            dept="electricity",
            lat=12.95,
            lng=77.70,
            criticality=4,
        ),
        GraphNode(
            id="pump_1",
            name="Pump 1",
            type="water_pump",
            dept="water",
            lat=12.95,
            lng=77.70,
            criticality=3,
        ),
        GraphNode(
            id="tower_1",
            name="Tower 1",
            type="cell_tower",
            dept="telecom",
            lat=12.95,
            lng=77.70,
            criticality=3,
        ),
        GraphNode(
            id="sig_1",
            name="Signal 1",
            type="signal_cluster",
            dept="traffic",
            lat=12.95,
            lng=77.70,
            criticality=2,
        ),
        GraphNode(
            id="hosp_1",
            name="City Hospital",
            type="hospital",
            dept="health",
            lat=12.95,
            lng=77.70,
            criticality=5,
        ),
    ]
    edges = [
        GraphEdge(id="e1", source="sub_1", target="pump_1", relation="powers", buffer_minutes=20, group="power"),
        GraphEdge(id="e2", source="sub_1", target="tower_1", relation="powers", buffer_minutes=120, group="power"),
        GraphEdge(id="e3", source="sub_1", target="sig_1", relation="powers", buffer_minutes=10, group="power"),
        GraphEdge(id="e4", source="sig_1", target="hosp_1", relation="road_access", buffer_minutes=15, group="road"),
    ]
    return build_store(nodes, edges)


def test_actions_scoring_and_templates() -> None:
    store = _make_sample_store()
    affected = simulate(store, ["sub_1"], horizon_minutes=360)
    summary = build_summary(store, affected)
    actions = build_actions(store, affected)

    assert summary.nodes_down == 5
    assert summary.nodes_at_risk == 0
    assert summary.first_hospital_down_at == 25
    assert summary.hospitals_down == ["hosp_1"]

    by_node = {a.node_id: a for a in actions}
    # Hospital: fails_at=25, lead=120 -> act_by=0, crit=5 -> priority=1.0, severity=critical
    assert by_node["hosp_1"].act_by_minute == 0
    assert by_node["hosp_1"].priority == 1.0
    assert by_node["hosp_1"].severity == "critical"
    assert "Reroute ambulances" in by_node["hosp_1"].title

    # Tower: fails_at=120, lead=60 -> act_by=60, crit=3 -> (3/5)*(1/(1+1)) = 0.3, medium
    assert by_node["tower_1"].act_by_minute == 60
    assert by_node["tower_1"].priority == 0.3
    assert by_node["tower_1"].severity == "medium"

    # IDs assigned sequentially after sort
    assert [a.id for a in actions] == [f"a{i:02d}" for i in range(1, len(actions) + 1)]
    # Sorted descending by priority
    priorities = [a.priority for a in actions]
    assert priorities == sorted(priorities, reverse=True)

    briefing = build_briefing(store, ["sub_1"], 360, affected, summary, actions)
    assert "Substation 1" in briefing
    assert "T+25 minutes" in briefing
    assert "City Hospital" in briefing


def test_actions_capped_at_20() -> None:
    nodes = [
        GraphNode(
            id="sub_0",
            name="Main Sub",
            type="substation",
            dept="electricity",
            lat=12.95,
            lng=77.70,
            criticality=5,
        )
    ]
    edges = []
    for i in range(1, 26):
        nid = f"sig_{i:02d}"
        nodes.append(
            GraphNode(
                id=nid,
                name=f"Signal {i}",
                type="signal_cluster",
                dept="traffic",
                lat=12.95,
                lng=77.70,
                criticality=2,
            )
        )
        edges.append(
            GraphEdge(
                id=f"e{i:03d}",
                source="sub_0",
                target=nid,
                relation="powers",
                buffer_minutes=5,
                group="power",
            )
        )
    store = build_store(nodes, edges)
    affected = simulate(store, ["sub_0"], horizon_minutes=360)
    actions = build_actions(store, affected)
    assert len(actions) == 20
    assert actions[0].id == "a01"
    assert actions[-1].id == "a20"
