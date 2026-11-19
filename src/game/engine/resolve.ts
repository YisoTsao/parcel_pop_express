import { cloneBoard } from './board';
import { findRuns, type Run } from './findMatches';
import { applyGravity, refill } from './gravity';
import { emptyProgress } from './objectives';
import {
  BOARD_SIZE,
  EngineError,
  MAX_CASCADE_ROUNDS,
  type Blast,
  type Board,
  type Color,
  type CreatedSpecial,
  type Move,
  type ParcelTile,
  type Pos,
  type Progress,
  type Special,
  type StableBoard,
  type TurnEvent,
} from './types';

const N = BOARD_SIZE;
const key = (r: number, c: number) => r * N + c;
const pos = (k: number): Pos => ({ r: Math.floor(k / N), c: k % N });
const byKey = (a: number, b: number) => a - b;

export interface ResolveResult {
  board: StableBoard;
  rngState: number;
  gained: Progress;
  rounds: number;
  removedCells: number;
  specialsCreated: number;
  score: number;
  events: TurnEvent[];
}

/** Cells a special clears when it activates (GAME_RULES §5). */
export function blastArea(special: Special, at: Pos): Pos[] {
  const out: Pos[] = [];
  if (special === 'rocketRow') for (let c = 0; c < N; c++) out.push({ r: at.r, c });
  else if (special === 'rocketCol') for (let r = 0; r < N; r++) out.push({ r, c: at.c });
  else
    for (let r = at.r - 1; r <= at.r + 1; r++)
      for (let c = at.c - 1; c <= at.c + 1; c++) if (r >= 0 && r < N && c >= 0 && c < N) out.push({ r, c });
  return out;
}

interface Group {
  runs: Run[];
  cells: number[];
}

function groupRuns(runs: Run[]): Group[] {
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const owner = new Map<number, number>();
  runs.forEach((run, i) =>
    run.cells.forEach((p) => {
      const k = key(p.r, p.c);
      const o = owner.get(k);
      if (o === undefined) owner.set(k, i);
      else parent[find(i)] = find(o);
    }),
  );
  const groups = new Map<number, Group>();
  runs.forEach((run, i) => {
    const root = find(i);
    const g = groups.get(root) ?? { runs: [], cells: [] };
    g.runs.push(run);
    groups.set(root, g);
  });
  const out = [...groups.values()].map((g) => {
    const set = new Set<number>();
    for (const run of g.runs) for (const p of run.cells) set.add(key(p.r, p.c));
    return { runs: g.runs, cells: [...set].sort(byKey) };
  });
  return out.sort((a, b) => a.cells[0]! - b.cells[0]!);
}

/** Which special (if any) a matched group creates (GAME_RULES §5.1). */
export function specialForGroup(runs: Run[]): Special | null {
  const hasH = runs.some((r) => r.dir === 'h');
  const hasV = runs.some((r) => r.dir === 'v');
  const maxLen = Math.max(...runs.map((r) => r.cells.length));
  if ((hasH && hasV) || maxLen >= 5) return 'bomb';
  if (maxLen === 4) return runs.find((r) => r.cells.length === 4)!.dir === 'h' ? 'rocketRow' : 'rocketCol';
  return null;
}

/**
 * Repeats rounds of: find lines -> plan specials -> remove + activate specials ->
 * damage crates / thaw ice -> gravity -> refill, until stable (GAME_RULES §3–§6).
 * Never mutates `input`. Throws ENGINE_CASCADE_LIMIT after `maxRounds` rounds.
 */
