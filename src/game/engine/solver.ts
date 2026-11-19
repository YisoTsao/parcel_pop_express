import { applyMove, createGameState } from './applyMove';
import type { GameState, LevelDefinition, Move } from './types';

export interface SolveLimits {
  maxNodes?: number;
  maxMs?: number;
  maxDepth?: number;
}

export type SolveResult =
  | { status: 'solvable'; path: Move[]; visited: number }
  | { status: 'unsolvable'; visited: number }
  | { status: 'unknown'; reason: 'timeout' | 'nodeLimit' | 'depthLimit'; visited: number };

/** Fixed expansion order: r = 0..5, left before right (LEVEL_SOLVER_SPEC §4). */
export const ALL_MOVES: Move[] = Array.from({ length: 6 }, (_, row) => [
  { row, direction: 'left' as const },
  { row, direction: 'right' as const },
]).flat();

export function stateKey(s: GameState): string {
  const prog = s.objectives.map((o) => Math.min(s.collected[o.color], o.count)).join(',');
  return `${s.board.map((r) => r.join('')).join('/')}|${s.remainingMoves}|${prog}|${s.rngState}`;
}

/** BFS over the real engine's applyMove. Never reports `unsolvable` unless exhaustive. */
export function solve(level: LevelDefinition, limits: SolveLimits = {}): SolveResult {
  const maxNodes = limits.maxNodes ?? 200_000;
  const maxMs = limits.maxMs ?? 5_000;
  const maxDepth = limits.maxDepth ?? Infinity;
  const t0 = Date.now();
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
      for (const m of ALL_MOVES) {
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
  if (depthCut) return { status: 'unknown', reason: 'depthLimit', visited };
  return { status: 'unsolvable', visited };
}
