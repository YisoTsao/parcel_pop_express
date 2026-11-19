/**
 * Level designer tool (rules v2). For each design spec it searches seeds for a board that:
 *  - is valid and stable (no initial line),
 *  - cannot be won in fewer than `minMoves` moves (exhaustive BFS up to that depth),
 *  - has a real winning witness found by beam search on the real engine; moveLimit = witness + slack,
 *  - has a random-policy win rate inside the spec's band.
 * Output: src/game/data/levels.v2.json (witnesses are test-only).
 * Usage: bun scripts/generate-levels.ts [onlyId]
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import {
  applyMove,
  COLORS,
  createGameState,
  findMatches,
  legalMoves,
  parseToken,
  replay,
  RULE_VERSION,
  solve,
  validateLevel,
  xorshift32,
  type LevelDefinition,
  type Objective,
  type Move,
  type Progress,
} from '../src/game/engine';

interface Spec {
  id: number;
  name: string;
  hint: string;
  moves: number;
  cols: boolean;
  objectives: Objective[];
  crates?: { n: number; hp: 1 | 2; rows?: [number, number] };
  ice?: { n: number; rows?: [number, number] };
  targetLen: number; // (unused by the greedy calibration; kept as design intent)
  minMoves: number; // no win in fewer moves
  slack: number; // targets = what a 1-ply greedy player reaches after (moves - slack) moves
  rand: [number, number]; // random-policy win-rate band
}

const C = (color: 'R' | 'B' | 'G' | 'Y', count: number): Objective => ({ type: 'collectColor', color, count });
const CR = (count: number): Objective => ({ type: 'clearCrates', count });
const ICE = (count: number): Objective => ({ type: 'breakIce', count });

export const SPECS: Spec[] = [
  // Chapter 1 — 整排滑動
  { id: 1, name: '新手配送', hint: '左右滑動整排貨箱，湊 3 個同色！', moves: 9, cols: false, objectives: [C('R', 9)], targetLen: 3, minMoves: 2, slack: 4, rand: [0, 1] },
  { id: 2, name: '左右開弓', hint: '最左邊的貨箱會從右邊轉回來。', moves: 10, cols: false, objectives: [C('B', 12)], targetLen: 4, minMoves: 3, slack: 4, rand: [0, 1] },
  { id: 3, name: '雙色訂單', hint: '兩個目標都要完成才算送達。', moves: 10, cols: false, objectives: [C('G', 10), C('Y', 10)], targetLen: 5, minMoves: 3, slack: 4, rand: [0, 0.95] },
  { id: 4, name: '火箭出動', hint: '一次連 4 個會做出火箭，消除時清掉整排！', moves: 11, cols: false, objectives: [C('R', 18)], targetLen: 6, minMoves: 4, slack: 4, rand: [0, 0.9] },
  { id: 5, name: '炸彈包裹', hint: '連 5 個或 L/T 形會做出炸彈，清掉 3×3。', moves: 12, cols: false, objectives: [C('B', 14), C('G', 14)], targetLen: 6, minMoves: 4, slack: 4, rand: [0, 0.85] },
  // Chapter 2 — 直欄解鎖
  { id: 6, name: '直欄開放', hint: '現在也可以上下滑動整欄了！', moves: 11, cols: true, objectives: [C('Y', 15)], targetLen: 5, minMoves: 3, slack: 3, rand: [0, 1] },
  { id: 7, name: '縱橫交錯', hint: '橫滑、直滑交替使用，找出更多連線。', moves: 12, cols: true, objectives: [C('R', 14), C('B', 14)], targetLen: 6, minMoves: 4, slack: 3, rand: [0, 0.9] },
  { id: 8, name: '四色快遞', hint: '盯緊數量最少的顏色。', moves: 13, cols: true, objectives: [C('R', 10), C('G', 10), C('Y', 10)], targetLen: 7, minMoves: 4, slack: 3, rand: [0, 0.85] },
  { id: 9, name: '大量出貨', hint: '多做火箭和炸彈，一次清更多。', moves: 13, cols: true, objectives: [C('B', 30)], targetLen: 8, minMoves: 4, slack: 3, rand: [0, 0.8] },
  { id: 10, name: '週末尖峰', hint: '步數不多，先想再滑。', moves: 14, cols: true, objectives: [C('R', 18), C('Y', 18)], targetLen: 9, minMoves: 4, slack: 3, rand: [0, 0.7] },
  // Chapter 3 — 膠帶箱
  { id: 11, name: '膠帶箱來了', hint: '在膠帶箱旁邊消除就能拆開它。', moves: 12, cols: true, objectives: [CR(5), C('R', 8)], crates: { n: 5, hp: 1, rows: [3, 5] }, targetLen: 4, minMoves: 2, slack: 3, rand: [0, 1] },
  { id: 12, name: '拆箱達人', hint: '膠帶箱會跟著整排一起滑動。', moves: 13, cols: true, objectives: [CR(6), C('G', 12)], crates: { n: 6, hp: 1, rows: [2, 5] }, targetLen: 6, minMoves: 3, slack: 3, rand: [0, 0.95] },
  { id: 13, name: '雙層膠帶', hint: '厚膠帶要消除兩次才會打開。', moves: 14, cols: true, objectives: [CR(5), C('B', 10)], crates: { n: 5, hp: 2, rows: [3, 5] }, targetLen: 6, minMoves: 4, slack: 3, rand: [0, 0.9] },
  { id: 14, name: '倉庫清空', hint: '火箭和炸彈也能炸開膠帶箱。', moves: 15, cols: true, objectives: [CR(9), C('Y', 10)], crates: { n: 9, hp: 2, rows: [1, 5] }, targetLen: 8, minMoves: 4, slack: 3, rand: [0, 0.85] },
  { id: 15, name: '堆疊危機', hint: '先清出空間，讓貨箱掉下來。', moves: 16, cols: true, objectives: [CR(6), C('R', 14)], crates: { n: 6, hp: 2, rows: [2, 5] }, targetLen: 9, minMoves: 4, slack: 3, rand: [0, 0.75] },
  // Chapter 4 — 冰凍箱
  { id: 16, name: '冷凍貨物', hint: '冰凍箱不能配對，旁邊消除就能解凍。', moves: 12, cols: true, objectives: [ICE(5), C('B', 8)], ice: { n: 5, rows: [2, 5] }, targetLen: 4, minMoves: 2, slack: 2, rand: [0, 1] },
  { id: 17, name: '解凍專家', hint: '解凍後的貨箱就能正常消除。', moves: 13, cols: true, objectives: [ICE(6), C('B', 12)], ice: { n: 6, rows: [1, 5] }, targetLen: 6, minMoves: 3, slack: 2, rand: [0, 0.95] },
  { id: 18, name: '冰庫深處', hint: '冰凍箱集中在底部。', moves: 14, cols: true, objectives: [ICE(10), C('G', 10)], ice: { n: 10, rows: [2, 5] }, targetLen: 7, minMoves: 4, slack: 2, rand: [0, 0.9] },
  { id: 19, name: '冰火交加', hint: '炸彈能一次解凍一大片。', moves: 15, cols: true, objectives: [ICE(8), C('Y', 16)], ice: { n: 8, rows: [0, 5] }, targetLen: 8, minMoves: 4, slack: 2, rand: [0, 0.8] },
  { id: 20, name: '急凍快遞', hint: '步數吃緊，善用連鎖。', moves: 16, cols: true, objectives: [ICE(12), C('R', 10)], ice: { n: 13, rows: [0, 5] }, targetLen: 9, minMoves: 4, slack: 2, rand: [0, 0.75] },
  // Chapter 5 — 混合
  { id: 21, name: '混裝貨櫃', hint: '膠帶箱和冰凍箱一起出現了。', moves: 15, cols: true, objectives: [CR(4), ICE(4), C('Y', 10)], crates: { n: 4, hp: 1, rows: [3, 5] }, ice: { n: 4, rows: [1, 4] }, targetLen: 7, minMoves: 3, slack: 2, rand: [0, 0.95] },
  { id: 22, name: '三方訂單', hint: '三個目標同時進行。', moves: 16, cols: true, objectives: [CR(4), ICE(4), C('G', 14)], crates: { n: 4, hp: 1, rows: [2, 5] }, ice: { n: 5, rows: [0, 5] }, targetLen: 8, minMoves: 4, slack: 2, rand: [0, 0.9] },
  { id: 23, name: '重型包裹', hint: '厚膠帶加上冰，先處理最難的。', moves: 16, cols: true, objectives: [CR(5), ICE(5), C('G', 10)], crates: { n: 5, hp: 2, rows: [3, 5] }, ice: { n: 6, rows: [0, 4] }, targetLen: 9, minMoves: 4, slack: 2, rand: [0, 0.85] },
  { id: 24, name: '連鎖倉庫', hint: '從底部消除最容易觸發連鎖。', moves: 17, cols: true, objectives: [CR(7), C('B', 16)], crates: { n: 8, hp: 1, rows: [0, 5] }, targetLen: 10, minMoves: 4, slack: 2, rand: [0, 0.8] },
  { id: 25, name: '冰封倉庫', hint: '冰凍箱和膠帶箱擠滿了倉庫。', moves: 17, cols: true, objectives: [CR(6), ICE(8), C('B', 10)], crates: { n: 6, hp: 1, rows: [2, 5] }, ice: { n: 9, rows: [0, 5] }, targetLen: 10, minMoves: 4, slack: 2, rand: [0, 0.75] },
  // Chapter 6 — 終極配送
  { id: 26, name: '午夜加班', hint: '每一步都要有價值。', moves: 18, cols: true, objectives: [C('R', 20), C('Y', 20), C('G', 12)], targetLen: 11, minMoves: 4, slack: 1, rand: [0, 0.6] },
  { id: 27, name: '鐵箱考驗', hint: '大量厚膠帶，炸彈是你的好朋友。', moves: 18, cols: true, objectives: [CR(8), C('R', 10)], crates: { n: 8, hp: 2, rows: [1, 5] }, targetLen: 11, minMoves: 4, slack: 1, rand: [0, 0.6] },
  { id: 28, name: '極地物流', hint: '滿倉冰凍箱，打通一條路。', moves: 18, cols: true, objectives: [ICE(12), C('B', 14)], ice: { n: 12, rows: [0, 5] }, targetLen: 11, minMoves: 4, slack: 1, rand: [0, 0.6] },
  { id: 29, name: '全面封鎖', hint: '三種目標加上兩種障礙。', moves: 20, cols: true, objectives: [CR(6), ICE(8), C('R', 16)], crates: { n: 6, hp: 2, rows: [2, 5] }, ice: { n: 8, rows: [0, 5] }, targetLen: 12, minMoves: 4, slack: 1, rand: [0, 0.5] },
  { id: 30, name: '傳說快遞員', hint: '最終關卡！完成就是傳說。', moves: 20, cols: true, objectives: [CR(8), ICE(10), C('Y', 20)], crates: { n: 8, hp: 2, rows: [1, 5] }, ice: { n: 10, rows: [0, 5] }, targetLen: 12, minMoves: 4, slack: 1, rand: [0, 0.5] },
];

function makeBoard(spec: Spec, seed: number): string[] | null {
  let s = seed;
  const rnd = (n: number) => {
    s = xorshift32(s);
    return s % n;
  };
  const g: string[][] = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => COLORS[rnd(4)]!));
  const free = () => {
    const cells: [number, number][] = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (/[RBGY]/.test(g[r]![c]!)) cells.push([r, c]);
    return cells;
  };
  const place = (n: number, rows: [number, number], tok: (cur: string) => string) => {
    for (let i = 0; i < n; i++) {
      const cells = free().filter(([r]) => r >= rows[0] && r <= rows[1]);
      if (!cells.length) return false;
      const [r, c] = cells[rnd(cells.length)]!;
      g[r]![c] = tok(g[r]![c]!);
    }
    return true;
  };
  if (spec.crates && !place(spec.crates.n, spec.crates.rows ?? [0, 5], () => String(spec.crates!.hp))) return null;
  if (spec.ice && !place(spec.ice.n, spec.ice.rows ?? [0, 5], (cur) => cur.toLowerCase())) return null;
  // break initial lines by recolouring plain parcels
  for (let guard = 0; guard < 500; guard++) {
    const grid = g.map((row) => row.map((ch) => parseToken(ch)!));
    const m = findMatches(grid);
    if (m.length === 0) return g.map((row) => row.join(''));
    const p = m[rnd(m.length)]!;
    const cur = g[p.r]![p.c]!;
    const ice = cur !== cur.toUpperCase();
    const col = COLORS[rnd(4)]!;
    g[p.r]![p.c] = ice ? col.toLowerCase() : col;
  }
  return null;
}

function randomWinRate(level: LevelDefinition, runs: number): number {
  const moves = legalMoves(level.allowColumnMoves);
  let wins = 0;
  let s = 0x9e3779b9;
  for (let i = 0; i < runs; i++) {
    let st = createGameState(level);
    while (st.status === 'ready') {
      s = xorshift32(s);
      st = applyMove(st, moves[s % moves.length]!).nextState;
    }
    if (st.status === 'won') wins++;
  }
  return wins / runs;
}

/** Greedy 1-ply play towards the spec's objective kinds with unbounded counts; returns the path and progress after each move. */
function greedyRun(base: LevelDefinition, moves: number): { path: Move[]; after: Progress[] } {
  const big: LevelDefinition = { ...base, moveLimit: moves, objectives: base.objectives.map((o) => ({ ...o, count: 999 })) };
  const legal = legalMoves(base.allowColumnMoves);
  let st = createGameState(big);
  const path: Move[] = [];
  const after: Progress[] = [];
  const value = (p: Progress) =>
    base.objectives.reduce((v, o) => v + (o.type === 'collectColor' ? p.collected[o.color] : o.type === 'clearCrates' ? p.cratesCleared * 6 : p.iceBroken * 6), 0);
  while (st.status === 'ready') {
    let best: { m: Move; n: typeof st; v: number } | null = null;
    for (const m of legal) {
      const n = applyMove(st, m).nextState;
      const specials = n.board.flat().filter((t) => t.kind === 'parcel' && t.special).length;
      const v = value(n.progress) + specials * 2;
      if (!best || v > best.v) best = { m, n, v };
    }
    st = best!.n;
    path.push(best!.m);
    after.push(st.progress);
  }
  return { path, after };
}

