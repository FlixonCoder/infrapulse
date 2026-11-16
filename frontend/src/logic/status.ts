import type { AffectedNode } from '../api/types';
export type NodeStatus = { status: 'ok' | 'at_risk' | 'down'; minutes_left?: number };
export function getStatus(affected: AffectedNode | undefined, T: number): NodeStatus {
  if (!affected || T < affected.lost_input_at) return { status: 'ok' };
  if (affected.fails_at !== null && T >= affected.fails_at) return { status: 'down' };
  return affected.fails_at === null
    ? { status: 'at_risk' }
    : { status: 'at_risk', minutes_left: affected.fails_at - T };
}
export function isEdgeActive(
  source: AffectedNode | undefined,
  target: AffectedNode | undefined,
  T: number,
): boolean {
  return getStatus(source, T).status === 'down' && getStatus(target, T).status !== 'ok';
}
