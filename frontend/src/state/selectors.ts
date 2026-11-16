import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import { countStatuses } from '../logic/counts';
import { buildEvents } from '../logic/events';
import { buildTimeline } from '../logic/timeline';
import { departments } from '../logic/format';
import { getStatus } from '../logic/status';
export function useDerived() {
  const { graph, result, time } = useStore(
    useShallow((s) => ({ graph: s.graph, result: s.result, time: s.time })),
  );
  const events = useMemo(() => buildEvents(result, graph), [result, graph]);
  const series = useMemo(() => buildTimeline(result, graph), [result, graph]);
  const live = useMemo(
    () => ({
      counts: countStatuses(graph, result, time),
      departments: departments.map((dept) => ({
        dept,
        ...countStatuses(graph, result, time, dept),
      })),
      hospitals: graph.nodes
        .filter((n) => n.type === 'hospital')
        .map((node) => ({
          node,
          ...getStatus(
            result?.nodes.find((n) => n.node_id === node.id),
            time,
          ),
        })),
    }),
    [graph, result, time],
  );
  return { ...live, events, series };
}
