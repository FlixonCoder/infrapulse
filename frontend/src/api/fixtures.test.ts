import { describe, expect, it } from 'vitest';
import { graphSchema, resultSchema, scenarioSchema } from './schemas';
import graph from '../mocks/graph.json';
import scenarios from '../mocks/scenarios.json';
import sub from '../mocks/simulate_sub.json';
import water from '../mocks/simulate_water.json';
import dual from '../mocks/simulate_dual.json';
import { simulate } from './client';
describe('frozen API demo fixtures', () => {
  it('graph and presets validate and references exist', () => {
    const g = graphSchema.parse(graph);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
    for (const raw of scenarios) {
      const s = scenarioSchema.parse(raw);
      s.trigger_node_ids.forEach((id) => expect(ids.has(id)).toBe(true));
    }
    expect(g.nodes).toHaveLength(14);
  });
  for (const [name, data] of Object.entries({ sub, water, dual }))
    it(`${name} fixture is consistent with its graph and summary`, () => {
      const r = resultSchema.parse(data);
      const ids = new Set(graph.nodes.map((n) => n.id));
      for (const n of r.nodes) {
        expect(ids.has(n.node_id)).toBe(true);
        if (n.fails_at !== null) expect(n.fails_at).toBeGreaterThanOrEqual(n.lost_input_at);
        if (n.caused_by)
          expect(
            graph.edges.some(
              (e) =>
                e.source === n.caused_by?.source_id &&
                e.target === n.node_id &&
                e.relation === n.caused_by?.relation,
            ),
          ).toBe(true);
      }
      for (const id of r.scenario.trigger_node_ids) {
        expect(r.nodes.find((n) => n.node_id === id)).toMatchObject({
          fails_at: 0,
          lost_input_at: 0,
          caused_by: null,
          depth: 0,
        });
      }
      expect(r.summary.nodes_down).toBe(r.nodes.filter((n) => n.fails_at !== null).length);
      expect(r.summary.nodes_at_risk).toBe(r.nodes.filter((n) => n.fails_at === null).length);
      for (let i = 1; i < r.actions.length; i++)
        expect(r.actions[i].priority).toBeLessThanOrEqual(r.actions[i - 1].priority);
      r.actions.forEach((a) => expect(ids.has(a.node_id)).toBe(true));
    });
  it('does not present an unrelated recorded cascade for custom triggers', async () => {
    await expect(simulate({ trigger_node_ids: ['tower1'] })).rejects.toThrow(
      'three recorded scenarios',
    );
  });
});
