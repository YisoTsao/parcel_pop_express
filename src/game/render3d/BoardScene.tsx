import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/gameStore';
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
    const start = store.hud?.collected ?? { R: 0, B: 0, G: 0, Y: 0 };
    let cancelled = false;
    void view
      .play(pending.events, start, {
        onShift: () => useGame.getState().onHudMoves(pending.id, pending.nextState.remainingMoves),
        onObjectives: (c) => useGame.getState().onHudObjectives(pending.id, c),
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

  // Row highlight follows selection when idle.
  const selectedRow = useGame((s) => s.selectedRow);
  const phase = useGame((s) => s.phase);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) view.setHighlight(phase === 'idle' ? selectedRow : -1, 0.55);
  }, [selectedRow, phase, view]);

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
    let drag: { id: number; row: number; x: number; y: number; axis: 'h' | 'v' | null } | null = null;

    const pickRow = (e: PointerEvent): number | null => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return worldToCell(hit.x, hit.z)?.r ?? null;
    };
    const canInput = () => {
      const s = useGame.getState();
      return s.phase === 'idle' && s.game?.status === 'ready' && s.screen === 'playing';
    };
    const worldPerPx = () => 1 / ((camera as THREE.OrthographicCamera).zoom || 1);

    const cancel = () => {
      if (!drag) return;
      drag = null;
      dragging.current = false;
      void view.releaseDrag();
      const s = useGame.getState();
      view.setHighlight(s.phase === 'idle' ? s.selectedRow : -1, 0.55);
    };

    const down = (e: PointerEvent) => {
      unlockAudio();
      if (drag || !canInput() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const row = pickRow(e);
      if (row === null) return;
      drag = { id: e.pointerId, row, x: e.clientX, y: e.clientY, axis: null };
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
      useGame.getState().selectRow(row);
      view.setHighlight(row, 1);
      playSfx('tap');
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!canInput()) return cancel();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 8) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (drag.axis === 'h') view.setDragOffset(drag.row, previewOffset(dx * worldPerPx()));
      else if (drag.axis === 'v') view.setDragOffset(drag.row, 0);
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      const dir = inside && d.axis === 'h' ? decideSwipe(e.clientX - d.x, e.clientY - d.y) : null;
      if (dir && canInput()) {
        drag = null;
        dragging.current = false;
        view.setHighlight(d.row, 1);
        if (!useGame.getState().submitMove({ row: d.row, direction: dir })) void view.releaseDrag();
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
