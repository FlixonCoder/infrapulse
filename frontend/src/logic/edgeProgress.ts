import type { AffectedNode } from '../api/types';
export function edgeProgress(source: AffectedNode | undefined, time: number, buffer: number) {
  if (source?.fails_at == null || time < source.fails_at) return 0;
  return buffer === 0 ? 1 : Math.max(0, Math.min(1, (time - source.fails_at) / buffer));
}
