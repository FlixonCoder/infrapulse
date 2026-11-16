import { useStore } from '../state/store';
import { deptColors, typeLabels } from '../logic/format';
import { NodeIcon } from './NodeMarker';
import type { NodeType } from '../api/types';
const types: NodeType[] = ['substation', 'water_pump', 'cell_tower', 'signal_cluster', 'hospital'];
export function Legend() {
  const nodes = useStore((s) => s.graph.nodes);
  return (
    <details className="panel legend-panel">
      <summary>Network legend</summary>
      <div className="status-legend">
        <span className="ok-text">● Operational</span>
        <span className="risk-text">▲ At risk</span>
        <span className="down-text">× Down</span>
      </div>
      <div className="asset-legend">
        {types.map((type) => {
          const matching = nodes.filter((n) => n.type === type);
          return (
            <div key={type}>
              <span style={{ color: matching[0] ? deptColors[matching[0].dept] : undefined }}>
                <NodeIcon type={type} />
              </span>
              <span>{typeLabels[type]}</span>
              <b>{matching.length}</b>
            </div>
          );
        })}
      </div>
      <p className="muted">Arcs follow dependency direction.</p>
    </details>
  );
}
