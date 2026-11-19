import { create } from 'zustand';

/** Screen-space anchors of each board row (CSS px within the canvas), for DOM arrow buttons. */
export interface RowAnchor {
  y: number;
  left: number;
  right: number;
  height: number;
}

/** Screen-space anchors of each board column: x centre, top/bottom rim, cell width. */
export interface ColAnchor {
  x: number;
  topY: number;
  bottomY: number;
  width: number;
}

export const useLayout = create<{ rows: RowAnchor[] | null; cols: ColAnchor[] | null; set(rows: RowAnchor[], cols: ColAnchor[]): void }>((set) => ({
  rows: null,
  cols: null,
  set: (rows, cols) => set({ rows, cols }),
}));
