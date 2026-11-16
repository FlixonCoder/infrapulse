import { describe, it, expect } from 'vitest';
import graphData from '../mocks/graph.json';
import resultData from '../mocks/simulate_sub.json';
import { graphSchema, resultSchema } from '../api/schemas';
import { countStatuses } from './counts';
import { buildEvents } from './events';
import { buildTimeline, clock } from './timeline';
import { edgeProgress } from './edgeProgress';
import { dependencyTrace } from './trace';
import { buildTour } from './tour';
const graph = graphSchema.parse(graphData),
  result = resultSchema.parse(resultData);
describe('result-driven UI derivations', () => {
  it('counts all assets including unaffected nodes at exact boundaries', () => {
    const horizon = result.scenario.horizon_minutes,
      counts = countStatuses(graph, result, horizon);
    expect(counts.down).toBe(result.summary.nodes_down);
    expect(counts.at_risk).toBe(result.summary.nodes_at_risk);
    expect(counts.down + counts.at_risk + counts.ok).toBe(graph.nodes.length);
    expect(countStatuses(graph, null, 0)).toEqual({ down: 0, at_risk: 0, ok: graph.nodes.length });
    for (const n of result.nodes)
      if (n.fails_at !== null && n.fails_at > 0) {
        expect(countStatuses(graph, result, n.fails_at).down).toBeGreaterThan(
          countStatuses(graph, result, n.fails_at - 0.001).down,
        );
      }
    const depts = new Set(graph.nodes.map((n) => n.dept));
    expect(
      [...depts].reduce((sum, d) => sum + countStatuses(graph, result, horizon, d).down, 0),
    ).toBe(counts.down);
  });
  it('builds stable, sorted input-loss and failure events without duplicating instant failures', () => {
    const events = buildEvents(result, graph);
    expect(events).toEqual(buildEvents(result, graph));
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    for (let i = 1; i < events.length; i++)
      expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
    for (const n of result.nodes)
      expect(events.filter((e) => e.nodeId === n.node_id)).toHaveLength(
        n.fails_at !== null && n.fails_at !== n.lost_input_at ? 2 : 1,
      );
    expect(buildEvents(null, graph)).toEqual([]);
  });
  it('samples every status transition and includes the end of the window', () => {
    const series = buildTimeline(result, graph);
    expect(series[0].time).toBe(0);
    expect(series.at(-1)?.time).toBe(result.scenario.horizon_minutes);
    for (const n of result.nodes) {
      expect(series.some((p) => p.time === n.lost_input_at)).toBe(true);
      if (n.fails_at !== null) expect(series.some((p) => p.time === n.fails_at)).toBe(true);
    }
    for (const p of series) expect(p.down + p.at_risk + p.ok).toBe(graph.nodes.length);
    expect(buildTimeline(null, graph)).toEqual([]);
    expect(clock(135.9)).toBe('02:15');
    expect(clock(-1)).toBe('00:00');
    expect(clock(1440)).toBe('24:00');
  });
  it('clamps edge buffers and handles zero buffers and surviving sources', () => {
    const source = { node_id: 'a', lost_input_at: 0, fails_at: 10, caused_by: null, depth: 0 };
    expect(edgeProgress(source, 9, 20)).toBe(0);
    expect(edgeProgress(source, 20, 20)).toBe(0.5);
    expect(edgeProgress(source, 50, 20)).toBe(1);
    expect(edgeProgress(source, 10, 0)).toBe(1);
    expect(edgeProgress({ ...source, fails_at: null }, 100, 0)).toBe(0);
    expect(edgeProgress(undefined, 100, 10)).toBe(0);
  });
  it('traces directions through cycles without including the origin', () => {
    const cyclic = {
      nodes: [],
      edges: [
        {
          id: '1',
          source: 'a',
          target: 'b',
          relation: 'powers' as const,
          buffer_minutes: 0,
          group: 'p',
        },
        {
          id: '2',
          source: 'b',
          target: 'a',
          relation: 'powers' as const,
          buffer_minutes: 0,
          group: 'p',
        },
        {
          id: '3',
          source: 'b',
          target: 'c',
          relation: 'powers' as const,
          buffer_minutes: 0,
          group: 'p',
        },
      ],
    };
    const trace = dependencyTrace(cyclic, 'a');
    expect([...trace.upstream]).toEqual(['b']);
    expect([...trace.downstream]).toEqual(['b', 'c']);
    expect(dependencyTrace(cyclic, null).downstream.size).toBe(0);
  });
  it('generates a six-chapter tour from actual result names, times and priorities', () => {
    const steps = buildTour(result, graph);
    expect(steps).toHaveLength(6);
    expect(steps[0].nodeId).toBe(result.scenario.trigger_node_ids[0]);
    expect(steps[3].time).toBe(result.scenario.horizon_minutes);
    expect(steps[4].nodeId).toBe(result.actions[0].node_id);
    expect(steps[2].time).toBe(result.summary.first_hospital_down_at);
    expect(steps[5].response).toBe(true);
    expect(buildTour(null, graph)).toEqual([]);
    const noHospital = {
      ...result,
      nodes: result.nodes.filter(
        (n) => !graph.nodes.some((g) => g.id === n.node_id && g.type === 'hospital'),
      ),
    };
    expect(buildTour(noHospital, graph)[2].caption).toContain('dependency levels');
  });
});
