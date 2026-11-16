import { useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { Plus, Minus, LocateFixed } from 'lucide-react';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { NodeMarker } from './NodeMarker';
import { EdgeLayer } from './EdgeLayer';
function MapControls() {
  const map = useMap(),
    nodes = useStore((s) => s.graph.nodes),
    result = useStore((s) => s.result);
  const fit = useCallback(() => {
    if (!nodes.length) return;
    map.invalidateSize();
    const padding =
      parseFloat(getComputedStyle(map.getContainer()).getPropertyValue('--map-padding')) || 40;
    map.fitBounds(latLngBounds(nodes.map((n) => [n.lat, n.lng])), {
      padding: [padding, padding],
      maxZoom: 14,
      animate: false,
    });
  }, [map, nodes]);
  useEffect(() => {
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [fit, map]);
  useEffect(() => {
    map.closePopup();
    const trigger = nodes.find((n) => n.id === result?.scenario.trigger_node_ids[0]);
    if (!trigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    map.flyTo([trigger.lat, trigger.lng], 14, { duration: 0.6 });
    const timer = window.setTimeout(fit, 1300);
    return () => {
      clearTimeout(timer);
      map.stop();
    };
  }, [map, result, nodes, fit]);
  useEffect(() => {
    let latest = '';
    return useStore.subscribe((s) => {
      if (!s.playing || !useUI.getState().layers.follow) return;
      const node = s.result?.nodes
        .filter((n) => n.fails_at !== null && n.fails_at <= s.time)
        .sort((a, b) => b.fails_at! - a.fails_at!)[0];
      if (!node || node.node_id === latest) return;
      latest = node.node_id;
      const point = nodes.find((n) => n.id === latest);
      if (!point) return;
      const p = map.latLngToContainerPoint([point.lat, point.lng]),
        size = map.getSize();
      if (p.x < size.x * 0.2 || p.x > size.x * 0.8 || p.y < size.y * 0.2 || p.y > size.y * 0.8)
        map.panTo([point.lat, point.lng], {
          animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          duration: 0.5,
        });
    });
  }, [map, nodes]);
  return (
    <div className="map-controls">
      <button aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <Plus size={17} />
      </button>
      <button aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <Minus size={17} />
      </button>
      <button aria-label="Fit all infrastructure" onClick={fit}>
        <LocateFixed size={17} />
      </button>
    </div>
  );
}
const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
export function MapView() {
  const nodes = useStore((s) => s.graph.nodes);
  return (
    <div className="map-surface">
      <MapContainer center={[12.95, 77.709]} zoom={14} zoomControl={false} attributionControl>
        <TileLayer
          className={cartoKey ? 'carto-tiles' : 'osm-fallback'}
          url={
            cartoKey
              ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          attribution={
            cartoKey
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          }
        />
        <EdgeLayer />
        {nodes.map((node) => (
          <NodeMarker key={node.id} node={node} />
        ))}
        <MapControls />
      </MapContainer>
      <div className="map-vignette" />
      <div className="map-heading">
        <span className="eyebrow">
          BENGALURU / EAST CORRIDOR{' '}
          <span className="mobile-mode">{useStore((s) => s.mock) ? 'MOCK' : 'LIVE'}</span>
        </span>
        <h2>The connected city.</h2>
        <p>
          {nodes.length} monitored assets · {useStore((s) => s.graph.edges.length)} dependencies
        </p>
      </div>
      {!cartoKey && <span className="basemap-note">OpenStreetMap · fallback basemap</span>}
    </div>
  );
}
