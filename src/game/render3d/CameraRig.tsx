import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { boardToWorld, PARCEL_H } from './coords';
import { useLayout } from './layoutStore';

const CAM_POS = new THREE.Vector3(0, 9.5, 8.6);
const TARGET = new THREE.Vector3(0, 0, 0);
/** Board footprint incl. tray rim, plus horizontal room for the DOM row arrows. */
const HALF_W = 3.5;
const SIDE_MARGIN = 0.32;
const VERT_MARGIN = 0.15;

/**
 * Orthographic, slight-tilt camera that always fits the full tray (never crops the outer
 * ring), recomputed on resize. Also publishes per-row screen anchors for the DOM HUD.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setRows = useLayout((s) => s.set);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.copy(CAM_POS);
    camera.up.set(0, 1, 0);
    camera.lookAt(TARGET);
    camera.near = 0.1;
    camera.far = 100;
    camera.updateMatrixWorld(true);

    // Extents of the tray in camera space (zoom-independent).
    const inv = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [-HALF_W, HALF_W])
      for (const y of [-0.5, PARCEL_H + 0.05])
        for (const z of [-HALF_W, HALF_W]) {
          v.set(x, y, z).applyMatrix4(inv);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
    const needW = maxX - minX + SIDE_MARGIN * 2;
    const needH = maxY - minY + VERT_MARGIN * 2;
    const zoom = Math.max(10, Math.min(size.width / needW, size.height / needH));
    // centre the tray: shift the camera in its own plane
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.copy(CAM_POS).addScaledVector(right, cx).addScaledVector(up, cy);
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const toScreen = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    const rows = Array.from({ length: 6 }, (_, r) => {
      const z = boardToWorld(r, 0).z;
      const l = toScreen(-3.5, PARCEL_H / 2, z);
      const rr = toScreen(3.5, PARCEL_H / 2, z);
      const a = toScreen(0, PARCEL_H / 2, z - 0.5);
      const b = toScreen(0, PARCEL_H / 2, z + 0.5);
      return { y: (l.y + rr.y) / 2, left: l.x, right: rr.x, height: Math.abs(b.y - a.y) };
    });
    setRows(rows);
  }, [camera, size.width, size.height, setRows]);

  return null;
}
