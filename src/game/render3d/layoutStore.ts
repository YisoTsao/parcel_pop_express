import { create } from 'zustand';

/** Screen-space anchors of each board row (CSS px within the canvas), for DOM arrow buttons. */
export interface RowAnchor {
  y: number;
  left: number;
  right: number;
  height: number;
}

export const useLayout = create<{ rows: RowAnchor[] | null; set(rows: RowAnchor[]): void }>((set) => ({
  rows: null,
  set: (rows) => set({ rows }),
}));
