import { useShallow } from 'zustand/react/shallow';
import { ChevronDown, Layers } from 'lucide-react';
import { useStore } from '../state/store';
export function ScenarioPicker() {
  const { scenarios, selectedScenario, selectScenario, loading, initializing } = useStore(
    useShallow((s) => ({
      scenarios: s.scenarios,
      selectedScenario: s.selectedScenario,
      selectScenario: s.selectScenario,
      loading: s.loading,
      initializing: s.initializing,
    })),
  );
  return (
    <div className="scenario-picker">
      <Layers size={16} />
      <select
        aria-label="Simulation scenario"
        value={selectedScenario}
        disabled={loading || initializing}
        onChange={(e) => selectScenario(e.target.value)}
      >
        <option value="" disabled>
          {scenarios.length ? 'Custom scenario' : 'Loading scenarios…'}
        </option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  );
}
