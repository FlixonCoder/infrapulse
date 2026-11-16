import { create } from 'zustand';
import type { Dept, Graph, Scenario, SimulationResult } from '../api/types';
import * as api from '../api/client';
type State = {
  graph: Graph;
  scenarios: Scenario[];
  triggers: string[];
  selectedScenario: string;
  result: SimulationResult | null;
  time: number;
  playing: boolean;
  speed: number;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  mock: boolean;
  filter: Dept | 'all';
  focusedNode: string | null;
  focusVersion: number;
  initialize: () => Promise<void>;
  run: (scenario?: Scenario) => Promise<void>;
  selectScenario: (id: string) => void;
  toggleTrigger: (id: string) => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setFilter: (f: Dept | 'all') => void;
  focus: (id: string) => void;
  dismissError: () => void;
  demo: () => Promise<void>;
};
let requestVersion = 0;
export const useStore = create<State>((set, get) => ({
  graph: { nodes: [], edges: [] },
  scenarios: [],
  triggers: [],
  selectedScenario: '',
  result: null,
  time: 0,
  playing: false,
  speed: 1,
  loading: false,
  initializing: true,
  error: null,
  mock: api.isMockMode(),
  filter: 'all',
  focusedNode: null,
  focusVersion: 0,
  initialize: async () => {
    set({ initializing: true, error: null });
    try {
      const [graph, scenarios] = await Promise.all([api.getGraph(), api.getScenarios()]);
      set({ graph, scenarios, initializing: false });
      if (scenarios[0]) await get().run(scenarios[0]);
    } catch (e) {
      set({
        initializing: false,
        error: e instanceof Error ? e.message : 'Could not load the infrastructure graph.',
      });
    }
  },
  run: async (scenario) => {
    const triggers = scenario?.trigger_node_ids ?? get().triggers;
    if (!triggers.length) {
      set({ error: 'Select at least one trigger node.' });
      return;
    }
    const version = ++requestVersion;
    set({
      loading: true,
      error: null,
      playing: false,
      ...(scenario ? { triggers, selectedScenario: scenario.id } : {}),
    });
    try {
      const result = await api.simulate({
        trigger_node_ids: triggers,
        horizon_minutes: scenario?.horizon_minutes ?? 360,
      });
      if (version === requestVersion) set({ result, time: 0, loading: false, filter: 'all' });
    } catch (e) {
      if (version === requestVersion)
        set({ loading: false, error: e instanceof Error ? e.message : 'Simulation failed.' });
    }
  },
  selectScenario: (id) => {
    const scenario = get().scenarios.find((s) => s.id === id);
    if (scenario) void get().run(scenario);
  },
  toggleTrigger: (id) => {
    if (get().loading) return;
    const current = get().triggers;
    if (!current.includes(id) && current.length >= 5) {
      set({ error: 'You can select up to 5 trigger nodes.' });
      return;
    }
    set({
      triggers: current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
      selectedScenario: '',
      playing: false,
    });
  },
  setTime: (time) =>
    set({ time: Math.max(0, Math.min(time, get().result?.scenario.horizon_minutes ?? 360)) }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setFilter: (filter) => set({ filter }),
  focus: (focusedNode) => set((s) => ({ focusedNode, focusVersion: s.focusVersion + 1 })),
  dismissError: () => set({ error: null }),
  demo: async () => {
    api.useDemoMode();
    set({ mock: true, result: null });
    await get().initialize();
  },
}));
