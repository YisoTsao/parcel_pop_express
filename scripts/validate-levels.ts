/**
 * Level QA (LEVEL_SOLVER_SPEC §6): schema, stable board, witness replay, determinism,
 * BFS shortest solution, and a random-policy win-rate simulation.
 * Usage: bun scripts/validate-levels.ts
 */
import raw from '../src/game/data/levels.v1.json';
import { ALL_MOVES, applyMove, createGameState, solve, validateLevelFile, xorshift32, type LevelDefinition } from '../src/game/engine';

const issues = validateLevelFile(raw);
const levels = (raw as { levels: LevelDefinition[] }).levels;

function randomWinRate(level: LevelDefinition, runs: number): number {
  let wins = 0;
  let s = 0x9e3779b9;
  for (let i = 0; i < runs; i++) {
    let st = createGameState(level);
    while (st.status === 'ready') {
      s = xorshift32(s);
      st = applyMove(st, ALL_MOVES[s % 12]!).nextState;
    }
    if (st.status === 'won') wins++;
  }
  return wins / runs;
}

console.log('id | name | moves | objectives | witness | BFS min | random win%');
for (const l of levels) {
  const r = solve(l, { maxNodes: 300_000, maxMs: 10_000 });
  const min = r.status === 'solvable' ? `${r.path.length} (${r.path.map((m) => `${m.row}${m.direction[0]!.toUpperCase()}`).join(' ')})` : r.status;
  const obj = l.objectives.map((o) => `${o.color}×${o.count}`).join('+');
  const wit = l.witnessMoves.map((m) => `${m.row}${m.direction[0]!.toUpperCase()}`).join(' ');
  console.log(`${l.id} | ${l.name} | ${l.moveLimit} | ${obj} | ${wit} | ${min} | ${(randomWinRate(l, 500) * 100).toFixed(1)}%`);
}
if (issues.length) {
  console.error('\nFAIL');
  for (const i of issues) console.error(`  [L${i.levelId ?? '-'}] ${i.field}: ${i.message}`);
  process.exit(1);
}
console.log(`\nPASS: ${levels.length} levels valid, witnesses replay to won deterministically.`);
