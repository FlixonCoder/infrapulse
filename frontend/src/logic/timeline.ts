import type { Graph, SimulationResult } from '../api/types';
import { countStatuses } from './counts';
export function buildTimeline(result: SimulationResult | null, graph: Graph) {
  if (!result) return [];
  const times = new Set([0, result.scenario.horizon_minutes]);
  for (const n of result.nodes) {
    times.add(n.lost_input_at);
    if (n.fails_at !== null) times.add(n.fails_at);
  }
  return [...times]
    .sort((a, b) => a - b)
    .map((time) => ({ time, ...countStatuses(graph, result, time) }));
}
export function clock(minutes: number) {
  const m = Math.max(0, Math.floor(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
