import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/gameStore';
import type { Move } from '../engine';
import { createAssets } from './assets';
import { BoardView } from './BoardView';
import { decideSwipe, previewOffset } from './gesture';
import { PARCEL_H, worldToCell } from './coords';
import type { QualityProfile } from './quality';
import { unlockAudio, playSfx } from '../../shared/audio';

/**
 * Mounts the imperative BoardView, wires it to the store (session resets, pending turns)
 * and handles pointer input. Holds no rule logic: input becomes a Move, the store calls
 * applyMove once, and the view only plays the returned events.
 */
export function BoardScene({ profile, reducedMotion }: { profile: QualityProfile; reducedMotion: boolean }) {
  const assets = useMemo(() => createAssets(), []);
  const view = useMemo(() => new BoardView(assets), [assets]);
  useEffect(() => () => {
    view.dispose();
    assets.dispose();
  }, [view, assets]);

  useEffect(() => view.setQuality(profile), [view, profile]);
  useEffect(() => view.setReducedMotion(reducedMotion), [view, reducedMotion]);

  // Reset on new session (start / restart / level change).
  const session = useGame((s) => s.session);
  useEffect(() => {
    const g = useGame.getState().game;
    if (g) view.reset(g.board);
  }, [session, view]);

  // Play a committed turn.
  const pending = useGame((s) => s.pending);
  const firstPending = useRef(true);
  useEffect(() => {
    if (!pending) {
      firstPending.current = false;
      return;
    }
    if (firstPending.current) {
      // Canvas (re)mounted mid-turn (e.g. quality change): the board was already reset to
      // the committed state, so just complete the turn instead of replaying stale events.
      firstPending.current = false;
      view.reset(pending.nextState.board);
      useGame.getState().finishTurn(pending.id);
      return;
    }
    const store = useGame.getState();
    const start = store.hud?.counters ?? { collected: { R: 0, B: 0, G: 0, Y: 0 }, cratesCleared: 0, iceBroken: 0 };
    let cancelled = false;
    void view
      .play(pending.events, start, {
        onShift: () => useGame.getState().onHudMoves(pending.id, pending.nextState.remainingMoves),
        onProgress: (p) => useGame.getState().onHudProgress(pending.id, p),
        onCombo: (n) => useGame.getState().onCombo(pending.id, n),
      })
      .catch((err: unknown) => {
        console.error('[presenter] timeline failed; hard-syncing', err);
        return 'done' as const;
      })
      .then((res) => {
        if (cancelled || res !== 'done') return;
        if (!view.matches(pending.nextState.board)) {
          console.error('[presenter] grid diverged from engine state; hard-syncing');
          view.reset(pending.nextState.board);
        }
        useGame.getState().finishTurn(pending.id);
      });
    return () => {
      cancelled = true;
    };
  }, [pending, view]);

  // Row (and column) frames follow the selection when idle.
  const selected = useGame((s) => s.selected);
  const phase = useGame((s) => s.phase);
  const allowCols = useGame((s) => s.game?.allowColumnMoves ?? false);
  const dragging = useRef(false);
  useEffect(() => {
    if (dragging.current) return;
    const idle = phase === 'idle';
    view.setHighlight(idle ? selected.r : -1, idle && allowCols ? selected.c : -1, 0.55, 0.4);
  }, [selected, phase, allowCols, view]);

  useFrame((_, dt) => view.update(dt));

  // ---------- pointer input ----------
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PARCEL_H / 2);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    let drag: { id: number; r: number; c: number; x: number; y: number; hx: number; hz: number; axis: 'h' | 'v' | null } | null = null;

    const pick = (e: PointerEvent): { r: number; c: number; x: number; z: number } | null => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const cell = worldToCell(hit.x, hit.z);
      return cell ? { ...cell, x: hit.x, z: hit.z } : { r: -1, c: -1, x: hit.x, z: hit.z };
    };
    const canInput = () => {
      const s = useGame.getState();
      return s.phase === 'idle' && s.game?.status === 'ready' && s.screen === 'playing';
    };
    const colsAllowed = () => useGame.getState().game?.allowColumnMoves ?? false;
    const idleHighlight = () => {
      const s = useGame.getState();
      const idle = s.phase === 'idle';
      view.setHighlight(idle ? s.selected.r : -1, idle && colsAllowed() ? s.selected.c : -1, 0.55, 0.4);
    };

    const cancel = () => {
      if (!drag) return;
      drag = null;
      dragging.current = false;
      void view.releaseDrag();
      idleHighlight();
    };

    const down = (e: PointerEvent) => {
      unlockAudio();
      if (drag || !canInput() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const p = pick(e);
      if (!p || p.r < 0) return;
      drag = { id: e.pointerId, r: p.r, c: p.c, x: e.clientX, y: e.clientY, hx: p.x, hz: p.z, axis: null };
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
      useGame.getState().select(p.r, p.c);
      view.setHighlight(p.r, colsAllowed() ? p.c : -1, 1, 0.7);
      playSfx('tap');
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!canInput()) return cancel();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 8) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (drag.axis === 'h') view.setHighlight(drag.r, -1, 1);
        else if (colsAllowed()) view.setHighlight(-1, drag.c, 1, 1);
      }
      const p = pick(e);
      if (!p) return;
      if (drag.axis === 'h') view.setDragOffset({ line: 'row', index: drag.r }, previewOffset(p.x - drag.hx));
      else if (drag.axis === 'v' && colsAllowed()) view.setDragOffset({ line: 'col', index: drag.c }, previewOffset(p.z - drag.hz));
      else view.setDragOffset(null, 0);
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      const dir = inside && d.axis ? decideSwipe(e.clientX - d.x, e.clientY - d.y, colsAllowed()) : null;
      const horizontal = dir === 'left' || dir === 'right';
      // a swipe only counts along the axis the drag locked onto
      if (dir && canInput() && (d.axis === 'h') === horizontal) {
        drag = null;
        dragging.current = false;
        const mv: Move = dir === 'left' || dir === 'right' ? { line: 'row', index: d.r, direction: dir } : { line: 'col', index: d.c, direction: dir };
        if (!useGame.getState().submitMove(mv)) void view.releaseDrag();
      } else {
        cancel();
      }
    };
    const pcancel = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) cancel();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', pcancel);
    el.addEventListener('lostpointercapture', pcancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', pcancel);
      el.removeEventListener('lostpointercapture', pcancel);
    };
  }, [gl, camera, view]);

  return <primitive object={view.root} />;
}
