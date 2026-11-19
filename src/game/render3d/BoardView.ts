/**
 * Imperative Three.js presenter for the 6x6 board. It owns meshes, tweens and particles,
 * and plays TimelineSteps derived from engine events. It never decides game rules:
 * the logical grid it ends on is exactly the one built from the events, and the caller
 * hard-syncs to nextState.board afterwards.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { boardToRows, cloneProgress, type Move, type Progress, type StableBoard, type Tile, type TurnEvent } from '../engine';
import { PARCEL_HEX } from '../../shared/parcelStyle';
import { playSfx } from '../../shared/audio';
import type { SharedAssets } from './assets';
import { boardToWorld, PARCEL_H, PARCEL_Y } from './coords';
import { ease, Tweener } from './tween';
import { buildTimeline, gridFromBoard, gridRows, IdSource, type PieceGrid, type TimelineStep } from './timelineModel';

interface Piece {
  id: number;
  tile: Tile;
  group: THREE.Group;
  box: THREE.Mesh;
  top: THREE.Mesh;
  label: THREE.Mesh;
  blob: THREE.Mesh;
  badge: THREE.Mesh;
  ice: THREE.Mesh;
  frost: THREE.Mesh;
}

export type DragLine = { line: 'row' | 'col'; index: number };

export interface PlayHooks {
  onShift(): void;
  /** Running objective progress, advanced as clears are shown. */
  onProgress(progress: Progress): void;
  onCombo(n: number): void;
}

