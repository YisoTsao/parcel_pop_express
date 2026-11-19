/**
 * Imperative Three.js presenter for the 6x6 board. It owns meshes, tweens and particles,
 * and plays TimelineSteps derived from engine events. It never decides game rules:
 * the logical grid it ends on is exactly the one built from the events, and the caller
 * hard-syncs to nextState.board afterwards.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Color, ColorCount, StableBoard, TurnEvent } from '../engine';
import { PARCEL_HEX } from '../../shared/parcelStyle';
import { playSfx } from '../../shared/audio';
import type { SharedAssets } from './assets';
import { boardToWorld, PARCEL_H, PARCEL_Y } from './coords';
import { ease, Tweener } from './tween';
import { buildTimeline, gridColors, gridFromBoard, IdSource, type PieceGrid, type TimelineStep } from './timelineModel';

interface Piece {
  id: number;
  color: Color;
  group: THREE.Group;
  box: THREE.Mesh;
  top: THREE.Mesh;
  label: THREE.Mesh;
  blob: THREE.Mesh;
}

export interface PlayHooks {
  onShift(): void;
  onObjectives(collected: ColorCount): void;
  onCombo(n: number): void;
}

const PARTICLE_POOL = 160;

/** Golden rounded frame drawn around the active row (texture is mostly transparent). */
function rowFrameTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 178;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.shadowColor = 'rgba(255, 214, 94, 0.9)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#FFD45E';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 34);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#FFF4C8';
  ctx.lineWidth = 4;
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

export class BoardView {
  readonly root = new THREE.Group();
  private readonly piecesLayer = new THREE.Group();
  private readonly pieces = new Map<number, Piece>();
  private readonly pool: Piece[] = [];
  private grid: PieceGrid = [];
  private ids = new IdSource();
  private readonly tw = new Tweener();
  private token = 0;
  private reducedMotion = false;
  private particleCap = 32;
  private blobShadows = false;

  private readonly highlight: THREE.Mesh;
  private highlightTarget = 0;
  private highlightRow = -1;
  private dragRow = -1;
  private dragOffset = 0;

  private readonly particles: THREE.InstancedMesh;
  private readonly pPos = new Float32Array(PARTICLE_POOL * 3);
  private readonly pVel = new Float32Array(PARTICLE_POOL * 3);
  private readonly pLife = new Float32Array(PARTICLE_POOL);
  private readonly pMax = new Float32Array(PARTICLE_POOL);
  private pNext = 0;
  private pActive = 0;

