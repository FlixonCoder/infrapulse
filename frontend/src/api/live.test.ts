import { describe, it, expect } from 'vitest';
import { getGraph, getScenarios, simulate, isMockMode } from './client';
describe.skipIf(isMockMode())('live backend HTTP integration', () => {
  it('loads the live graph, runs all presets and accepts custom triggers', async () => {
    const graph = await getGraph(),
      scenarios = await getScenarios();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(scenarios).toHaveLength(3);
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const preset of scenarios) {
      const result = await simulate({
        trigger_node_ids: preset.trigger_node_ids,
        horizon_minutes: preset.horizon_minutes,
      });
      expect(result.scenario.trigger_node_ids).toEqual(preset.trigger_node_ids);
      result.nodes.forEach((n) => expect(ids.has(n.node_id)).toBe(true));
    }
    const custom = graph.nodes.find((n) => n.type === 'cell_tower')!;
    const result = await simulate({ trigger_node_ids: [custom.id], horizon_minutes: 90 });
    expect(result.scenario.horizon_minutes).toBe(90);
    expect(result.nodes.find((n) => n.node_id === custom.id)?.fails_at).toBe(0);
    await expect(simulate({ trigger_node_ids: ['unknown_asset'] })).rejects.toThrow(
      'Unknown trigger',
    );
  });
});
