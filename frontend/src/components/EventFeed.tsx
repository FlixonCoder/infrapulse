import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { useDerived } from '../state/selectors';
import { timeLabel, deptColors } from '../logic/format';
export function EventFeed() {
  const time = useStore((s) => s.time),
    focus = useStore((s) => s.focus),
    { events } = useDerived();
  const visible = events
    .filter((e) => e.time <= time)
    .slice(-2)
    .reverse();
  const [announcement, setAnnouncement] = useState('');
  const latest = visible[0]?.text ?? '';
  useEffect(() => {
    const id = window.setTimeout(() => setAnnouncement(latest), 1200);
    return () => clearTimeout(id);
  }, [latest]);
  return (
    <section className="event-feed panel" aria-label="Cascade event log">
      <div className="section-heading">
        <span>LIVE EVENT LOG</span>
        <span className="tiny-dot" />
      </div>
      {visible.length ? (
        visible.map((e, i) => (
          <button key={e.id} className={i === 0 ? 'latest' : ''} onClick={() => focus(e.nodeId)}>
            <time style={{ color: deptColors[e.dept] }}>{timeLabel(e.time)}</time>
            <span>{e.text}</span>
          </button>
        ))
      ) : (
        <p className="muted">Run a scenario to trace the chain.</p>
      )}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
