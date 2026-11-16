from __future__ import annotations

import heapq
from dataclasses import dataclass

from app.models import AffectedNode, CausedBy, GraphEdge
from app.store import CityStore


@dataclass
class _GroupState:
    remaining: int
    max_d: int = 0
    argmax_edge: GraphEdge | None = None


def simulate(
    store: CityStore,
    trigger_ids: list[str],
    horizon_minutes: int = 360,
) -> list[AffectedNode]:
    """Run deterministic Dijkstra-style cascade simulation over the dependency graph."""
    group_state: dict[tuple[str, str], _GroupState] = {
        key: _GroupState(remaining=count) for key, count in store.group_sizes.items()
    }

    heap: list[tuple[int, str]] = []
    best: dict[str, int] = {}
    depth: dict[str, int] = {}
    caused_by: dict[str, GraphEdge | None] = {}
    lost_input_at: dict[str, int] = {}
    first_lost_edge: dict[str, GraphEdge | None] = {}
    fails_at: dict[str, int] = {}

    trigger_set: set[str] = set()
    for tid in trigger_ids:
        if tid in trigger_set:
            continue
        trigger_set.add(tid)
        best[tid] = 0
        depth[tid] = 0
        caused_by[tid] = None
        lost_input_at[tid] = 0
        first_lost_edge[tid] = None
        heapq.heappush(heap, (0, tid))

    while heap:
        t, n = heapq.heappop(heap)
        if n in fails_at:
            continue
        fails_at[n] = t

        for e in store.outgoing.get(n, ()):
            m = e.target
            if m in fails_at:
                continue

            if m not in lost_input_at:
                lost_input_at[m] = t
                first_lost_edge[m] = e

            st = group_state[(m, e.group)]
            st.remaining -= 1
            d = t + e.buffer_minutes
            if d >= st.max_d:
                st.max_d = d
                st.argmax_edge = e

            if st.remaining == 0 and (m not in best or st.max_d < best[m]):
                best[m] = st.max_d
                heapq.heappush(heap, (st.max_d, m))
                caused_by[m] = st.argmax_edge
                assert st.argmax_edge is not None
                depth[m] = depth[st.argmax_edge.source] + 1

    affected: list[AffectedNode] = []
    for node_id, lost_t in lost_input_at.items():
        if lost_t > horizon_minutes:
            continue

        if node_id in trigger_set:
            affected.append(
                AffectedNode(
                    node_id=node_id,
                    lost_input_at=0,
                    fails_at=0,
                    caused_by=None,
                    depth=0,
                )
            )
            continue

        node_fails_at: int | None = None
        if node_id in fails_at and fails_at[node_id] <= horizon_minutes:
            node_fails_at = fails_at[node_id]

        edge = caused_by.get(node_id)
        if edge is not None:
            node_depth = depth[node_id]
        else:
            edge = first_lost_edge[node_id]
            assert edge is not None
            node_depth = depth[edge.source] + 1

        affected.append(
            AffectedNode(
                node_id=node_id,
                lost_input_at=lost_t,
                fails_at=node_fails_at,
                caused_by=CausedBy(source_id=edge.source, relation=edge.relation),
                depth=node_depth,
            )
        )

    affected.sort(
        key=lambda a: (
            a.lost_input_at,
            a.fails_at if a.fails_at is not None else horizon_minutes + 1,
            a.node_id,
        )
    )
    return affected
