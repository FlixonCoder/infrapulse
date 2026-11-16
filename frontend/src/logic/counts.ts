import type { Graph, SimulationResult } from '../api/types';
import { getStatus } from './status';
export function countStatuses(
  graph: Graph,
  result: SimulationResult | null,
  time: number,
  dept?: string,
) {
  const counts = { down: 0, at_risk: 0, ok: 0 };
  const affected = new Map(result?.nodes.map((n) => [n.node_id, n]));
  for (const node of graph.nodes)
    if (!dept || node.dept === dept) counts[getStatus(affected.get(node.id), time).status]++;
  return counts;
}
