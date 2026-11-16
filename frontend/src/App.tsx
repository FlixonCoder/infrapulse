import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CircleHelp,
  LoaderCircle,
  PanelRight,
  Play,
  Presentation,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useDialog } from './logic/useDialog';
import { useStore } from './state/store';
import { useUI } from './state/ui';
import { buildTour } from './logic/tour';
import { MapView } from './components/MapView';
import { ScenarioPicker } from './components/ScenarioPicker';
import { TriggerChips } from './components/TriggerChips';
import { Legend } from './components/Legend';
import { Layers } from './components/Layers';
import { EventFeed } from './components/EventFeed';
import { ActionBoard } from './components/ActionBoard';
import { TimelineBar } from './components/TimelineBar';
import { Toast } from './components/Toast';
export default function App() {
  const { initialize, run, loading, initializing, triggers, mock, result } = useStore(
    useShallow((s) => ({
      initialize: s.initialize,
      run: s.run,
      loading: s.loading,
      initializing: s.initializing,
      triggers: s.triggers,
      mock: s.mock,
      result: s.result,
    })),
  );
  const [mobileOpen, setMobileOpen] = useState(false),
    [help, setHelp] = useState(false),
    [intro, setIntro] = useState(true),
    [introReady, setIntroReady] = useState(false),
    [caption, setCaption] = useState('');
  const presenter = useUI((s) => s.presenter),
    setPresenter = useUI((s) => s.setPresenter),
    toggleLayer = useUI((s) => s.toggleLayer);
  useDialog(intro, '.intro-overlay');
  useDialog(help, '.help-popover');
  const started = useRef(false),
    restore = useRef<{ time: number; speed: number } | null>(null);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void initialize();
    }
  }, [initialize]);
  useEffect(() => {
    const id = window.setTimeout(() => setIntroReady(true), 4000);
    return () => clearTimeout(id);
  }, []);
  const exitTour = useCallback(() => {
    setPresenter(false);
    setCaption('');
    useStore.getState().setPlaying(false);
    if (restore.current) {
      useStore.getState().setSpeed(restore.current.speed);
      useStore.getState().setTime(restore.current.time);
      restore.current = null;
    }
  }, [setPresenter]);
  const startTour = useCallback(() => {
    const state = useStore.getState();
    if (!state.result || state.loading) return;
    restore.current = { time: state.time, speed: state.speed };
    setIntro(false);
    setPresenter(true);
  }, [setPresenter]);
  useEffect(() => {
    if (!presenter) return;
    const state = useStore.getState(),
      steps = buildTour(state.result, state.graph);
    if (!steps.length) return;
    state.setPlaying(false);
    let frame = 0,
      stepIndex = -1,
      lastTick = 0;
    const start = performance.now(),
      duration = 11000,
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      if (now - lastTick < 100) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastTick = now;
      const elapsed = now - start,
        index = Math.min(steps.length - 1, Math.floor(elapsed / duration)),
        step = steps[index];
      if (elapsed >= steps.length * duration) {
        setPresenter(false);
        setCaption('');
        setMobileOpen(true);
        if (restore.current) {
          useStore.getState().setSpeed(restore.current.speed);
          restore.current = null;
        }
        return;
      }
      if (index !== stepIndex) {
        stepIndex = index;
        setCaption(step.caption);
        setMobileOpen(step.response);
        if (step.nodeId) useStore.getState().focus(step.nodeId);
      }
      const from = index === 0 ? 0 : steps[index - 1].time,
        progress = Math.min(1, (elapsed % duration) / (duration * 0.65));
      // The hospital chapter pauses on impact; other chapters interpolate across the returned times.
      useStore
        .getState()
        .setTime(
          reduced || index === 0 || index >= 4 ? step.time : from + (step.time - from) * progress,
        );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [presenter, result, setPresenter]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIntro(false);
        setHelp(false);
        setMobileOpen(false);
        exitTour();
        return;
      }
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.matches('input,select,textarea,button,a') || el.isContentEditable)
      )
        return;
      const s = useStore.getState();
      if (e.key === '?') {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (useUI.getState().presenter) exitTour();
        else startTour();
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleLayer('follow');
        return;
      }
      if (!s.result || s.loading || useUI.getState().presenter) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (s.time >= s.result.scenario.horizon_minutes) s.setTime(0);
        s.setPlaying(!s.playing);
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        s.setPlaying(false);
        s.setTime(s.time + (e.code === 'ArrowRight' ? 5 : -5));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [exitTour, startTour, toggleLayer]);
  function start() {
    setIntro(false);
    if (useStore.getState().result) {
      useStore.getState().setTime(0);
      useStore.getState().setSpeed(1);
      useStore.getState().setPlaying(true);
    }
  }
  return (
    <main className={`app-shell ${presenter ? 'presenter' : ''}`}>
      <header className="topbar">
        <a href="/" className="brand" aria-label="InfraPulse home">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            infra<span className="brand-light">pulse</span>
            <small>CITY RESILIENCE, CONNECTED</small>
          </span>
        </a>
        <div className="header-actions">
          <ScenarioPicker />
          <button
            className="run-button"
            aria-label="Run simulation"
            disabled={loading || initializing || !triggers.length || presenter}
            onClick={() => void run()}
          >
            {loading ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            <span>{loading ? 'Simulating…' : 'Run simulation'}</span>
          </button>
          <button
            aria-label={presenter ? 'Exit demo' : 'Auto-demo'}
            className="presenter-button"
            disabled={!result || loading}
            onClick={() => (presenter ? exitTour() : startTour())}
            aria-pressed={presenter}
          >
            <Presentation size={17} />
            <span>{presenter ? 'Exit demo' : 'Auto-demo'}</span>
          </button>
          <span className={`mode-badge ${mock ? '' : 'live'}`}>
            <i />
            {mock ? 'MOCK' : 'LIVE'}
          </span>
          <button
            className="help-button"
            aria-label="Keyboard shortcuts and help"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="left-rail">
          <div className="rail-header">
            <span className="eyebrow">OPERATIONS WORKSPACE</span>
            <h1>
              See the chain.
              <br />
              <span>Find the window.</span>
            </h1>
          </div>
          <TriggerChips />
          <Layers />
          <Legend />
          <div className="rail-note">
            <span className="tiny-dot" /> {mock ? 'Recorded demo network' : 'Live simulation API'}
            <p>
              {mock
                ? 'Choose a preset to explore a recorded cascade.'
                : 'Choose any asset to explore a cascade.'}
            </p>
          </div>
        </aside>
        <section className="map-workspace" aria-label="Infrastructure network map">
          <MapView />
          <EventFeed />
          {presenter && caption && (
            <div className="tour-caption" role="status">
              <span className="eyebrow">INFRAPULSE / PRESENTER MODE</span>
              <p>{caption}</p>
              <button onClick={exitTour}>
                Exit demo <kbd>Esc</kbd>
              </button>
            </div>
          )}
          <button className="mobile-board-toggle" onClick={() => setMobileOpen(true)}>
            <PanelRight size={17} /> Response center
          </button>
        </section>
        <ActionBoard mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>
      <TimelineBar />
      <footer className="app-footer">
        <span>Dependencies and backup durations are assumed for demonstration.</span>
        <span>ONE FAILURE. A WINDOW TO ACT.</span>
      </footer>
      <Toast />
      {intro && (
        <div
          className={`intro-overlay ${introReady ? 'intro-ready' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="intro-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIntro(false);
          }}
        >
          <button className="intro-skip" onClick={() => setIntro(false)}>
            Skip intro <kbd>Esc</kbd>
          </button>
          <div className="intro-content">
            <div className="intro-network" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="eyebrow">INFRAPULSE / CITY RESILIENCE</span>
            <h1 id="intro-title">
              When the power goes off,
              <br />
              <em>what else stops?</em>
            </h1>
            <p>InfraPulse shows the chain before it breaks.</p>
            <button
              className="run-button"
              autoFocus
              disabled={initializing || loading || !result}
              onClick={start}
            >
              {initializing || loading ? 'Preparing the network…' : 'Explore the cascade'}{' '}
              <Play size={17} />
            </button>
            <small>One failure. A chain reaction. A window to act.</small>
            {!initializing && !loading && !result && (
              <button onClick={() => setIntro(false)}>Continue to connection recovery</button>
            )}
          </div>
        </div>
      )}
      {help && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelp(false);
          }}
        >
          <section
            className="help-popover panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              autoFocus
              aria-label="Close help"
              className="modal-close"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">QUICK REFERENCE</span>
            <h2 id="help-title">Explore the cascade</h2>
            <p>
              Choose a scenario, run the simulation, then scrub time to find the critical window.
              Select an asset or action to investigate its dependencies.
            </p>
            <dl>
              {[
                ['Space', 'Play / pause'],
                ['← / →', 'Step five minutes'],
                ['P', 'Start / exit presenter mode'],
                ['F', 'Toggle follow cascade'],
                ['?', 'Open shortcuts'],
                ['Esc', 'Close overlays / exit demo'],
              ].map(([key, text]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Dispatch checkboxes are a local checklist and do not change the simulation.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
