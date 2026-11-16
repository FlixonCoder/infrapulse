import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { useDerived } from '../state/selectors';
import { clock } from '../logic/timeline';
import { deptColors, timeLabel } from '../logic/format';
export function TimelineBar() {
  const { result, time, setTime, playing, setPlaying, speed, setSpeed, graph, loading } = useStore(
    useShallow((s) => ({
      result: s.result,
      time: s.time,
      setTime: s.setTime,
      playing: s.playing,
      setPlaying: s.setPlaying,
      speed: s.speed,
      setSpeed: s.setSpeed,
      graph: s.graph,
      loading: s.loading,
    })),
  );
  const { series, events } = useDerived(),
    horizon = result?.scenario.horizon_minutes ?? 360,
    total = Math.max(1, graph.nodes.length);
  const [preview, setPreview] = useState<number | null>(null),
    svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!playing || !result) return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now(),
        s = useStore.getState();
      if (document.hidden) {
        last = now;
        return;
      }
      const next = s.time + ((now - last) / 1000) * (horizon / 25) * s.speed;
      last = now;
      s.setTime(next);
      if (next >= horizon) s.setPlaying(false);
    }, 100);
    return () => window.clearInterval(interval);
  }, [playing, result, horizon]);
  const area = (kind: 'down' | 'at_risk') => {
    if (!series.length) return '';
    let d = 'M 0 86';
    for (let i = 0; i < series.length; i++) {
      const p = series[i],
        y = 86 - ((kind === 'down' ? p.down : p.down + p.at_risk) / total) * 70;
      d += ` H ${(p.time / horizon) * 1000} V ${y}`;
    }
    return `${d} H 1000 V 86 Z`;
  };
  const scrub = (clientX: number) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    setPlaying(false);
    setTime(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * horizon));
  };
  const hospital = result?.summary.first_hospital_down_at;
  const hovered = preview === null ? null : [...series].reverse().find((p) => p.time <= preview);
  function play() {
    if (time >= horizon) setTime(0);
    setPlaying(!playing);
  }
  return (
    <section className="timeline panel" aria-label="Cascade timeline">
      <div className="transport">
        <span className="eyebrow">CASCADE TIMELINE</span>
        <div className="transport-buttons">
          <button
            aria-label="Step back five minutes"
            onClick={() => {
              setPlaying(false);
              setTime(time - 5);
            }}
            disabled={!result}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="play-button"
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
            disabled={!result || loading}
            onClick={play}
          >
            {playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
          <button
            aria-label="Step forward five minutes"
            onClick={() => {
              setPlaying(false);
              setTime(time + 5);
            }}
            disabled={!result}
          >
            <SkipForward size={17} />
          </button>
          <button
            aria-label="Restart timeline"
            disabled={!result}
            onClick={() => {
              setPlaying(false);
              setTime(0);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="speed-picker" aria-label="Playback speed">
          {[1, 4, 16].map((s) => (
            <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="chart-zone">
        <div className="chart-key">
          <span className="down-text">■ Down</span>
          <span className="risk-text">■ At risk</span>
          <span className="muted">
            {hovered
              ? `${timeLabel(preview!)} · ${hovered.down} down / ${hovered.at_risk} at risk`
              : 'Drag the playhead to explore'}
          </span>
        </div>
        {hospital != null && <span className="critical-label">CRITICAL WINDOW</span>}
        <svg
          ref={svg}
          className="timeline-chart"
          viewBox="0 0 1000 110"
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) scrub(e.clientX);
            const r = e.currentTarget.getBoundingClientRect();
            setPreview(
              Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * horizon),
            );
          }}
          onPointerLeave={() => setPreview(null)}
        >
          {[16, 51, 86].map((y) => (
            <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="#ffffff10" />
          ))}
          {hospital != null && (
            <>
              <rect
                x={(hospital / horizon) * 1000}
                y="0"
                width={1000 - (hospital / horizon) * 1000}
                height="86"
                fill="#f472b610"
              />
            </>
          )}
          <path d={area('at_risk')} fill="#f59e0b44" stroke="#f59e0b" strokeWidth="1.5" />
          <path d={area('down')} fill="#ef444455" stroke="#ef4444" strokeWidth="2" />
          {events.map((e) => (
            <circle
              key={e.id}
              cx={(e.time / horizon) * 1000}
              cy="98"
              r="3.5"
              fill={deptColors[e.dept]}
            >
              <title>
                {timeLabel(e.time)} {e.text}
              </title>
            </circle>
          ))}
          <line
            x1={(time / horizon) * 1000}
            x2={(time / horizon) * 1000}
            y1="0"
            y2="108"
            stroke="#61e1bb"
            strokeWidth="2"
          />
          <circle cx={(time / horizon) * 1000} cy="4" r="4" fill="#61e1bb" />
        </svg>
        <input
          className="timeline-slider"
          type="range"
          min={0}
          max={horizon}
          step={1}
          value={Math.floor(time)}
          disabled={!result || loading}
          aria-label="Simulation time in minutes"
          aria-valuetext={timeLabel(time)}
          onChange={(e) => {
            setPlaying(false);
            setTime(Number(e.target.value));
          }}
        />
        <div className="time-axis">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{clock(horizon * f)}</span>
          ))}
        </div>
      </div>
      <div className="timeline-clock">
        <span className="eyebrow">SIMULATION TIME</span>
        <strong>T+{clock(time)}</strong>
        <span>
          of {clock(horizon)} <i className={playing ? 'tiny-dot' : ''} />
          {playing ? 'PLAYING' : 'PAUSED'}
        </span>
      </div>
    </section>
  );
}
