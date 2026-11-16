import { describe, expect, it } from 'vitest';
import { getStatus, isEdgeActive } from './status';
import type { AffectedNode } from '../api/types';
const n: AffectedNode = {
  node_id: 'n',
  lost_input_at: 10,
  fails_at: 25,
  caused_by: { source_id: 's', relation: 'powers' },
  depth: 1,
};
describe('status at timeline boundaries', () => {
  it('unaffected nodes stay healthy', () =>
    expect(getStatus(undefined, 100)).toEqual({ status: 'ok' }));
  it('before input loss', () => expect(getStatus(n, 9)).toEqual({ status: 'ok' }));
  it('at loss has correct countdown', () =>
    expect(getStatus(n, 10)).toEqual({ status: 'at_risk', minutes_left: 15 }));
  it('before failure stays at risk', () =>
    expect(getStatus(n, 24)).toEqual({ status: 'at_risk', minutes_left: 1 }));
  it('exactly at failure is down', () => expect(getStatus(n, 25)).toEqual({ status: 'down' }));
  it('trigger at zero is down', () =>
    expect(
      getStatus({ ...n, lost_input_at: 0, fails_at: 0, depth: 0, caused_by: null }, 0),
    ).toEqual({ status: 'down' }));
  it('null failure survives the horizon', () =>
    expect(getStatus({ ...n, fails_at: null }, 360)).toEqual({ status: 'at_risk' }));
  it('edges need a down source and affected target', () => {
    expect(isEdgeActive({ ...n, fails_at: 10 }, n, 10)).toBe(true);
    expect(isEdgeActive(n, n, 10)).toBe(false);
    expect(isEdgeActive({ ...n, fails_at: 10 }, undefined, 10)).toBe(false);
  });
});
