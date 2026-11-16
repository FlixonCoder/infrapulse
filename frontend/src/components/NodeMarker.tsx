import { useEffect, useMemo, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type Marker as LeafletMarker } from 'leaflet';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Zap, Droplets, RadioTower, TrafficCone, Hospital } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { GraphNode, NodeType } from '../api/types';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { getStatus } from '../logic/status';
import { dependencyTrace } from '../logic/trace';
import { duration, statusLabels, timeLabel, titleCase, typeLabels } from '../logic/format';
export const typeIcons = {
  substation: Zap,
  water_pump: Droplets,
  cell_tower: RadioTower,
  signal_cluster: TrafficCone,
  hospital: Hospital,
};
export function NodeIcon({ type, size = 16 }: { type: NodeType; size?: number }) {
  const Icon = typeIcons[type];
  return <Icon size={size} />;
}
function NodePopup({ node }: { node: GraphNode }) {
  const { result, time, triggers, toggleTrigger, graph, loading } = useStore(
    useShallow((s) => ({
      result: s.result,
      time: s.time,
      triggers: s.triggers,
      toggleTrigger: s.toggleTrigger,
      graph: s.graph,
      loading: s.loading,
    })),
  );
  const affected = result?.nodes.find((n) => n.node_id === node.id),
    state = getStatus(affected, time),
    cause = graph.nodes.find((n) => n.id === affected?.caused_by?.source_id);
  const trace = useMemo(() => dependencyTrace(graph, node.id), [graph, node.id]);
  return (
    <div className="node-popup">
      <span className="eyebrow">
        {typeLabels[node.type]} · {titleCase(node.dept)}
      </span>
      <h3>{node.name}</h3>
      <b
        className={`${state.status === 'ok' ? 'ok' : state.status === 'down' ? 'down' : 'risk'}-text`}
      >
        {statusLabels[state.status]}
      </b>
      <p>
        {state.status === 'down'
          ? `Down since ${timeLabel(affected?.fails_at ?? 0)}`
          : state.minutes_left !== undefined
            ? `Fails in ${duration(Math.ceil(state.minutes_left))}`
            : state.status === 'at_risk'
              ? 'Backup holds through window.'
              : 'All monitored dependencies available.'}
      </p>
      {cause && state.status !== 'ok' && (
        <p>
          Caused by {cause.name} ({affected?.caused_by?.relation.replaceAll('_', ' ')})
        </p>
      )}
      <p>
        Depends on {trace.upstream.size} · Affects {trace.downstream.size}
      </p>
      <button disabled={loading} onClick={() => toggleTrigger(node.id)}>
        {triggers.includes(node.id) ? 'Remove trigger' : 'Fail this node'}
      </button>
    </div>
  );
}
export function NodeMarker({ node }: { node: GraphNode }) {
  const result = useStore((s) => s.result),
    focusedNode = useStore((s) => s.focusedNode),
    focusVersion = useStore((s) => s.focusVersion);
  const status = useStore(
    (s) =>
      getStatus(
        s.result?.nodes.find((n) => n.node_id === node.id),
        s.time,
      ).status,
  );
  const trigger = result?.scenario.trigger_node_ids.includes(node.id) ?? false,
    map = useMap(),
    ref = useRef<LeafletMarker>(null);
  const setTrace = useUI((s) => s.setTrace);
  useEffect(() => {
    if (focusedNode === node.id) {
      map.flyTo([node.lat, node.lng], 15, {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.8,
      });
      ref.current?.openPopup();
    }
  }, [focusVersion, focusedNode, map, node]);
  useEffect(() => {
    const el = ref.current?.getElement();
    if (!el) return;
    const focus = () => setTrace(node.id),
      blur = () => setTrace(null);
    el.addEventListener('focus', focus);
    el.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('focus', focus);
      el.removeEventListener('blur', blur);
    };
  }, [setTrace, node.id]);
  useEffect(() => {
    const el = ref.current?.getElement();
    if (el) {
      el.setAttribute('aria-label', `${node.name}: ${statusLabels[status]}`);
      el.setAttribute('title', `${node.name}: ${statusLabels[status]}`);
    }
  }, [status, node.name]);
  const icon = useMemo(() => {
    const size = 36 + node.criticality * 3;
    return divIcon({
      className: 'infra-node',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      html: renderToStaticMarkup(
        <div
          data-node={node.id}
          data-status={status}
          className={`node-symbol ${node.type} ${trigger ? 'trigger-node' : ''}`}
          style={{ width: size, height: size }}
        >
          <svg className="countdown-ring" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="27" pathLength="1" />
          </svg>
          <NodeIcon type={node.type} size={node.criticality > 3 ? 23 : 20} />
          <span className="node-status-mini">
            {status === 'down' ? '×' : status === 'at_risk' ? '!' : '✓'}
          </span>
          <span className="node-label">{node.name}</span>
        </div>,
      ),
    });
  }, [node, status, trigger]);
  return (
    <Marker
      title={`${node.name} — ${statusLabels[status]}`}
      alt={`${node.name}: ${statusLabels[status]}`}
      position={[node.lat, node.lng]}
      icon={icon}
      ref={ref}
      eventHandlers={{
        mouseover: () => setTrace(node.id),
        mouseout: () => setTrace(null),
        popupclose: () => setTrace(null),
      }}
    >
      <Popup>
        <NodePopup node={node} />
      </Popup>
    </Marker>
  );
}
