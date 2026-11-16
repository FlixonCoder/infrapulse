import { create } from 'zustand';
export type Layers = {
  arcs: boolean;
  particles: boolean;
  ripples: boolean;
  lights: boolean;
  follow: boolean;
  labels: boolean;
};
export const useUI = create<{
  layers: Layers;
  trace: string | null;
  dispatched: Set<string>;
  presenter: boolean;
  toggleLayer: (key: keyof Layers) => void;
  setTrace: (id: string | null) => void;
  toggleDispatch: (id: string) => void;
  resetDispatch: () => void;
  setPresenter: (value: boolean) => void;
}>((set) => ({
  layers: {
    arcs: true,
    particles: true,
    ripples: true,
    lights: true,
    follow: false,
    labels: false,
  },
  trace: null,
  dispatched: new Set(),
  presenter: false,
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setTrace: (trace) => set({ trace }),
  toggleDispatch: (id) =>
    set((s) => {
      const dispatched = new Set(s.dispatched);
      if (dispatched.has(id)) dispatched.delete(id);
      else dispatched.add(id);
      return { dispatched };
    }),
  resetDispatch: () => set({ dispatched: new Set() }),
  setPresenter: (presenter) => set({ presenter }),
}));
