import type { Graph, SimulationResult } from '../api/types';
export function buildTour(result: SimulationResult | null, graph: Graph) {
  if (!result) return [];
  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id;
  const trigger = result.scenario.trigger_node_ids[0];
  const first = result.nodes
    .filter((n) => n.fails_at !== null && !result.scenario.trigger_node_ids.includes(n.node_id))
    .sort((a, b) => a.fails_at! - b.fails_at! || a.node_id.localeCompare(b.node_id))[0];
  const hospital = result.nodes
    .filter(
      (n) =>
        n.fails_at !== null && graph.nodes.some((g) => g.id === n.node_id && g.type === 'hospital'),
    )
    .sort((a, b) => a.fails_at! - b.fails_at! || a.node_id.localeCompare(b.node_id))[0];
  const critical =
    hospital ??
    [...result.nodes].sort((a, b) => b.depth - a.depth || a.node_id.localeCompare(b.node_id))[0];
  return [
    {
      time: 0,
      nodeId: trigger,
      caption: `It starts at ${name(trigger)}. One failure.`,
      response: false,
    },
    {
      time: first?.fails_at ?? 0,
      nodeId: first?.node_id ?? trigger,
      caption: first
        ? `${name(first.node_id)} fails at T+${first.fails_at} min. The cascade has begun.`
        : 'No downstream failure in this window.',
      response: false,
    },
    {
      time: critical?.fails_at ?? critical?.lost_input_at ?? 0,
      nodeId: critical?.node_id ?? trigger,
      caption: hospital
        ? `${name(hospital.node_id)} is impacted at T+${hospital.fails_at} min. This is the window to act.`
        : `Trace ${critical?.depth ?? 0} dependency levels before the chain spreads.`,
      response: false,
    },
    {
      time: result.scenario.horizon_minutes,
      nodeId: null,
      caption: `${result.summary.nodes_down} assets down across this simulation window.`,
      response: false,
    },
    {
      time: result.scenario.horizon_minutes,
      nodeId: result.actions[0]?.node_id ?? trigger,
      caption: result.actions[0]?.title ?? 'Review the response briefing.',
      response: true,
    },
    {
      time: result.scenario.horizon_minutes,
      nodeId: null,
      caption: 'See the chain before it breaks. Coordinate while there is still time.',
      response: true,
    },
  ];
}
