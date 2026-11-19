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
    return { phase: s.phase, status: s.game?.status, moves: s.game?.remainingMoves, board: s.game?.board.map((r: string[]) => r.join('')), levelId: s.levelId };
  });
}

async function rowPoint(page: Page, row: number) {
  const rows = await page.evaluate(() => (window as any).__ppe.rows());
  const box = (await page.getByTestId('board-canvas').boundingBox())!;
  const r = rows[row];
  return { x: box.x + (r.left + r.right) / 2, y: box.y + r.y };
}

async function swipe(page: Page, row: number, dx: number, dy = 0) {
  const p = await rowPoint(page, row);
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
  await swipe(page, 0, -160); // long drag still = one cell
  await waitIdle(page);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves - 1);
  const r0 = before.board[0]!;
  // row 0 of level 1 has no resulting match, so it shows the plain one-cell left shift
  expect(after.board[0]).toBe(r0.slice(1) + r0[0]);
});

test('U02: vertical drag and tiny drag do not commit a move', async ({ page }) => {
  const before = await snap(page);
  await swipe(page, 2, 10, 120);
  await swipe(page, 2, 12, 0);
  await page.waitForTimeout(300);
  const after = await snap(page);
  expect(after.moves).toBe(before.moves);
  expect(after.board).toEqual(before.board);
});

test('win flow: level 1 witness -> result -> next level -> restart restores initial board', async ({ page }) => {
  await swipe(page, 5, -80);
  await expect(page.getByTestId('result-won')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('goal-R')).toContainText('3/3');
  await page.getByTestId('next-level').click();
  const lv2 = await snap(page);
  expect(lv2.levelId).toBe(2);
  await swipe(page, 0, 80);
  await waitIdle(page);
  await page.getByTestId('restart').click();
  const again = await snap(page);
  expect(again.board).toEqual(lv2.board);
  expect(again.moves).toBe(lv2.moves);
});

test('U09: keyboard / arrow buttons use the same move path; input locked while resolving', async ({ page }) => {
  const before = await snap(page);
  await page.keyboard.press('ArrowDown'); // row 4 (default 3); row 4 right/left do not win level 1
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
  // Level 9 has a single move; a non-winning move loses.
  await page.evaluate(() => (window as any).__ppe.state().startLevel(9));
  await page.keyboard.press('ArrowDown'); // row 4
  await page.keyboard.press('ArrowDown'); // row 5
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('result-lost')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('retry').click();
  expect((await snap(page)).moves).toBe(1);
});

test('all 10 levels: witness played with keyboard reaches the win screen', async ({ page }) => {
  test.setTimeout(180_000);
  const levels: { id: number; witnessMoves: { row: number; direction: 'left' | 'right' }[] }[] = await page.evaluate(() => (window as any).__ppe.levels());
  expect(levels).toHaveLength(10);
  for (const lv of levels) {
    await page.evaluate((id) => (window as any).__ppe.state().startLevel(id), lv.id);
    for (const m of lv.witnessMoves) {
      let cur: number = await page.evaluate(() => (window as any).__ppe.state().selectedRow);
      while (cur !== m.row) {
        await page.keyboard.press(cur < m.row ? 'ArrowDown' : 'ArrowUp');
        cur = await page.evaluate(() => (window as any).__ppe.state().selectedRow);
      }
      await page.keyboard.press(m.direction === 'left' ? 'ArrowLeft' : 'ArrowRight');
      await waitIdle(page);
    }
    await expect(page.getByTestId('result-won')).toBeVisible();
  }
});
