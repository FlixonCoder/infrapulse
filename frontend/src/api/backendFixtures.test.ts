import { describe, it, expect } from 'vitest';
import { graphSchema, scenarioSchema, resultSchema } from './schemas';
import graphData from '../../../contract/fixtures/graph.json';
import scenarioData from '../../../contract/fixtures/scenarios.json';
const fixtures = import.meta.glob('../../../contract/fixtures/simulate_*.json', {
  eager: true,
  import: 'default',
});
describe('exported backend v1 contract', () => {
  const graph = graphSchema.parse(graphData),
    scenarios = scenarioData.map((s) => scenarioSchema.parse(s)),
    ids = new Set(graph.nodes.map((n) => n.id));
  it('exports every backend scenario with references from the same graph', () => {
    expect(graph.nodes).toHaveLength(33);
    expect(Object.keys(fixtures)).toHaveLength(scenarios.length);
    for (const scenario of scenarios) {
      const raw = fixtures[`../../../contract/fixtures/simulate_${scenario.id}.json`];
      expect(raw).toBeDefined();
      const result = resultSchema.parse(raw);
      expect(result.scenario.trigger_node_ids).toEqual(scenario.trigger_node_ids);
      expect(result.scenario.horizon_minutes).toBe(scenario.horizon_minutes);
      for (const n of result.nodes) expect(ids.has(n.node_id)).toBe(true);
      for (const a of result.actions) expect(ids.has(a.node_id)).toBe(true);
      expect(result.summary.nodes_down).toBe(
        result.nodes.filter((n) => n.fails_at !== null).length,
      );
    }
  });
});
