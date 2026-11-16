import { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown, Clipboard, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { useDerived } from '../state/selectors';
import { departments, deptColors, duration, statusLabels, titleCase } from '../logic/format';
import { ActionCard } from './ActionCard';
import { SummaryStrip } from './SummaryStrip';
export function ActionBoard({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { result, time, filter, setFilter, loading, initializing, focus } = useStore(
    useShallow((s) => ({
      result: s.result,
      time: s.time,
      filter: s.filter,
      setFilter: s.setFilter,
      loading: s.loading,
      initializing: s.initializing,
      focus: s.focus,
    })),
  );
  const [briefing, setBriefing] = useState(false),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false),
    [sheet, setSheet] = useState('half');
  const dispatched = useUI((s) => s.dispatched),
    reset = useUI((s) => s.resetDispatch),
    { departments: impact, hospitals } = useDerived();
  useEffect(() => reset(), [result, reset]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (mobileOpen && useUI.getState().presenter) {
      const timer = window.setTimeout(
        () =>
          document.querySelector('.action-card')?.scrollIntoView({
            block: 'center',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'instant'
              : 'smooth',
          }),
        400,
      );
      return () => clearTimeout(timer);
    }
  }, [mobileOpen]);
  const actions = result?.actions.filter((a) => filter === 'all' || a.dept === filter) ?? [],
    done = result?.actions.filter((a) => dispatched.has(a.id)).length ?? 0,
    total = result?.actions.length ?? 0;
  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.briefing ?? '');
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  function download() {
    if (!result) return;
    const blob = new Blob(
      [
        `InfraPulse · Response briefing\n\n${result.briefing}\n\nDependencies and backup durations are assumed for demonstration.`,
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'infrapulse-briefing.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const lanes = [
    { name: 'Act now', test: (n: number) => n <= 0 },
    { name: 'Next 30 min', test: (n: number) => n > 0 && n <= 30 },
    { name: 'Later', test: (n: number) => n > 30 },
  ];
  return (
    <aside
      className={`response-panel panel ${mobileOpen ? 'mobile-open' : ''} sheet-${sheet}`}
      aria-label="Response center"
    >
      <div
        className="sheet-handle"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.dataset.start = String(e.clientY);
        }}
        onPointerUp={(e) => {
          const delta = e.clientY - Number(e.currentTarget.dataset.start);
          setSheet(delta < -30 ? 'full' : delta > 30 ? 'peek' : 'half');
        }}
      >
        <button
          onClick={() => setSheet(sheet === 'full' ? 'half' : 'full')}
          aria-label="Resize response sheet"
        >
          ━━
        </button>
      </div>
      <header className="board-header">
        <span className="eyebrow">RESPONSE CENTER</span>
        <button className="mobile-close" aria-label="Close response center" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="response-scroll">
        <SummaryStrip />
        <section className="department-impact">
          <div className="section-heading">DEPARTMENT STATUS</div>
          {impact.map((d) => {
            const total = d.down + d.at_risk + d.ok;
            return (
              <div className="department-row" key={d.dept}>
                <span style={{ color: deptColors[d.dept] }}>{titleCase(d.dept)}</span>
                <div
                  className="stacked-bar"
                  role="img"
                  aria-label={`${d.dept}: ${d.down} down, ${d.at_risk} at risk, ${d.ok} operational`}
                >
                  {(['down', 'at_risk', 'ok'] as const).map((status) => (
                    <i
                      key={status}
                      className={status}
                      style={{ width: `${total ? (d[status] / total) * 100 : 0}%` }}
                    />
                  ))}
                </div>
                <b>
                  {d.down}/{total}
                </b>
              </div>
            );
          })}
        </section>
        <section className="hospital-watch">
          <div className="section-heading">
            HOSPITAL WATCH <span className="risk-text">+ Priority assets</span>
          </div>
          {hospitals.map((h) => (
            <button
              className={`hospital-row ${h.status}`}
              key={h.node.id}
              onClick={() => {
                focus(h.node.id);
                onClose();
              }}
            >
              <span className="hospital-cross">+</span>
              <span>
                <b>{h.node.name}</b>
                <small>
                  {statusLabels[h.status]} ·{' '}
                  {h.status === 'ok'
                    ? 'Dependencies available'
                    : h.status === 'down'
                      ? 'Service impacted'
                      : h.minutes_left !== undefined
                        ? `${duration(Math.ceil(h.minutes_left))} backup left`
                        : 'Backup holds through window'}
                </small>
              </span>
            </button>
          ))}
        </section>
        <div className="board-title">
          <div>
            <h2>
              Response actions <span>{total}</span>
            </h2>
            <p>Prioritized by urgency and criticality.</p>
          </div>
          <button aria-label="Download briefing" onClick={download} disabled={!result}>
            <ArrowDownToLine size={17} />
          </button>
        </div>
        <div className="readiness" title="Local checklist, does not change the simulation">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" />
            <circle
              cx="20"
              cy="20"
              r="16"
              pathLength="100"
              strokeDasharray={`${total ? (done / total) * 100 : 0} 100`}
            />
          </svg>
          <div>
            <b>
              {done}/{total} dispatched
            </b>
            <small>Local checklist · simulation unchanged</small>
          </div>
        </div>
        <div className="board-filters" aria-label="Filter actions by department">
          {(['all', ...departments] as const).map((dept) => (
            <button key={dept} aria-pressed={filter === dept} onClick={() => setFilter(dept)}>
              {titleCase(dept)}
            </button>
          ))}
        </div>
        {loading || initializing ? (
          <div className="skeletons" aria-label="Loading simulation">
            {[0, 1, 2].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        ) : !result ? (
          <div className="board-empty">Choose a scenario to start your response.</div>
        ) : !actions.length ? (
          <div className="board-empty">No actions for this department.</div>
        ) : (
          lanes.map((lane) => {
            const list = actions.filter((a) => lane.test(a.act_by_minute - time));
            return list.length ? (
              <section className="action-lane" key={lane.name}>
                <h3>
                  {lane.name} <span>{list.length}</span>
                </h3>
                {list.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    index={result.actions.indexOf(a)}
                    onLocate={onClose}
                  />
                ))}
              </section>
            ) : null;
          })
        )}
        <div className="briefing">
          <button
            className="briefing-toggle"
            aria-expanded={briefing}
            onClick={() => setBriefing(!briefing)}
          >
            <span>
              <Clipboard size={15} /> Situation briefing
            </span>
            <ChevronDown size={16} />
          </button>
          {briefing && (
            <div className="briefing-content">
              <p>{result?.briefing ?? 'Run a simulation to generate a briefing.'}</p>
              <button disabled={!result} onClick={() => void copy()}>
                {copied ? <Check size={14} /> : <Clipboard size={14} />}{' '}
                {copied ? 'Copied' : 'Copy briefing'}
              </button>
              {copyError && <p role="status">Copy unavailable. Download the briefing instead.</p>}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
