import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  phase: string;
  status: string;
  moves: number;
  board: string[];
  levelId: number;
}

async function snap(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const s = (window as any).__ppe.state();
    return { phase: s.phase, status: s.game?.status, moves: s.game?.remainingMoves, board: (window as any).__ppe.board(), levelId: s.levelId };
  });
}

type Move = { line: 'row'; index: number; direction: 'left' | 'right' } | { line: 'col'; index: number; direction: 'up' | 'down' };

/** Screen point at the centre of board cell (r, c). */
async function cellPoint(page: Page, r: number, c: number) {
  const rows = await page.evaluate(() => (window as any).__ppe.rows());
  const cols = await page.evaluate(() => (window as any).__ppe.cols());
  const box = (await page.getByTestId('board-canvas').boundingBox())!;
  const row = rows[r];
  const col = cols[c];
  return { x: box.x + col.x, y: box.y + row.y };
}

async function swipeAt(page: Page, r: number, c: number, dx: number, dy = 0) {
  const p = await cellPoint(page, r, c);
  const isTouch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (isTouch) {
    // dispatch real pointer events of type touch on the canvas
    await page.evaluate(
      ({ p, dx, dy }) => {
        const el = document.querySelector('[data-testid="board-canvas"] canvas')!;
        const fire = (type: string, x: number, y: number) =>
          el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1 }));
        fire('pointerdown', p.x, p.y);
        for (let i = 1; i <= 6; i++) fire('pointermove', p.x + (dx * i) / 6, p.y + (dy * i) / 6);
        fire('pointerup', p.x + dx, p.y + dy);
      },
      { p, dx, dy },
    );
  } else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(p.x + (dx * i) / 6, p.y + (dy * i) / 6);
    await page.mouse.up();
  }
}

/** Play a move with the keyboard: W/A/S/D move the selection, arrows shift. */
async function keyMove(page: Page, m: Move) {
  const want = m.line === 'row' ? { key: 'r', fwd: 's', back: 'w' } : { key: 'c', fwd: 'd', back: 'a' };
  for (;;) {
    const cur: number = await page.evaluate((k) => (window as any).__ppe.state().selected[k], want.key);
    if (cur === m.index) break;
    await page.keyboard.press(cur < m.index ? want.fwd : want.back);
  }
  const key = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[m.direction];
  await page.keyboard.press(key);
}

async function waitIdle(page: Page) {
  await expect.poll(async () => (await snap(page)).phase, { timeout: 15_000 }).not.toBe('resolving');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?e2e=1');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('board-canvas').locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!(window as any).__ppe?.rows())).toBe(true);
});

test('U01: horizontal swipe shifts exactly one row by one cell and costs one move', async ({ page }) => {
  const before = await snap(page);
  await swipeAt(page, 1, 2, -160); // long drag still = one cell
  await waitIdle(page);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves - 1);
  const r1 = before.board[1]!;
  // row 1 left on level 1 makes no line, so it shows the plain one-cell left shift
  expect(after.board[1]).toBe(r1.slice(1) + r1[0]);
});

test('U02: on a rows-only level, vertical drags and tiny drags do not commit a move', async ({ page }) => {
  const before = await snap(page);
  await swipeAt(page, 2, 2, 10, 120);
  await swipeAt(page, 2, 2, 12, 0);
  await page.waitForTimeout(300);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves);
  expect(after.board).toEqual(before.board);
  await expect(page.getByTestId('arrow-up')).toHaveCount(0);
});

test('U10: vertical swipe shifts exactly one column by one cell where columns are allowed', async ({ page }) => {
  await page.evaluate(() => (window as any).__ppe.state().startLevel(6));
  await expect(page.getByTestId('arrow-up')).toBeVisible();
  const before = await snap(page);
  await swipeAt(page, 2, 0, 0, 170); // column 0 down: no line on level 6
  await waitIdle(page);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves - 1);
  const col = (b: string[]) => b.map((row) => row[0]).join('');
  const c0 = col(before.board);
  expect(col(after.board)).toBe(c0[5] + c0.slice(0, 5));
  // other columns untouched
  expect(after.board.map((row) => row.slice(1))).toEqual(before.board.map((row) => row.slice(1)));
});

test('win flow: level 1 witness -> result -> next level -> restart restores initial board', async ({ page }) => {
  const lv1 = await page.evaluate(() => (window as any).__ppe.levels()[0]);
  for (const m of lv1.witnessMoves as Move[]) {
    await keyMove(page, m);
    await waitIdle(page);
  }
  await expect(page.getByTestId('result-won')).toBeVisible({ timeout: 15_000 });
  const target = lv1.objectives[0].count;
  await expect(page.getByTestId('goal-R')).toContainText(`${target}/${target}`);
  await page.getByTestId('next-level').click();
  const lv2 = await snap(page);
  expect(lv2.levelId).toBe(2);
  await swipeAt(page, 0, 2, 80);
  await waitIdle(page);
  await page.getByTestId('restart').click();
  const again = await snap(page);
  expect(again.board).toEqual(lv2.board);
  expect(again.moves).toBe(lv2.moves);
});

test('U09: keyboard / arrow buttons use the same move path; input locked while resolving', async ({ page }) => {
  const before = await snap(page);
  await page.keyboard.press('s'); // row 4 (default 3); row 4 right makes no line on level 1
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // ignored while resolving
  await waitIdle(page);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves - 1);
  await page.getByTestId('arrow-left').click();
  await waitIdle(page);
  expect((await snap(page)).moves).toBe(before.moves - 2);
});

test('lose flow: run out of moves -> lost screen -> retry', async ({ page }) => {
  test.setTimeout(120_000);
  await page.evaluate(() => (window as any).__ppe.state().setSettings({ reducedMotion: true }));
  // engine-checked non-winning sequence for level 1 (9 moves)
  const seq: Move[] = [
    { line: 'row', index: 1, direction: 'left' },
    { line: 'row', index: 1, direction: 'left' },
    ...Array.from({ length: 7 }, () => ({ line: 'row' as const, index: 0, direction: 'left' as const })),
  ];
  for (const m of seq) {
    await keyMove(page, m);
    await waitIdle(page);
  }
  await expect(page.getByTestId('result-lost')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('retry').click();
  expect((await snap(page)).moves).toBe(9);
});

test('all 30 levels: witness played with the keyboard reaches the win screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-mouse', 'keyboard replay runs once, on desktop');
  test.setTimeout(900_000);
  await page.evaluate(() => (window as any).__ppe.state().setSettings({ reducedMotion: true }));
  const levels: { id: number; witnessMoves: Move[] }[] = await page.evaluate(() => (window as any).__ppe.levels());
  expect(levels).toHaveLength(30);
  for (const lv of levels) {
    await page.evaluate((id) => (window as any).__ppe.state().startLevel(id), lv.id);
    for (const m of lv.witnessMoves) {
      await keyMove(page, m);
      await waitIdle(page);
    }
    await expect(page.getByTestId('result-won')).toBeVisible();
  }
});
