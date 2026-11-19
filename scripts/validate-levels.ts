/**
 * Level QA (LEVEL_SOLVER_SPEC §6, rules v2): schema, stable board, witness replay + determinism,
 * no win within 3 moves (exhaustive BFS), and random-policy win rate.
 * Usage: bun scripts/validate-levels.ts
 */
import raw from '../src/game/data/levels.v2.json';
import { applyMove, createGameState, legalMoves, solve, validateLevelFile, xorshift32, type LevelDefinition } from '../src/game/engine';

const issues = validateLevelFile(raw);
const levels = (raw as unknown as { levels: LevelDefinition[] }).levels;

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

const goal = (l: LevelDefinition) => l.objectives.map((o) => (o.type === 'collectColor' ? `${o.color}×${o.count}` : `${o.type === 'clearCrates' ? '膠帶' : '冰'}×${o.count}`)).join(' + ');
console.log('| 關 | 名稱 | 直欄 | 步數 | 目標 | 見證解步數 | 3 步內可勝？ | 隨機策略勝率 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const l of levels) {
  const quick = solve({ ...l, moveLimit: Math.min(3, l.moveLimit) }, { maxNodes: 400_000, maxMs: 30_000 });
  const q = quick.status === 'unsolvable' ? '否（窮舉）' : quick.status === 'solvable' ? `是（${quick.path.length}）` : '未確定';
  console.log(`| ${l.id} | ${l.name} | ${l.allowColumnMoves ? '✓' : '—'} | ${l.moveLimit} | ${goal(l)} | ${l.witnessMoves.length} | ${q} | ${(randomWinRate(l, 200) * 100).toFixed(1)}% |`);
}
if (issues.length) {
  console.error('\nFAIL');
  for (const i of issues) console.error(`  [L${i.levelId ?? '-'}] ${i.field}: ${i.message}`);
  process.exit(1);
}
console.log(`\nPASS: ${levels.length} levels valid; every witness replays to won deterministically.`);
