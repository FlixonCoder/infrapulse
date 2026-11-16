import { useUI, type Layers as LayerFlags } from '../state/ui';
const labels: Record<keyof LayerFlags, string> = {
  arcs: 'Dependency arcs',
  particles: 'Flow particles',
  ripples: 'Failure ripples',
  lights: 'Lights-out mood',
  follow: 'Follow cascade',
  labels: 'Asset labels',
};
export function Layers() {
  const layers = useUI((s) => s.layers),
    toggle = useUI((s) => s.toggleLayer);
  return (
    <details className="panel layer-panel" open={window.innerWidth >= 768}>
      <summary>Map layers</summary>
      {(Object.keys(labels) as (keyof LayerFlags)[]).map((key) => (
        <label key={key}>
          <span>{labels[key]}</span>
          <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />
        </label>
      ))}
    </details>
  );
}
