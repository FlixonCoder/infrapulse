import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../state/store';
export function Toast() {
  const { error, dismissError, demo } = useStore(
    useShallow((s) => ({ error: s.error, dismissError: s.dismissError, demo: s.demo })),
  );
  if (!error) return null;
  return (
    <div className="error-toast" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>Unable to complete request</strong>
        <p>{error}</p>
        <button onClick={() => void demo()}>Use demo data</button>
      </div>
      <button className="toast-close" aria-label="Dismiss error" onClick={dismissError}>
        <X size={16} />
      </button>
    </div>
  );
}
