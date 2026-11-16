import { Hospital } from 'lucide-react';
import { useStore } from '../state/store';
import { useDerived } from '../state/selectors';
import { timeLabel } from '../logic/format';
export function SummaryStrip() {
  const result = useStore((s) => s.result),
    { counts } = useDerived();
  return (
    <section className="summary-section">
      <div className="section-heading">
        <span>IMPACT AT THIS MOMENT</span>
        <span className="live-dot">● LIVE TIME</span>
      </div>
      <div className="summary-counts">
        <div>
          <span>× Down now</span>
          <strong className="down-text">{counts.down}</strong>
          <small>Window total {result?.summary.nodes_down ?? '—'}</small>
        </div>
        <div>
          <span>▲ At risk now</span>
          <strong className="risk-text">{counts.at_risk}</strong>
          <small>At end {result?.summary.nodes_at_risk ?? '—'}</small>
        </div>
        <div>
          <span>✓ Operational</span>
          <strong>{counts.ok}</strong>
          <small>At current time</small>
        </div>
      </div>
      <div className="hospital-impact">
        <Hospital size={16} />
        <span>
          {result?.summary.first_hospital_down_at != null ? (
            <>
              First hospital impact <b>{timeLabel(result.summary.first_hospital_down_at)}</b>
            </>
          ) : result ? (
            'No hospital down in window'
          ) : (
            'Awaiting simulation'
          )}
        </span>
      </div>
    </section>
  );
}
