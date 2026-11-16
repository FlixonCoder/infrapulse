import { useShallow } from 'zustand/react/shallow';
import { X, MousePointer2, Zap } from 'lucide-react';
import { useStore } from '../state/store';
export function TriggerChips() {
  const { triggers, graph, toggleTrigger, loading, result } = useStore(
    useShallow((s) => ({
      triggers: s.triggers,
      graph: s.graph,
      toggleTrigger: s.toggleTrigger,
      loading: s.loading,
      result: s.result,
    })),
  );
  const changed =
    result &&
    [...triggers].sort().join(',') !== [...result.scenario.trigger_node_ids].sort().join(',');
  return (
    <section className="panel trigger-panel">
      <div className="section-heading">
        <span>
          <Zap size={13} /> FAILURE TRIGGERS
        </span>
        <small>{triggers.length} / 5</small>
      </div>
      <p className="panel-caption">Where does the disruption begin?</p>
      <div className="trigger-list">
        {triggers.map((id) => (
          <div className="trigger-chip" key={id}>
            <span className="tiny-dot" />
            <span>{graph.nodes.find((n) => n.id === id)?.name ?? id}</span>
            <button
              disabled={loading}
              aria-label={`Remove ${graph.nodes.find((n) => n.id === id)?.name ?? id} trigger`}
              onClick={() => toggleTrigger(id)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <p className="trigger-hint">
        <MousePointer2 size={13} />
        {changed
          ? 'Triggers changed. Run to update results.'
          : 'Click a map node to add a trigger.'}
      </p>
    </section>
  );
}
