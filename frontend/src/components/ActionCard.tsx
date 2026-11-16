import { ArrowUpRight, Clock3 } from 'lucide-react';
import type { Action } from '../api/types';
import { deptColors, duration, titleCase } from '../logic/format';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
export function ActionCard({
  action,
  index,
  onLocate,
}: {
  action: Action;
  index: number;
  onLocate: () => void;
}) {
  const time = useStore((s) => s.time),
    focus = useStore((s) => s.focus),
    checked = useUI((s) => s.dispatched.has(action.id)),
    toggle = useUI((s) => s.toggleDispatch),
    left = action.act_by_minute - time;
  const progress =
    action.act_by_minute === 0 ? 100 : Math.min(100, (time / action.act_by_minute) * 100);
  return (
    <article className={`action-card ${left <= 0 ? 'due' : ''} ${checked ? 'dispatched' : ''}`}>
      <div className="action-card-top">
        <span className="dept-chip" style={{ color: deptColors[action.dept] }}>
          {titleCase(action.dept)}
        </span>
        <span className={`severity ${action.severity}`}>{action.severity}</span>
        <span className="action-number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <h3>{action.title}</h3>
      <p>{action.detail}</p>
      <div className="deadline-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className={`action-deadline ${left <= 0 ? 'down-text' : 'risk-text'}`}>
        <Clock3 size={13} />
        <b>{left <= 0 ? 'ACT NOW' : `Act within ${duration(Math.ceil(left))}`}</b>
      </div>
      <div className="action-card-bottom">
        <label title="Local checklist, does not change the simulation">
          <input type="checkbox" checked={checked} onChange={() => toggle(action.id)} /> Dispatched
        </label>
        <button
          onClick={() => {
            focus(action.node_id);
            onLocate();
          }}
        >
          Locate asset <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
