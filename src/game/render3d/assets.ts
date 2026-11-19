/** Shared geometries / materials / canvas textures. Created once, reused by every parcel. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, type Color } from '../engine';
import { PARCEL_HEX, PARCEL_INK, PARCEL_SYMBOL } from '../../shared/parcelStyle';
import { PARCEL_H, PARCEL_W } from './coords';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function lighten(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), amt);
  return `#${c.getHexString()}`;
}

/** Top face: packing tape strip + white stamp symbol with ink outline. */
function topTexture(color: Color): THREE.CanvasTexture {
  const S = 256;
  const [cv, ctx] = canvas(S);
  ctx.clearRect(0, 0, S, S);
  // tape strip front-to-back
  ctx.fillStyle = lighten(PARCEL_HEX[color], 0.42);
  ctx.globalAlpha = 0.85;
  ctx.fillRect(S * 0.38, 0, S * 0.24, S);
  ctx.globalAlpha = 1;
  // symbol
  const sym = PARCEL_SYMBOL[color];
  ctx.save();
  const k = (S * 0.56) / 100;
  ctx.translate(S * 0.22, S * 0.22);
  ctx.scale(k, k);
  const fill = new Path2D(sym.fill);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = PARCEL_INK[color];
  ctx.lineWidth = 11;
  ctx.stroke(fill);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(fill);
  if (sym.detail) {
    ctx.lineWidth = 6;
    ctx.stroke(new Path2D(sym.detail));
  }
  ctx.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Front face: small shipping label with barcode lines (decorative, identical for all colours). */
function labelTexture(): THREE.CanvasTexture {
  const [cv, ctx] = canvas(128);
  ctx.fillStyle = '#FFFBF3';
  ctx.beginPath();
  ctx.roundRect(4, 34, 120, 60, 10);
  ctx.fill();
  ctx.fillStyle = '#493B36';
  let x = 16;
  for (const w of [3, 2, 5, 2, 3, 4, 2, 5, 3, 2]) {
    ctx.fillRect(x, 48, w, 26);
    x += w + 3;
  }
  ctx.fillRect(80, 48, 32, 6);
  ctx.fillRect(80, 60, 24, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobTexture(): THREE.CanvasTexture {
  const [cv, ctx] = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  g.addColorStop(0, 'rgba(90,60,40,0.55)');
  g.addColorStop(1, 'rgba(90,60,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

function slotTexture(): THREE.CanvasTexture {
  const [cv, ctx] = canvas(128);
  ctx.fillStyle = '#E7C998';
  ctx.beginPath();
  ctx.roundRect(6, 6, 116, 116, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,100,60,0.25)';
  ctx.lineWidth = 4;
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SharedAssets {
  boxGeo: THREE.BufferGeometry;
  topGeo: THREE.PlaneGeometry;
  labelGeo: THREE.PlaneGeometry;
  blobGeo: THREE.PlaneGeometry;
  boxMat: Record<Color, THREE.MeshStandardMaterial>;
  topMat: Record<Color, THREE.MeshStandardMaterial>;
  labelMat: THREE.MeshStandardMaterial;
  blobMat: THREE.MeshBasicMaterial;
  slotMat: THREE.MeshStandardMaterial;
  dispose(): void;
}

export function createAssets(): SharedAssets {
  const boxGeo = new RoundedBoxGeometry(PARCEL_W, PARCEL_H, PARCEL_W, 3, 0.12);
  const topGeo = new THREE.PlaneGeometry(PARCEL_W * 0.8, PARCEL_W * 0.8);
  topGeo.rotateX(-Math.PI / 2);
  const labelGeo = new THREE.PlaneGeometry(PARCEL_W * 0.46, PARCEL_W * 0.46);
  const blobGeo = new THREE.PlaneGeometry(1.15, 1.15);
  blobGeo.rotateX(-Math.PI / 2);

  const boxMat = {} as Record<Color, THREE.MeshStandardMaterial>;
  const topMat = {} as Record<Color, THREE.MeshStandardMaterial>;
  for (const c of COLORS) {
    boxMat[c] = new THREE.MeshStandardMaterial({ color: PARCEL_HEX[c], roughness: 0.62, metalness: 0 });
    topMat[c] = new THREE.MeshStandardMaterial({
      map: topTexture(c),
      transparent: true,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      depthWrite: false,
    });
  }
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
  const slotMat = new THREE.MeshStandardMaterial({ map: slotTexture(), transparent: true, roughness: 0.9 });

  return {
    boxGeo,
    topGeo,
    labelGeo,
    blobGeo,
    boxMat,
    topMat,
    labelMat,
    blobMat,
    slotMat,
    dispose() {
      [boxGeo, topGeo, labelGeo, blobGeo].forEach((g) => g.dispose());
      for (const c of COLORS) {
        boxMat[c].dispose();
        topMat[c].map?.dispose();
        topMat[c].dispose();
      }
      [labelMat, blobMat, slotMat].forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
  };
}