  private readonly ring: THREE.Mesh;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private readonly assets: SharedAssets) {
    this.root.add(this.buildTray());
    this.root.add(this.piecesLayer);

    const hlGeo = new THREE.PlaneGeometry(6.36, 1.1);
    hlGeo.rotateX(-Math.PI / 2);
    const hlMat = new THREE.MeshBasicMaterial({ map: rowFrameTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.highlight = new THREE.Mesh(hlGeo, hlMat);
    this.highlight.position.y = PARCEL_H + 0.012;
    this.highlight.renderOrder = 1;
    this.root.add(this.highlight);
    this.disposables.push(hlGeo, hlMat, hlMat.map!);

    const pGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    const pMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    this.particles = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL);
    this.particles.frustumCulled = false;
    for (let i = 0; i < PARTICLE_POOL; i++) {
      tmpObj.scale.setScalar(0);
      tmpObj.updateMatrix();
      this.particles.setMatrixAt(i, tmpObj.matrix);
      this.particles.setColorAt(i, tmpColor.set('#ffffff'));
    }
    this.root.add(this.particles);
    this.disposables.push(pGeo, pMat);

    const ringGeo = new THREE.RingGeometry(0.8, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#FFF6D8', transparent: true, opacity: 0, depthWrite: false });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.y = PARCEL_H + 0.05;
    this.ring.visible = false;
    this.root.add(this.ring);
    this.disposables.push(ringGeo, ringMat);
  }

  private buildTray(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#D9A86C', roughness: 0.75 });
    const woodLight = new THREE.MeshStandardMaterial({ color: '#E8C48E', roughness: 0.8 });
    const base = new RoundedBoxGeometry(7.0, 0.5, 7.0, 4, 0.2);
    const baseMesh = new THREE.Mesh(base, woodLight);
    baseMesh.position.y = -0.25;
    baseMesh.receiveShadow = true;
    g.add(baseMesh);
    const rimLong = new RoundedBoxGeometry(7.0, 0.26, 0.3, 3, 0.1);
    const rimShort = new RoundedBoxGeometry(0.3, 0.26, 6.4, 3, 0.1);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(rimLong, wood);
      a.position.set(0, 0.1, s * 3.35);
      a.castShadow = a.receiveShadow = true;
      const b = new THREE.Mesh(rimShort, wood);
      b.position.set(s * 3.35, 0.1, 0);
      b.castShadow = b.receiveShadow = true;
      g.add(a, b);
    }
    const slotGeo = new THREE.PlaneGeometry(0.98, 0.98);
    slotGeo.rotateX(-Math.PI / 2);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        const m = new THREE.Mesh(slotGeo, this.assets.slotMat);
        const w = boardToWorld(r, c);
        m.position.set(w.x, 0.004, w.z);
        m.receiveShadow = true;
        g.add(m);
      }
    // soft drop shadow under the tray (the page background shows through the transparent canvas)
    const tableGeo = new THREE.PlaneGeometry(9.6, 9.6);
    tableGeo.rotateX(-Math.PI / 2);
    const tableMat = new THREE.MeshBasicMaterial({ map: this.assets.blobMat.map, transparent: true, opacity: 0.55, depthWrite: false });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0.25, -0.5, 0.35);
    g.add(table);
    this.disposables.push(wood, woodLight, base, rimLong, rimShort, slotGeo, tableGeo, tableMat);
    return g;
  }

  setQuality(opts: { particlesPerBatch: number; shadowMap: number; contactShadows: boolean }): void {
    this.particleCap = opts.particlesPerBatch;
    this.blobShadows = opts.shadowMap === 0 && !opts.contactShadows;
    for (const p of this.pieces.values()) {
      p.blob.visible = this.blobShadows;
      p.box.castShadow = opts.shadowMap > 0;
    }
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  // ---------- piece pool ----------
  private acquire(id: number, color: Color): Piece {
    let p = this.pool.pop();
    if (!p) {
      const group = new THREE.Group();
      const box = new THREE.Mesh(this.assets.boxGeo, this.assets.boxMat[color]);
      box.castShadow = true;
      box.receiveShadow = true;
      const top = new THREE.Mesh(this.assets.topGeo, this.assets.topMat[color]);
      top.position.y = PARCEL_H / 2 + 0.003;
      top.renderOrder = 2;
      const label = new THREE.Mesh(this.assets.labelGeo, this.assets.labelMat);
      label.position.set(0.12, -0.02, 0.86 / 2 + 0.003);
      label.renderOrder = 2;
      const blob = new THREE.Mesh(this.assets.blobGeo, this.assets.blobMat);
      blob.position.y = -PARCEL_Y + 0.008;
      group.add(box, top, label, blob);
      p = { id, color, group, box, top, label, blob };
    }
    p.id = id;
    p.color = color;
    p.box.material = this.assets.boxMat[color];
    p.top.material = this.assets.topMat[color];
    p.blob.visible = this.blobShadows;
    p.group.scale.set(1, 1, 1);
    p.group.rotation.set(0, 0, 0);
    p.group.visible = true;
    this.pieces.set(id, p);
    this.piecesLayer.add(p.group);
    return p;
  }

  private release(p: Piece): void {
    this.pieces.delete(p.id);
    this.piecesLayer.remove(p.group);
    this.pool.push(p);
  }

  private place(p: Piece, r: number, c: number): void {
    const w = boardToWorld(r, c);
    p.group.position.set(w.x, PARCEL_Y, w.z);
  }

  /** Instantly show `board` (level start, restart, hard sync). Cancels any running timeline. */
  reset(board: StableBoard): void {
    this.token++;
    this.tw.cancelAll();
    for (const p of [...this.pieces.values()]) this.release(p);
    this.ids = new IdSource();
    this.grid = gridFromBoard(board, this.ids);
    this.grid.forEach((row, r) =>
      row.forEach((ref, c) => {
        if (!ref) return;
        this.place(this.acquire(ref.id, ref.color), r, c);
      }),
    );
    this.dragRow = -1;
    this.dragOffset = 0;
    this.ring.visible = false;
  }

  /** Returns true iff the presenter's logical grid equals `board`. */
  matches(board: StableBoard): boolean {
    return JSON.stringify(gridColors(this.grid)) === JSON.stringify(board);
  }

  // ---------- input feedback ----------
  setHighlight(row: number, strength: number): void {
    this.highlightRow = row;
    this.highlightTarget = row < 0 ? 0 : strength;
    if (row >= 0) this.highlight.position.z = boardToWorld(row, 0).z;
  }

  setDragOffset(row: number, offset: number): void {
    if (this.dragRow >= 0 && this.dragRow !== row) this.layoutRow(this.dragRow, 0);
    this.dragRow = row;
    this.dragOffset = offset;
    if (row >= 0) this.layoutRow(row, offset);
  }

  /** Spring a cancelled drag back to rest. */
  async releaseDrag(): Promise<void> {
    const row = this.dragRow;
    const from = this.dragOffset;
    this.dragRow = -1;
    this.dragOffset = 0;
    if (row < 0 || from === 0) return;
    const token = this.token;
    await this.tw.to(this.dur(0.16), (t) => {
      if (token === this.token) this.layoutRow(row, from * (1 - t));
    }, ease.outBack);
  }

  private layoutRow(row: number, offset: number): void {
    this.grid[row]?.forEach((ref, c) => {
      const p = ref && this.pieces.get(ref.id);
      if (!p) return;
      const w = boardToWorld(row, c);
      p.group.position.x = w.x + offset;
    });
  }

  private dur(s: number): number {
    return this.reducedMotion ? s * 0.12 : s;
  }

  // ---------- turn playback ----------
  async play(events: TurnEvent[], startCollected: ColorCount, hooks: PlayHooks): Promise<'done' | 'cancelled'> {
    const running: ColorCount = { ...startCollected };
    const token = ++this.token;
    const alive = () => token === this.token;
    const { steps, grid } = buildTimeline(this.grid, events, this.ids);
    const startOffset = this.dragOffset;
    this.dragRow = -1;
    this.dragOffset = 0;
    this.grid = grid;
    let pendingFall: Promise<unknown> | null = null;

    for (const step of steps) {
      if (!alive()) return 'cancelled';
      switch (step.kind) {
        case 'shift':
          hooks.onShift();
          playSfx('shift');
          await this.animShift(step, startOffset);
          break;
        case 'remove':
          if (step.cascadeIndex >= 2) hooks.onCombo(step.cascadeIndex);
          await this.animRemove(step);
          if (!alive()) return 'cancelled';
          for (const pc of step.pieces) running[pc.color]++;
          hooks.onObjectives({ ...running });
          break;
        case 'fall':
          pendingFall = this.animFall(step);
          if (step.moves.length > 0) await this.tw.wait(this.dur(0.05));
          break;
        case 'spawn':
          await Promise.all([pendingFall, this.animSpawn(step)]);
          pendingFall = null;
          if (alive()) playSfx('land');
          break;
        case 'objectives':
          hooks.onObjectives(step.collected);
          break;
        case 'turnEnd':
          break;
        case 'won':
          playSfx('win');
          await this.animWin();
          break;
        case 'lost':
          playSfx('lose');
          await this.tw.wait(this.dur(0.3));
          break;
      }
    }
    return alive() ? 'done' : 'cancelled';
  }

  private animShift(step: Extract<TimelineStep, { kind: 'shift' }>, startOffset: number): Promise<unknown> {
    const dir = step.direction === 'left' ? -1 : 1;
    const D = this.dur(0.2);
    const jobs: Promise<unknown>[] = [];
    step.order.forEach((id, newC) => {
      const p = this.pieces.get(id);
      if (!p) return;
      const target = boardToWorld(step.row, newC).x;
      if (id === step.wrapId) {
        // leave through one edge, re-enter from the other (clear wrap visual)
        const oldC = step.direction === 'left' ? 0 : 5;
        const fromX = boardToWorld(step.row, oldC).x + startOffset;
        const outX = boardToWorld(step.row, oldC).x + dir * 0.9;
        const inX = target - dir * 0.9;
        jobs.push(
          this.tw
            .to(D / 2, (t) => {
              p.group.position.x = fromX + (outX - fromX) * t;
              p.group.scale.setScalar(1 - 0.85 * t);
            }, ease.linear)
            .then((ok) =>
              ok
                ? this.tw.to(D / 2, (t) => {
                    p.group.position.x = inX + (target - inX) * t;
                    p.group.scale.setScalar(0.15 + 0.85 * t);
                  }, ease.outCubic)
                : false,
            ),
        );
      } else {
        const from = target - dir + startOffset;
        jobs.push(
          this.tw.to(D, (t) => {
            p.group.position.x = from + (target - from) * t;
            p.group.rotation.z = this.reducedMotion ? 0 : -dir * 0.12 * Math.sin(t * Math.PI);
          }, ease.outBack),
        );
      }
    });
    return Promise.all(jobs);
  }

  private animRemove(step: Extract<TimelineStep, { kind: 'remove' }>): Promise<unknown> {
    const D = this.dur(0.18);
    playSfx(step.cascadeIndex >= 2 ? 'combo' : 'pop', step.cascadeIndex);
    if (step.cascadeIndex >= 2 && !this.reducedMotion) this.shockwave();
    const perPiece = Math.max(1, Math.floor(this.particleCap / Math.max(1, step.pieces.length)));
    const jobs = step.pieces.map(({ id, color, at }) => {
      const p = this.pieces.get(id);
      if (!p) return Promise.resolve(true);
      return this.tw
        .to(D, (t) => {
          // 0.9 squash -> 1.1 swell -> vanish
          const s = t < 0.35 ? 1 - 0.1 * (t / 0.35) : t < 0.6 ? 0.9 + 0.25 * ((t - 0.35) / 0.25) : 1.15 * (1 - (t - 0.6) / 0.4);
          p.group.scale.set(s, t < 0.35 ? s * 0.92 : s, s);
        }, ease.linear)
        .then(() => {
          const w = boardToWorld(at.r, at.c);
          this.burst(w.x, w.z, color, perPiece);
          this.release(p);
        });
    });
    return Promise.all(jobs);
  }

  private animFall(step: Extract<TimelineStep, { kind: 'fall' }>): Promise<unknown> {
    const jobs = step.moves.map(({ id, from, to }) => {
      const p = this.pieces.get(id);
      if (!p) return Promise.resolve(true);
      const z0 = boardToWorld(from.r, from.c).z;
      const z1 = boardToWorld(to.r, to.c).z;
      const D = this.dur(Math.min(0.28, 0.18 + 0.025 * (to.r - from.r)));
      return this.tw.to(D, (t) => {
        p.group.position.z = z0 + (z1 - z0) * t;
      }, this.reducedMotion ? ease.outCubic : ease.outBounce);
    });
    return Promise.all(jobs);
  }

  private animSpawn(step: Extract<TimelineStep, { kind: 'spawn' }>): Promise<unknown> {
    const jobs = step.pieces.map(({ id, color, at, dropDistance }) => {
      const p = this.acquire(id, color);
      const w = boardToWorld(at.r, at.c);
      const z0 = w.z - 0.6 - 0.15 * dropDistance;
      const y0 = PARCEL_Y + 1.6;
      p.group.position.set(w.x, y0, z0);
      p.group.scale.setScalar(0.55);
      const D = this.dur(0.22 + 0.01 * (dropDistance - at.r));
      return this.tw.to(D, (t) => {
        p.group.position.y = y0 + (PARCEL_Y - y0) * t;
        p.group.position.z = z0 + (w.z - z0) * t;
        p.group.scale.setScalar(0.55 + 0.45 * Math.min(1, t * 1.6));
      }, this.reducedMotion ? ease.outCubic : ease.outBounce, this.reducedMotion ? 0 : 0.012 * (dropDistance - 1 - at.r));
    });
    return Promise.all(jobs);
  }

  private async animWin(): Promise<void> {
    if (this.reducedMotion) {
      await this.tw.wait(0.15);
      return;
    }
    const jobs: Promise<unknown>[] = [];
    this.grid.forEach((row, r) =>
      row.forEach((ref, c) => {
        const p = ref && this.pieces.get(ref.id);
        if (!p) return;
        jobs.push(
          this.tw.to(0.42, (t) => {
            p.group.position.y = PARCEL_Y + Math.sin(t * Math.PI) * 0.45;
          }, ease.linear, (r + c) * 0.035),
        );
      }),
    );
    await Promise.all(jobs);
  }

  private shockwave(): void {
    this.ring.visible = true;
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    void this.tw.to(0.45, (t) => {
      this.ring.scale.setScalar(0.5 + t * 4);
      mat.opacity = 0.7 * (1 - t);
      if (t >= 1) this.ring.visible = false;
    }, ease.outCubic);
  }

  private burst(x: number, z: number, color: Color, n: number): void {
    tmpColor.set(PARCEL_HEX[color]);
    for (let k = 0; k < n; k++) {
      const i = this.pNext;
      this.pNext = (this.pNext + 1) % PARTICLE_POOL;
      const a = Math.random() * Math.PI * 2; // visual-only randomness; never touches rules
      const sp = 1.6 + Math.random() * 2.2;
      this.pPos.set([x, PARCEL_Y + 0.2, z], i * 3);
      this.pVel.set([Math.cos(a) * sp, 2.6 + Math.random() * 2.4, Math.sin(a) * sp], i * 3);
      this.pLife[i] = this.pMax[i] = 0.45 + Math.random() * 0.25;
      this.particles.setColorAt(i, k % 3 === 0 ? tmpColor.clone().lerp(new THREE.Color('#ffffff'), 0.6) : tmpColor);
    }
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    this.pActive = PARTICLE_POOL;
  }

  /** Per-frame tick. No React state, no allocations in the hot path. */
  update(dt: number): void {
    const d = Math.min(dt, 1 / 20);
    this.tw.update(d);

    const mat = this.highlight.material as THREE.MeshBasicMaterial;
    mat.opacity += (this.highlightTarget - mat.opacity) * Math.min(1, d * 14);
    this.highlight.visible = mat.opacity > 0.01 && this.highlightRow >= 0;

    if (this.pActive > 0) {
      let any = false;
      for (let i = 0; i < PARTICLE_POOL; i++) {
        const life = this.pLife[i]!;
        if (life <= 0) continue;
        any = true;
        const nl = life - d;
        this.pLife[i] = nl;
        const j = i * 3;
        this.pVel[j + 1] = this.pVel[j + 1]! - 9.8 * d;
        this.pPos[j] = this.pPos[j]! + this.pVel[j]! * d;
        this.pPos[j + 1] = Math.max(0.05, this.pPos[j + 1]! + this.pVel[j + 1]! * d);
        this.pPos[j + 2] = this.pPos[j + 2]! + this.pVel[j + 2]! * d;
        const s = nl > 0 ? Math.min(1, (nl / this.pMax[i]!) * 1.6) : 0;
        tmpObj.position.set(this.pPos[j]!, this.pPos[j + 1]!, this.pPos[j + 2]!);
        tmpObj.rotation.set(nl * 9, nl * 7, 0);
        tmpObj.scale.setScalar(s);
        tmpObj.updateMatrix();
        this.particles.setMatrixAt(i, tmpObj.matrix);
      }
      this.particles.instanceMatrix.needsUpdate = true;
      if (!any) this.pActive = 0;
    }
  }

  get animating(): boolean {
    return this.tw.busy;
  }

  dispose(): void {
    this.token++;
    this.tw.cancelAll();
    for (const d of this.disposables) d.dispose();
    this.particles.dispose();
  }
}