const CRATE_HEX = '#B98552';
const ICE_HEX = '#D8F6FF';
const BEAM_POOL = 6;

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
  private readonly colHighlight: THREE.Mesh;
  private highlightTarget = 0;
  private colHighlightTarget = 0;
  private highlightRow = -1;
  private highlightCol = -1;
  private drag: DragLine | null = null;
  private dragOffset = 0;
  private readonly beams: THREE.Mesh[] = [];

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
    const colGeo = hlGeo.clone();
    colGeo.rotateY(Math.PI / 2);
    this.colHighlight = new THREE.Mesh(colGeo, hlMat.clone());
    this.colHighlight.position.y = PARCEL_H + 0.014;
    this.colHighlight.renderOrder = 1;
    this.root.add(this.colHighlight);
    this.disposables.push(hlGeo, hlMat, hlMat.map!, colGeo, this.colHighlight.material as THREE.Material);

    // rocket beams (row / column flashes), reused
    const beamGeo = new THREE.PlaneGeometry(1, 1);
    beamGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < BEAM_POOL; i++) {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FFF3B8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.position.y = PARCEL_H + 0.08;
      m.visible = false;
      m.renderOrder = 3;
      this.beams.push(m);
      this.root.add(m);
      this.disposables.push(m.material as THREE.Material);
    }
    this.disposables.push(beamGeo);

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
    for (const p of [...this.pieces.values(), ...this.pool]) {
      p.blob.visible = this.blobShadows;
      p.box.castShadow = opts.shadowMap > 0;
    }
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  // ---------- piece pool ----------
  private acquire(id: number, tile: Tile): Piece {
    let p = this.pool.pop();
    if (!p) {
      const group = new THREE.Group();
      const box = new THREE.Mesh(this.assets.boxGeo, this.assets.crateMat);
      box.castShadow = true;
      box.receiveShadow = true;
      const top = new THREE.Mesh(this.assets.topGeo, this.assets.labelMat);
      top.position.y = PARCEL_H / 2 + 0.003;
      top.renderOrder = 2;
      const badge = new THREE.Mesh(this.assets.topGeo, this.assets.specialMat.bomb);
      badge.position.y = PARCEL_H / 2 + 0.006;
      badge.renderOrder = 3;
      const label = new THREE.Mesh(this.assets.labelGeo, this.assets.labelMat);
      label.position.set(0.12, -0.02, 0.86 / 2 + 0.003);
      label.renderOrder = 2;
      const blob = new THREE.Mesh(this.assets.blobGeo, this.assets.blobMat);
      blob.position.y = -PARCEL_Y + 0.008;
      const ice = new THREE.Mesh(this.assets.iceGeo, this.assets.iceMat);
      ice.renderOrder = 4;
      const frost = new THREE.Mesh(this.assets.topGeo, this.assets.frostMat);
      frost.position.y = PARCEL_H / 2 + 0.056;
      frost.renderOrder = 5;
      group.add(box, top, badge, label, blob, ice, frost);
      p = { id, tile, group, box, top, label, blob, badge, ice, frost };
    }
    p.id = id;
    this.applyTile(p, tile);
    p.blob.visible = this.blobShadows;
    p.group.scale.set(1, 1, 1);
    p.group.rotation.set(0, 0, 0);
    p.group.visible = true;
    this.pieces.set(id, p);
    this.piecesLayer.add(p.group);
    return p;
  }

  /** Swap shared materials / overlays to show a tile. */
  private applyTile(p: Piece, tile: Tile): void {
    p.tile = tile;
    if (tile.kind === 'crate') {
      p.box.material = this.assets.crateMat;
      p.top.material = this.assets.crateTopMat[tile.hp >= 2 ? 2 : 1];
      p.label.visible = false;
      p.badge.visible = false;
      p.ice.visible = p.frost.visible = false;
    } else {
      p.box.material = this.assets.boxMat[tile.color];
      p.top.material = this.assets.topMat[tile.color];
      p.label.visible = true;
      p.badge.visible = !!tile.special;
      if (tile.special) p.badge.material = this.assets.specialMat[tile.special];
      p.ice.visible = p.frost.visible = !!tile.ice;
      p.ice.scale.setScalar(1);
      p.frost.scale.setScalar(1);
    }
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
        this.place(this.acquire(ref.id, ref.tile), r, c);
      }),
    );
    this.drag = null;
    this.dragOffset = 0;
    this.ring.visible = false;
    for (const b of this.beams) b.visible = false;
  }

  /** Returns true iff the presenter's logical grid equals `board`. */
  matches(board: StableBoard): boolean {
    return JSON.stringify(gridRows(this.grid)) === JSON.stringify(boardToRows(board));
  }

  // ---------- input feedback ----------
  /** Frame the selected row and (when columns can move) the selected column. -1 hides. */
  setHighlight(row: number, col: number, rowStrength: number, colStrength = rowStrength): void {
    this.highlightRow = row;
    this.highlightCol = col;
    this.highlightTarget = row < 0 ? 0 : rowStrength;
    this.colHighlightTarget = col < 0 ? 0 : colStrength;
    if (row >= 0) this.highlight.position.z = boardToWorld(row, 0).z;
    if (col >= 0) this.colHighlight.position.x = boardToWorld(0, col).x;
  }

  setDragOffset(line: DragLine | null, offset: number): void {
    if (this.drag && (!line || this.drag.line !== line.line || this.drag.index !== line.index)) this.layoutLine(this.drag, 0);
    this.drag = line;
    this.dragOffset = line ? offset : 0;
    if (line) this.layoutLine(line, offset);
  }

  /** Spring a cancelled drag back to rest. */
  async releaseDrag(): Promise<void> {
    const line = this.drag;
    const from = this.dragOffset;
    this.drag = null;
    this.dragOffset = 0;
    if (!line || from === 0) return;
    const token = this.token;
    await this.tw.to(this.dur(0.16), (t) => {
      if (token === this.token) this.layoutLine(line, from * (1 - t));
    }, ease.outBack);
  }

  private layoutLine(line: DragLine, offset: number): void {
    for (let k = 0; k < 6; k++) {
      const r = line.line === 'row' ? line.index : k;
      const c = line.line === 'row' ? k : line.index;
      const ref = this.grid[r]?.[c];
      const p = ref && this.pieces.get(ref.id);
      if (!p) continue;
      const w = boardToWorld(r, c);
      if (line.line === 'row') p.group.position.x = w.x + offset;
      else p.group.position.z = w.z + offset;
    }
  }

  private dur(s: number): number {
    return this.reducedMotion ? s * 0.12 : s;
  }

  // ---------- turn playback ----------
  async play(events: TurnEvent[], startProgress: Progress, hooks: PlayHooks): Promise<'done' | 'cancelled'> {
    const running = cloneProgress(startProgress);
    const token = ++this.token;
    const alive = () => token === this.token;
    const { steps, grid } = buildTimeline(this.grid, events, this.ids);
    const startOffset = this.dragOffset;
    this.drag = null;
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
          for (const pc of step.removed) if (pc.tile.kind === 'parcel') running.collected[pc.tile.color]++;
          running.cratesCleared += step.crateHits.filter((h) => h.hp <= 0).length;
          running.iceBroken += step.thawed.length;
          hooks.onProgress(cloneProgress(running));
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
          hooks.onProgress(step.progress);
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
    const m: Move = step.move;
    const isRow = m.line === 'row';
    const dir = m.direction === 'left' || m.direction === 'up' ? -1 : 1;
    const D = this.dur(0.2);
    const cellAt = (k: number) => (isRow ? boardToWorld(m.index, k) : boardToWorld(k, m.index));
    const axis = (w: { x: number; z: number }) => (isRow ? w.x : w.z);
    const setAxis = (p: Piece, v: number) => {
      if (isRow) p.group.position.x = v;
      else p.group.position.z = v;
    };
    const jobs: Promise<unknown>[] = [];
    step.order.forEach((id, newK) => {
      const p = this.pieces.get(id);
      if (!p) return;
      const target = axis(cellAt(newK));
      if (id === step.wrapId) {
        // leave through one edge, re-enter from the other (clear wrap visual)
        const oldK = dir < 0 ? 0 : 5;
        const fromV = axis(cellAt(oldK)) + startOffset;
        const outV = axis(cellAt(oldK)) + dir * 0.9;
        const inV = target - dir * 0.9;
        jobs.push(
          this.tw
            .to(D / 2, (t) => {
              setAxis(p, fromV + (outV - fromV) * t);
              p.group.scale.setScalar(1 - 0.85 * t);
            }, ease.linear)
            .then((ok) =>
              ok
                ? this.tw.to(D / 2, (t) => {
                    setAxis(p, inV + (target - inV) * t);
                    p.group.scale.setScalar(0.15 + 0.85 * t);
                  }, ease.outCubic)
                : false,
            ),
        );
      } else {
        const from = target - dir + startOffset;
        jobs.push(
          this.tw.to(D, (t) => {
            setAxis(p, from + (target - from) * t);
            const tilt = this.reducedMotion ? 0 : dir * 0.12 * Math.sin(t * Math.PI);
            if (isRow) p.group.rotation.z = -tilt;
            else p.group.rotation.x = tilt;
          }, ease.outBack),
        );
      }
    });
    return Promise.all(jobs);
  }

  private animRemove(step: Extract<TimelineStep, { kind: 'remove' }>): Promise<unknown> {
    const D = this.dur(0.18);
    playSfx(step.cascadeIndex >= 2 || step.blasts.length > 0 ? 'combo' : 'pop', Math.max(step.cascadeIndex, step.blasts.length + 1));
    if ((step.cascadeIndex >= 2 || step.blasts.length > 0) && !this.reducedMotion) this.shockwave();
    for (const b of step.blasts) this.blastFx(b.special, b.origin);
    const total = step.removed.length + step.crateHits.length + step.thawed.length;
    const perPiece = Math.max(1, Math.floor(this.particleCap / Math.max(1, total)));
    const pop = (p: Piece, at: { r: number; c: number }, hex: string) =>
      this.tw
        .to(D, (t) => {
          // 0.9 squash -> 1.1 swell -> vanish
          const s = t < 0.35 ? 1 - 0.1 * (t / 0.35) : t < 0.6 ? 0.9 + 0.25 * ((t - 0.35) / 0.25) : 1.15 * (1 - (t - 0.6) / 0.4);
          p.group.scale.set(s, t < 0.35 ? s * 0.92 : s, s);
        }, ease.linear)
        .then(() => {
          const w = boardToWorld(at.r, at.c);
          this.burst(w.x, w.z, hex, perPiece);
          this.release(p);
        });
    const jobs: Promise<unknown>[] = step.removed.map(({ id, tile, at }) => {
      const p = this.pieces.get(id);
      if (!p) return Promise.resolve(true);
      return pop(p, at, tile.kind === 'parcel' ? PARCEL_HEX[tile.color] : CRATE_HEX);
    });
    for (const h of step.crateHits) {
      const p = this.pieces.get(h.id);
      if (!p) continue;
      if (h.hp <= 0) {
        jobs.push(pop(p, h.at, CRATE_HEX));
        continue;
      }
      // damaged: knock + swap to the 1-hp lid
      jobs.push(
        this.tw.to(D, (t) => {
          p.group.rotation.y = this.reducedMotion ? 0 : Math.sin(t * Math.PI * 3) * 0.15 * (1 - t);
          p.group.scale.setScalar(1 - 0.12 * Math.sin(t * Math.PI));
          if (t >= 0.5 && p.tile.kind === 'crate' && p.tile.hp !== h.hp) this.applyTile(p, { kind: 'crate', hp: h.hp });
        }, ease.linear),
      );
      const w = boardToWorld(h.at.r, h.at.c);
      this.burst(w.x, w.z, CRATE_HEX, Math.max(1, perPiece >> 1));
    }
    for (const th of step.thawed) {
      const p = this.pieces.get(th.id);
      if (!p || p.tile.kind !== 'parcel') continue;
      const { ice: _ice, ...thawedTile } = p.tile;
      jobs.push(
        this.tw
          .to(D, (t) => {
            p.ice.scale.setScalar(1 + 0.25 * t);
            p.frost.scale.setScalar(1 + 0.25 * t);
          }, ease.outCubic)
          .then(() => this.applyTile(p, thawedTile)),
      );
      const w = boardToWorld(th.at.r, th.at.c);
      this.burst(w.x, w.z, ICE_HEX, perPiece);
    }
    for (const cr of step.created) {
      const p = this.pieces.get(cr.id);
      if (!p || p.tile.kind !== 'parcel') continue;
      const tile: Tile = { kind: 'parcel', color: p.tile.color, special: cr.special };
      jobs.push(
        this.tw.to(this.dur(0.26), (t) => {
          if (t >= 0.3 && p.badge.visible === false) this.applyTile(p, tile);
          p.group.scale.setScalar(1 + 0.25 * Math.sin(t * Math.PI));
          p.group.rotation.y = this.reducedMotion ? 0 : t * Math.PI * 2;
        }, ease.outCubic).then(() => {
          p.group.rotation.y = 0;
          this.applyTile(p, tile);
        }),
      );
    }
    return Promise.all(jobs);
  }

  /** Rocket beam across a line, or a ring for a bomb. Visual only. */
  private blastFx(kind: 'rocketRow' | 'rocketCol' | 'bomb', origin: { r: number; c: number }): void {
    const w = boardToWorld(origin.r, origin.c);
    if (kind === 'bomb') {
      this.shockwave(w.x, w.z, 1.6);
      return;
    }
    const beam = this.beams.find((b) => !b.visible);
    if (!beam) return;
    beam.visible = true;
    const mat = beam.material as THREE.MeshBasicMaterial;
    const horizontal = kind === 'rocketRow';
    beam.position.x = horizontal ? 0 : w.x;
    beam.position.z = horizontal ? w.z : 0;
    void this.tw.to(this.dur(0.32), (t) => {
      const len = 6.4 * Math.min(1, t * 2.2);
      const thick = 0.75 * (1 - t) + 0.12;
      beam.scale.set(horizontal ? len : thick, 1, horizontal ? thick : len);
      mat.opacity = 0.85 * (1 - t);
      if (t >= 1) beam.visible = false;
    }, ease.outCubic);
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
    const jobs = step.pieces.map(({ id, tile, at, dropDistance }) => {
      const p = this.acquire(id, tile);
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

  private shockwave(x = 0, z = 0, size = 4): void {
    this.ring.visible = true;
    this.ring.position.x = x;
    this.ring.position.z = z;
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    void this.tw.to(0.45, (t) => {
      this.ring.scale.setScalar(0.5 + t * size);
      mat.opacity = 0.7 * (1 - t);
      if (t >= 1) this.ring.visible = false;
    }, ease.outCubic);
  }

  private burst(x: number, z: number, hex: string, n: number): void {
    tmpColor.set(hex);
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
    const cmat = this.colHighlight.material as THREE.MeshBasicMaterial;
    cmat.opacity += (this.colHighlightTarget - cmat.opacity) * Math.min(1, d * 14);
    this.colHighlight.visible = cmat.opacity > 0.01 && this.highlightCol >= 0;

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