export function resolveBoard(
  input: StableBoard,
  rngState: number,
  turn: number,
  move: Move | null = null,
  maxRounds: number = MAX_CASCADE_ROUNDS,
): ResolveResult {
  let board: Board = cloneBoard(input);
  let state = rngState;
  const gained = emptyProgress();
  const events: TurnEvent[] = [];
  let rounds = 0;
  let removedCells = 0;
  let specialsCreated = 0;
  let score = 0;

  for (;;) {
    const runs = findRuns(board);
    if (runs.length === 0) break;
    if (rounds >= maxRounds) {
      throw new EngineError('ENGINE_CASCADE_LIMIT', `cascade exceeded ${maxRounds} rounds`, { rngState: state, turn, maxRounds });
    }
    rounds++;
    const tileAt = (k: number) => board[Math.floor(k / N)]![k % N] ?? null;

    // 1. groups and specials to create
    const groups = groupRuns(runs);
    const created: CreatedSpecial[] = [];
    const createKeys = new Set<number>();
    const matchedKeys = new Set<number>();
    for (const g of groups) {
      g.cells.forEach((k) => matchedKeys.add(k));
      const special = specialForGroup(g.runs);
      if (!special) continue;
      let cand = g.cells.filter((k) => !(tileAt(k) as ParcelTile).special);
      if (special === 'bomb') {
        const hk = new Set(g.runs.filter((r) => r.dir === 'h').flatMap((r) => r.cells.map((p) => key(p.r, p.c))));
        const vk = new Set(g.runs.filter((r) => r.dir === 'v').flatMap((r) => r.cells.map((p) => key(p.r, p.c))));
        const inter = cand.filter((k) => hk.has(k) && vk.has(k));
        if (inter.length) cand = inter;
      }
      if (rounds === 1 && move) {
        const inLine = cand.filter((k) => (move.line === 'row' ? Math.floor(k / N) === move.index : k % N === move.index));
        if (inLine.length) cand = inLine;
      }
      if (cand.length === 0) continue;
      // tie-break: lowest row on screen (largest r), then leftmost
      const pick = cand.reduce((best, k) => {
        const a = pos(k);
        const b = pos(best);
        return a.r > b.r || (a.r === b.r && a.c < b.c) ? k : best;
      });
      createKeys.add(pick);
      created.push({ pos: pos(pick), color: (tileAt(pick) as ParcelTile).color, special });
    }

    // 2. removal set and chained special activation
    const removeKeys = new Set<number>([...matchedKeys].filter((k) => !createKeys.has(k)));
    const crateHit = new Set<number>();
    const thaw = new Set<number>();
    const activated = new Set<number>();
    const queue: number[] = [];
    for (const k of [...removeKeys].sort(byKey)) {
      if ((tileAt(k) as ParcelTile).special) {
        activated.add(k);
        queue.push(k);
      }
    }
    const blasts: Blast[] = [];
    while (queue.length) {
      const k = queue.shift()!;
      const special = (tileAt(k) as ParcelTile).special!;
      const cells = blastArea(special, pos(k));
      blasts.push({ origin: pos(k), special, cells });
      for (const p of cells) {
        const k2 = key(p.r, p.c);
        const t = tileAt(k2);
        if (!t || k2 === k) continue;
        if (t.kind === 'crate') crateHit.add(k2);
        else if (t.ice) thaw.add(k2);
        else if (!createKeys.has(k2)) {
          removeKeys.add(k2);
          if (t.special && !activated.has(k2)) {
            activated.add(k2);
            queue.push(k2);
          }
        }
      }
    }

    // 3. lines damage orthogonal neighbours
    for (const k of matchedKeys) {
      const { r, c } = pos(k);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        const k2 = key(rr, cc);
        const t = tileAt(k2);
        if (!t) continue;
        if (t.kind === 'crate') crateHit.add(k2);
        else if (t.ice && !removeKeys.has(k2)) thaw.add(k2);
      }
    }

    // 4. apply
    const next = board.map((row) => row.slice());
    const crateHits: { pos: Pos; hp: number }[] = [];
    for (const k of [...crateHit].sort(byKey)) {
      const t = tileAt(k);
      if (!t || t.kind !== 'crate') continue;
      const hp = Math.max(0, t.hp - 1);
      crateHits.push({ pos: pos(k), hp });
      if (hp === 0) {
        next[Math.floor(k / N)]![k % N] = null;
        gained.cratesCleared++;
      } else next[Math.floor(k / N)]![k % N] = { kind: 'crate', hp };
    }
    const thawed: Pos[] = [];
    for (const k of [...thaw].sort(byKey)) {
      const t = tileAt(k);
      if (!t || t.kind !== 'parcel' || !t.ice) continue;
      next[Math.floor(k / N)]![k % N] = { kind: 'parcel', color: t.color, ...(t.special ? { special: t.special } : {}) };
      thawed.push(pos(k));
      gained.iceBroken++;
    }
    const removed = [...removeKeys].sort(byKey);
    const colors: Color[] = removed.map((k) => (tileAt(k) as ParcelTile).color);
    for (const col of colors) gained.collected[col]++;
    for (const k of removed) next[Math.floor(k / N)]![k % N] = null;
    for (const cr of created) next[cr.pos.r]![cr.pos.c] = { kind: 'parcel', color: cr.color, special: cr.special };

    removedCells += removed.length;
    specialsCreated += created.length;
    score += removed.length * 10 * rounds + created.length * 50 + crateHits.length * 20 + thawed.length * 20;
    events.push({
      type: 'MATCH_REMOVED',
      turn,
      cascadeIndex: rounds,
      cells: removed.map(pos),
      colors,
      matched: [...matchedKeys].sort(byKey).map(pos),
      created,
      blasts,
      crateHits,
      thawed,
    });

    const g = applyGravity(next);
    events.push({ type: 'CELLS_FELL', turn, cascadeIndex: rounds, falls: g.falls });
    const f = refill(g.board, state);
    state = f.rngState;
    board = f.board;
    events.push({ type: 'CELLS_SPAWNED', turn, cascadeIndex: rounds, spawns: f.spawns });
  }

  return { board: board as StableBoard, rngState: state, gained, rounds, removedCells, specialsCreated, score, events };
}
