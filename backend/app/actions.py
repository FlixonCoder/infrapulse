from __future__ import annotations

from collections import Counter, deque

from app.models import Action, AffectedNode, GraphNode, NodeType, Severity, Summary
from app.store import CityStore

LEAD_MINUTES: dict[NodeType, int] = {
    "substation": 0,
    "signal_cluster": 0,
    "water_pump": 45,
    "cell_tower": 60,
    "hospital": 120,
}


def build_summary(store: CityStore, affected: list[AffectedNode]) -> Summary:
    """Compute aggregate impact summary from affected nodes."""
    nodes_down = 0
    nodes_at_risk = 0
    down_by_type: Counter[NodeType] = Counter()
    hospitals_down: list[str] = []
    hospitals_at_risk: list[str] = []
    first_hospital_down_at: int | None = None

    for item in affected:
        node = store.nodes_by_id[item.node_id]
        if item.fails_at is not None:
            nodes_down += 1
            down_by_type[node.type] += 1
            if node.type == "hospital":
                hospitals_down.append(node.id)
                if first_hospital_down_at is None or item.fails_at < first_hospital_down_at:
                    first_hospital_down_at = item.fails_at
        else:
            nodes_at_risk += 1
            if node.type == "hospital":
                hospitals_at_risk.append(node.id)

    hospitals_down.sort()
    hospitals_at_risk.sort()

    return Summary(
        nodes_down=nodes_down,
        nodes_at_risk=nodes_at_risk,
        down_by_type=dict(down_by_type),
        first_hospital_down_at=first_hospital_down_at,
        hospitals_down=hospitals_down,
        hospitals_at_risk=hospitals_at_risk,
    )


def _count_downstream(store: CityStore, start_id: str) -> int:
    visited: set[str] = {start_id}
    queue: deque[str] = deque([start_id])
    while queue:
        curr = queue.popleft()
        for edge in store.outgoing.get(curr, ()):
            if edge.target not in visited:
                visited.add(edge.target)
                queue.append(edge.target)
    return len(visited) - 1


def _build_title_and_detail(
    store: CityStore,
    node: GraphNode,
    item: AffectedNode,
    act_by: int,
) -> tuple[str, str]:
    assert item.fails_at is not None
    fails_at = item.fails_at

    if node.type == "substation":
        downstream = _count_downstream(store, node.id)
        title = f"Restore or reroute load for {node.name}"
        if item.caused_by is None:
            detail = (
                f"Fault at T+0. Isolate the fault, reroute load, and brief the other teams. "
                f"{downstream} downstream nodes depend on it."
            )
        else:
            detail = (
                f"Loses upstream power at T+{fails_at}. Isolate the fault, reroute load, "
                f"and brief the other teams. {downstream} downstream nodes depend on it."
            )
        return title, detail

    if node.type == "cell_tower":
        title = f"Dispatch backup power to {node.name}"
        detail = f"Battery ends at T+{fails_at}. Send a generator or fuel before T+{act_by}."
        return title, detail

    if node.type == "water_pump":
        title = f"Arrange tankers or backup supply for {node.name}"
        detail = f"Pump loses power and stops at T+{fails_at}."
        return title, detail

    if node.type == "signal_cluster":
        title = f"Deploy traffic police at {node.name}"
        detail = f"Signals go dark at T+{fails_at}. Expect jams within 10-15 minutes."
        return title, detail

    # hospital
    rel = item.caused_by.relation if item.caused_by is not None else None
    if rel == "road_access":
        title = f"Reroute ambulances away from {node.name} access roads"
    elif rel == "telecom_link":
        title = f"Set up an alternate communication channel for {node.name}"
    elif rel == "powers":
        title = f"Check generator fuel at {node.name}"
    elif rel == "supplies_water":
        title = f"Arrange water supply for {node.name}"
    else:
        title = f"Activate emergency protocol at {node.name}"

    rel_label = rel if rel is not None else "direct trigger"
    detail = f"Hospital impacted at T+{fails_at} ({rel_label}). Act before T+{act_by}."
    return title, detail


def build_actions(store: CityStore, affected: list[AffectedNode]) -> list[Action]:
    """Generate, score, sort, and cap (top 20) department actions."""
    candidates: list[tuple[float, str, Action]] = []

    for item in affected:
        if item.fails_at is None:
            continue

        node = store.nodes_by_id[item.node_id]
        lead = LEAD_MINUTES[node.type]
        act_by = max(0, item.fails_at - lead)
        priority = round((node.criticality / 5.0) * (1.0 / (1.0 + act_by / 60.0)), 3)

        if node.type == "hospital" or priority >= 0.6:
            severity: Severity = "critical"
        elif priority >= 0.35:
            severity = "high"
        else:
            severity = "medium"

        title, detail = _build_title_and_detail(store, node, item, act_by)

        # Temporary id; reassigned after sorting
        action = Action(
            id="a00",
            dept=node.dept,
            node_id=node.id,
            severity=severity,
            priority=priority,
            act_by_minute=act_by,
            title=title,
            detail=detail,
        )
        candidates.append((priority, node.id, action))

    candidates.sort(key=lambda entry: (-entry[0], entry[1]))
    top = candidates[:20]

    result: list[Action] = []
    for idx, (_, _, action) in enumerate(top, start=1):
        result.append(action.model_copy(update={"id": f"a{idx:02d}"}))

    return result
