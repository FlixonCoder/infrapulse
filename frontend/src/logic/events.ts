import type { Graph, SimulationResult } from '../api/types';
export function buildEvents(result: SimulationResult | null, graph: Graph) {
  if (!result) return [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  return result.nodes
    .flatMap((n) => {
      const node = nodes.get(n.node_id);
      if (!node) return [];
      const cause = nodes.get(n.caused_by?.source_id ?? '')?.name;
      const events = [
        {
          id: `${n.node_id}-input`,
          nodeId: n.node_id,
          dept: node.dept,
          time: n.lost_input_at,
          text:
            n.fails_at === n.lost_input_at
              ? `${node.name} goes down`
              : `${node.name} loses input${cause ? ` from ${cause}` : ''}; backup ${n.fails_at === null ? 'holds through window' : `${n.fails_at - n.lost_input_at} min`}`,
        },
      ];
      if (n.fails_at !== null && n.fails_at !== n.lost_input_at)
        events.push({
          id: `${n.node_id}-down`,
          nodeId: n.node_id,
          dept: node.dept,
          time: n.fails_at,
          text: `${node.name} goes down`,
        });
      return events;
    })
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}
