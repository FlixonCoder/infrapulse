import type { Graph } from '../api/types';
export function dependencyTrace(graph: Graph, id: string | null) {
  const walk = (reverse: boolean) => {
    const seen = new Set<string>();
    if (!id) return seen;
    const queue = [id];
    for (let i = 0; i < queue.length; i++)
      for (const edge of graph.edges) {
        if ((reverse ? edge.target : edge.source) !== queue[i]) continue;
        const next = reverse ? edge.source : edge.target;
        if (next !== id && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    return seen;
  };
  return { upstream: walk(true), downstream: walk(false) };
}
