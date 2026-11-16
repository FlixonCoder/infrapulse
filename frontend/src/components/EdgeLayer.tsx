import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { AffectedNode, GraphEdge } from '../api/types';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { edgeProgress } from '../logic/edgeProgress';
import { dependencyTrace } from '../logic/trace';
import { getStatus } from '../logic/status';
const colors = {
  powers: '#facc15',
  supplies_water: '#38bdf8',
  telecom_link: '#a78bfa',
  road_access: '#fb923c',
};
type Arc = {
  edge: GraphEdge;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  down: boolean;
  visible: boolean;
  phase: number;
};
export function EdgeLayer() {
  const map = useMap(),
    graph = useStore((s) => s.graph);
  useEffect(() => {
    const canvas = document.createElement('canvas'),
      back = document.createElement('canvas');
    canvas.className = 'cascade-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const container = map.getContainer();
    container.append(canvas);
    const context = canvas.getContext('2d'),
      background = back.getContext('2d');
    if (!context || !background) {
      canvas.remove();
      return;
    }
    const ctx: CanvasRenderingContext2D = context,
      base: CanvasRenderingContext2D = background;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      w = 0,
      h = 0,
      dirty = true,
      previousTime = -1,
      previousResult: ReturnType<typeof useStore.getState>['result'] = null;
    let affected = new Map<string, AffectedNode>(),
      projected = new Map<string, { x: number; y: number }>(),
      arcs: Arc[] = [];
    const ripples: { id: string; born: number; large: boolean }[] = [];
    const inTrace = new Set<string>(),
      markerElements = new Map<string, HTMLElement>();
    function project() {
      const size = map.getSize(),
        dpr = window.devicePixelRatio || 1;
      w = size.x;
      h = size.y;
      for (const layer of [canvas, back]) {
        layer.width = w * dpr;
        layer.height = h * dpr;
        layer.style.width = `${w}px`;
        layer.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base.setTransform(dpr, 0, 0, dpr, 0, 0);
      projected = new Map(
        graph.nodes.map((n) => [n.id, map.latLngToContainerPoint([n.lat, n.lng])]),
      );
      arcs = [];
      graph.edges.forEach((edge, i) => {
        const a = projected.get(edge.source),
          b = projected.get(edge.target);
        if (!a || !b) return;
        const sign = [...edge.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2 ? 1 : -1;
        arcs.push({
          edge,
          ax: a.x,
          ay: a.y,
          bx: b.x,
          by: b.y,
          cx: (a.x + b.x) / 2 - (b.y - a.y) * 0.18 * sign,
          cy: (a.y + b.y) / 2 + (b.x - a.x) * 0.18 * sign,
          down: false,
          visible: true,
          phase: i * 0.17,
        });
      });
      dirty = true;
      wake();
    }
    function renderStatic() {
      const state = useStore.getState(),
        ui = useUI.getState(),
        T = state.time;
      const trace = dependencyTrace(graph, ui.trace);
      inTrace.clear();
      if (ui.trace) {
        inTrace.add(ui.trace);
        for (const id of trace.upstream) inTrace.add(id);
        for (const id of trace.downstream) inTrace.add(id);
      }
      base.clearRect(0, 0, w, h);
      if (ui.layers.lights) {
        let down = 0;
        for (const n of graph.nodes) if (getStatus(affected.get(n.id), T).status === 'down') down++;
        base.fillStyle = `rgba(2,5,10,${graph.nodes.length ? (down / graph.nodes.length) * 0.45 : 0})`;
        base.fillRect(0, 0, w, h);
        for (const n of graph.nodes) {
          if (getStatus(affected.get(n.id), T).status !== 'down') continue;
          const p = projected.get(n.id);
          if (!p) continue;
          const radius = 25 + n.criticality * 9,
            glow = base.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          glow.addColorStop(0, '#ef444433');
          glow.addColorStop(1, '#ef444400');
          base.fillStyle = glow;
          base.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
        }
      }
      for (const a of arcs) {
        const e = a.edge,
          source = affected.get(e.source),
          progress = edgeProgress(source, T, e.buffer_minutes);
        a.down = source?.fails_at != null && T >= source.fails_at;
        a.visible = !ui.trace || (inTrace.has(e.source) && inTrace.has(e.target));
        if (!ui.layers.arcs) continue;
        base.globalAlpha = a.visible ? 0.35 : 0.08;
        base.beginPath();
        base.moveTo(a.ax, a.ay);
        base.quadraticCurveTo(a.cx, a.cy, a.bx, a.by);
        base.strokeStyle = colors[e.relation];
        base.lineWidth = 1.5;
        base.stroke();
        base.globalAlpha = a.visible ? 1 : 0.2;
        if (a.down) {
          const x =
              a.ax + 2 * progress * (a.cx - a.ax) + progress * progress * (a.ax - 2 * a.cx + a.bx),
            y =
              a.ay + 2 * progress * (a.cy - a.ay) + progress * progress * (a.ay - 2 * a.cy + a.by);
          const gradient = base.createLinearGradient(a.ax, a.ay, a.bx, a.by);
          gradient.addColorStop(0, '#f59e0b');
          gradient.addColorStop(1, '#ef4444');
          base.beginPath();
          base.moveTo(a.ax, a.ay);
          base.quadraticCurveTo(
            a.ax + (a.cx - a.ax) * progress,
            a.ay + (a.cy - a.ay) * progress,
            x,
            y,
          );
          base.strokeStyle = progress >= 1 ? '#ef4444' : gradient;
          base.lineWidth = 3;
          base.stroke();
        }
        const t = 0.82,
          x = (1 - t) * (1 - t) * a.ax + 2 * (1 - t) * t * a.cx + t * t * a.bx,
          y = (1 - t) * (1 - t) * a.ay + 2 * (1 - t) * t * a.cy + t * t * a.by,
          angle = Math.atan2(
            (1 - t) * (a.cy - a.ay) + t * (a.by - a.cy),
            (1 - t) * (a.cx - a.ax) + t * (a.bx - a.cx),
          );
        base.save();
        base.translate(x, y);
        base.rotate(angle);
        base.beginPath();
        base.moveTo(-5, -3);
        base.lineTo(0, 0);
        base.lineTo(-5, 3);
        base.strokeStyle = a.down ? '#ef4444' : colors[e.relation];
        base.lineWidth = 1.5;
        base.stroke();
        base.restore();
      }
      base.globalAlpha = 1;
      for (const n of graph.nodes) {
        let el = markerElements.get(n.id);
        if (!el?.isConnected) {
          el = container.querySelector<HTMLElement>(`[data-node="${n.id}"]`) ?? undefined;
          if (el) markerElements.set(n.id, el);
        }
        if (!el) continue;
        const a = affected.get(n.id),
          progress =
            a?.fails_at != null && a.fails_at > a.lost_input_at
              ? Math.max(0, Math.min(1, (T - a.lost_input_at) / (a.fails_at - a.lost_input_at)))
              : 0;
        el.style.setProperty('--countdown', String(1 - progress));
        el.style.opacity = !ui.trace || inTrace.has(n.id) ? '1' : '.25';
        el.classList.toggle('show-label', ui.layers.labels);
      }
    }
    function draw(now: number) {
      frame = 0;
      if (document.hidden) return;
      const state = useStore.getState(),
        ui = useUI.getState(),
        T = state.time,
        result = state.result;
      if (result !== previousResult) {
        affected = new Map(result?.nodes.map((n) => [n.node_id, n]));
        if (ui.layers.ripples && !reduced.matches) {
          ripples.length = 0;
          for (const id of result?.scenario.trigger_node_ids ?? [])
            ripples.push({ id, born: now, large: true });
        }
        dirty = true;
      } else if (T !== previousTime) {
        if (
          ui.layers.ripples &&
          !reduced.matches &&
          state.playing &&
          T > previousTime &&
          T - previousTime <= 30
        )
          for (const n of result?.nodes ?? [])
            if (n.fails_at !== null && n.fails_at > previousTime && n.fails_at <= T)
              ripples.push({ id: n.node_id, born: now, large: false });
        dirty = true;
      }
      previousTime = T;
      previousResult = result;
      if (!ui.layers.ripples || reduced.matches) ripples.length = 0;
      while (ripples.length > 8) ripples.shift();
      for (let i = ripples.length - 1; i >= 0; i--)
        if (now - ripples[i].born >= 1000) ripples.splice(i, 1);
      if (dirty) {
        renderStatic();
        dirty = false;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(back, 0, 0, w, h);
      // Animation hot path reuses projected geometry and buffers; no graph searches or DOM queries.
      if (ui.layers.arcs && ui.layers.particles && !reduced.matches)
        for (const a of arcs) {
          const t = (now / (a.down ? 1600 : 6000) + a.phase) % 1,
            x = (1 - t) * (1 - t) * a.ax + 2 * (1 - t) * t * a.cx + t * t * a.bx,
            y = (1 - t) * (1 - t) * a.ay + 2 * (1 - t) * t * a.cy + t * t * a.by;
          ctx.globalAlpha = a.visible ? 1 : 0.2;
          ctx.beginPath();
          ctx.arc(x, y, a.down ? 2.8 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = a.down ? '#ffb4a2' : colors[a.edge.relation];
          ctx.fill();
        }
      ctx.globalAlpha = 1;
      for (const r of ripples) {
        const p = projected.get(r.id);
        if (!p) continue;
        const age = (now - r.born) / 1000;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20 + age * (r.large ? 100 : 65), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${1 - age})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if ((ui.layers.arcs && ui.layers.particles && !reduced.matches) || ripples.length)
        frame = requestAnimationFrame(draw);
    }
    function wake() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }
    const unsub = useStore.subscribe(wake),
      unsubUI = useUI.subscribe(() => {
        dirty = true;
        wake();
      });
    const visibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
          frame = 0;
        } else wake();
      },
      motion = () => {
        dirty = true;
        wake();
      };
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', motion);
    map.on('move zoom resize', project);
    project();
    return () => {
      cancelAnimationFrame(frame);
      unsub();
      unsubUI();
      map.off('move zoom resize', project);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', motion);
      canvas.remove();
    };
  }, [map, graph]);
  return null;
}
