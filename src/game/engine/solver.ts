import { applyMove, createGameState, legalMoves } from './applyMove';
import { boardToRows } from './board';
import { objectivesMet } from './objectives';
import type { GameState, LevelDefinition, Move, Objective, Progress } from './types';

export interface SolveLimits {
  maxNodes?: number;
  maxMs?: number;
  maxDepth?: number;
}

export type SolveResult =
  | { status: 'solvable'; path: Move[]; visited: number }
  | { status: 'unsolvable'; visited: number }
  | { status: 'unknown'; reason: 'timeout' | 'nodeLimit' | 'depthLimit'; visited: number };

function capped(objs: Objective[], p: Progress): string {
  return objs
    .map((o) => Math.min(o.type === 'collectColor' ? p.collected[o.color] : o.type === 'clearCrates' ? p.cratesCleared : p.iceBroken, o.count))
    .join(',');
}

export function stateKey(s: GameState): string {
  return `${boardToRows(s.board).join('/')}|${s.remainingMoves}|${capped(s.objectives, s.progress)}|${s.rngState}`;
}

/**
 * Exhaustive BFS over the real engine (LEVEL_SOLVER_SPEC). Only reports `unsolvable`
 * after a complete search; any limit hit returns `unknown`.
 */
export function solve(level: LevelDefinition, limits: SolveLimits = {}): SolveResult {
  const maxNodes = limits.maxNodes ?? 200_000;
  const maxMs = limits.maxMs ?? 5_000;
  const maxDepth = limits.maxDepth ?? Infinity;
  const t0 = Date.now();
  const moves = legalMoves(level.allowColumnMoves);
  const start = createGameState(level);
  const seen = new Set<string>([stateKey(start)]);
  let frontier: { state: GameState; path: Move[] }[] = [{ state: start, path: [] }];
  let visited = 0;
  let depthCut = false;
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (node.path.length >= maxDepth) {
        depthCut = true;
        continue;
      }
      for (const m of moves) {
        visited++;
        if (visited > maxNodes) return { status: 'unknown', reason: 'nodeLimit', visited };
        if ((visited & 255) === 0 && Date.now() - t0 > maxMs) return { status: 'unknown', reason: 'timeout', visited };
        const { nextState } = applyMove(node.state, m);
        const path = [...node.path, m];
        if (nextState.status === 'won') return { status: 'solvable', path, visited };
        if (nextState.status !== 'ready') continue;
        const k = stateKey(nextState);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ state: nextState, path });
      }
    }
    frontier = next;
  }
  return depthCut ? { status: 'unknown', reason: 'depthLimit', visited } : { status: 'unsolvable', visited };
}

/** Heuristic distance to winning (lower is better); used only by beam search tooling. */
export function remainingNeed(s: GameState): number {
  let need = 0;
  for (const o of s.objectives) {
    const h = o.type === 'collectColor' ? s.progress.collected[o.color] : o.type === 'clearCrates' ? s.progress.cratesCleared : s.progress.iceBroken;
    const w = o.type === 'collectColor' ? 1 : 3;
    need += Math.max(0, o.count - h) * w;
  }
  return need;
}

/**
 * Beam search for a winning move list (finds witnesses for long levels where BFS is infeasible).
 * A found path is real proof of solvability; failing to find one proves nothing.
 */
export function beamSearch(level: LevelDefinition, width = 200): Move[] | null {
  const moves = legalMoves(level.allowColumnMoves);
  let beam: { state: GameState; path: Move[] }[] = [{ state: createGameState(level), path: [] }];
  for (let depth = 0; depth < level.moveLimit; depth++) {
    const seen = new Set<string>();
    const cand: { state: GameState; path: Move[]; score: number }[] = [];
    for (const node of beam) {
      for (const m of moves) {
        const { nextState } = applyMove(node.state, m);
        const path = [...node.path, m];
        if (nextState.status === 'won' || objectivesMet(nextState.objectives, nextState.progress)) return path;
        if (nextState.status !== 'ready') continue;
        const k = stateKey(nextState);
        if (seen.has(k)) continue;
        seen.add(k);
        const specials = nextState.board.flat().filter((t) => t.kind === 'parcel' && t.special).length;
        cand.push({ state: nextState, path, score: remainingNeed(nextState) - specials * 1.5 - nextState.comboCount * 0.2 });
      }
    }
    cand.sort((a, b) => a.score - b.score);
    beam = cand.slice(0, width);
    if (beam.length === 0) return null;
  }
  return null;
}
