from __future__ import annotations

from app.models import Action, AffectedNode, Summary
from app.store import CityStore


def build_briefing(
    store: CityStore,
    trigger_ids: list[str],
    horizon_minutes: int,
    affected: list[AffectedNode],
    summary: Summary,
    actions: list[Action],
) -> str:
    """Generate a 3-5 sentence plain-English briefing from simulation results."""
    # Deduplicate trigger names preserving order
    seen: set[str] = set()
    trigger_names: list[str] = []
    for tid in trigger_ids:
        if tid not in seen:
            seen.add(tid)
            trigger_names.append(store.nodes_by_id[tid].name)

    triggers_str = ", ".join(trigger_names)
    sentence_1 = (
        f"Failure at {triggers_str} triggers a {horizon_minutes}-minute cascade leaving "
        f"{summary.nodes_down} nodes down and {summary.nodes_at_risk} nodes at risk."
    )

    early_nodes = [a for a in affected if a.fails_at is not None and a.fails_at <= 15]
    early_depts = sorted({store.nodes_by_id[a.node_id].dept for a in early_nodes})
    if early_depts:
        depts_str = ", ".join(early_depts)
        sentence_2 = (
            f"Within the first 15 minutes, {len(early_nodes)} node(s) fail across "
            f"the {depts_str} department(s)."
        )
    else:
        sentence_2 = "No nodes fail within the first 15 minutes."

    if summary.first_hospital_down_at is not None:
        first_hosp_names = sorted(
            store.nodes_by_id[hid].name
            for hid in summary.hospitals_down
            if any(
                a.node_id == hid and a.fails_at == summary.first_hospital_down_at
                for a in affected
            )
        )
        hosp_label = ", ".join(first_hosp_names)
        sentence_3 = (
            f"First hospital impact occurs at T+{summary.first_hospital_down_at} minutes "
            f"({hosp_label})."
        )
    else:
        sentence_3 = "No hospital is impacted in this window."

    if len(actions) >= 2:
        a1, a2 = actions[0], actions[1]
        sentence_4 = (
            f"Top priorities: (1) {a1.title} by T+{a1.act_by_minute} min; "
            f"(2) {a2.title} by T+{a2.act_by_minute} min."
        )
    elif len(actions) == 1:
        a1 = actions[0]
        sentence_4 = f"Top priority: {a1.title} by T+{a1.act_by_minute} min."
    else:
        sentence_4 = "No immediate department actions are required."

    return f"{sentence_1} {sentence_2} {sentence_3} {sentence_4}"