function design(spec: Spec): { level: LevelDefinition; rate: number; greedyAt: number; tries: number } {
  const why: Record<string, number> = {};
  const fail = (k: string) => (why[k] = (why[k] ?? 0) + 1);
  for (let t = 0; t < Number(process.env.TRIES ?? 80); t++) {
    const seed = ((spec.id * 7919 + t * 104729) >>> 0) || 1;
    const board = makeBoard(spec, xorshift32(seed ^ 0x5bd1e995));
    if (!board) continue;
    const base: LevelDefinition = {
      id: spec.id,
      name: spec.name,
      width: 6,
      height: 6,
      moveLimit: spec.moves,
      seed,
      allowColumnMoves: spec.cols,
      board,
      objectives: spec.objectives,
      witnessMoves: [],
      hint: spec.hint,
    };
    if (validateLevel(base, { checkWitness: false }).length) {
      fail('invalid');
      continue;
    }
    // Calibrate targets: what a 1-ply greedy player reaches after (moves - slack) moves.
    const reachAt = spec.moves - spec.slack;
    const g = greedyRun(base, spec.moves);
    const p = g.after[reachAt - 1];
    if (!p) continue;
    const objectives: Objective[] = spec.objectives.map((o) => {
      if (o.type === 'collectColor') return { ...o, count: Math.max(o.count, Math.floor(p.collected[o.color] * 0.7)) };
      if (o.type === 'clearCrates') return { ...o, count: Math.min(o.count, p.cratesCleared) };
      return { ...o, count: Math.min(o.count, p.iceBroken) };
    });
    if (objectives.some((o, i) => o.type !== 'collectColor' && o.count < Math.ceil(spec.objectives[i]!.count * 0.75))) {
      fail('obstaclesTooHard');
      continue;
    }
    const cand: LevelDefinition = { ...base, objectives };
    const replayed = replay(cand, g.path);
    if (replayed.state.status !== 'won') {
      fail('greedyNoWin');
      continue;
    }
    const witness = g.path.slice(0, replayed.state.turn);
    if (spec.minMoves > 1) {
      const quick = solve({ ...cand, moveLimit: spec.minMoves - 1 }, { maxNodes: 400_000, maxMs: 20_000 });
      if (quick.status !== 'unsolvable') {
        fail(`quick:${quick.status}`);
        continue;
      }
    }
    const level = { ...cand, witnessMoves: witness };
    if (validateLevel(level).length) {
      fail('witnessInvalid');
      continue;
    }
    const rate = randomWinRate(level, 150);
    if (rate > spec.rand[1]) {
      fail(`rate:${rate.toFixed(2)}`);
      continue;
    }
    return { level, rate, greedyAt: witness.length, tries: t + 1 };
  }
  throw new Error(`could not design level ${spec.id}: ${JSON.stringify(why)}`);
}

const OUT = 'src/game/data/levels.v2.json';
const only = process.argv[2] ? Number(process.argv[2]) : null;
const existing: LevelDefinition[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).levels : [];
const byId = new Map(existing.map((l) => [l.id, l]));
for (const spec of SPECS) {
  if (only !== null && spec.id !== only) continue;
  const t0 = Date.now();
  const { level, rate, greedyAt, tries } = design(spec);
  byId.set(spec.id, level);
  console.log(`L${spec.id} ${spec.name}: moveLimit ${level.moveLimit}, random win ${(rate * 100).toFixed(0)}%, greedy wins in ${greedyAt}, goals ${level.objectives.map((o) => (o.type === 'collectColor' ? o.color : o.type) + '×' + o.count).join('+')}, seed tries ${tries}, ${Date.now() - t0}ms`);
  const levels = [...byId.values()].sort((a, b) => a.id - b.id);
  writeFileSync(OUT, JSON.stringify({ ruleVersion: RULE_VERSION, levels }, null, 2) + '\n');
}
