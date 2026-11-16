import type { Dept, NodeType } from '../api/types';
export const departments: Dept[] = ['electricity', 'water', 'telecom', 'traffic', 'health'];
export const deptColors: Record<Dept, string> = {
  electricity: '#facc15',
  water: '#38bdf8',
  telecom: '#a78bfa',
  traffic: '#fb923c',
  health: '#f472b6',
};
export const typeLabels: Record<NodeType, string> = {
  substation: 'Substation',
  water_pump: 'Water pump',
  cell_tower: 'Cell tower',
  signal_cluster: 'Signal cluster',
  hospital: 'Hospital',
};
export const statusLabels = { ok: 'Operational', at_risk: 'At risk', down: 'Down' };
export const statusColors = { ok: '#22c55e', at_risk: '#f59e0b', down: '#ef4444' };
export function duration(m: number): string {
  const n = Math.max(0, Math.floor(m));
  return n < 60 ? `${n}m` : `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}`;
}
export const timeLabel = (m: number) => `T+${duration(m)}`;
export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
