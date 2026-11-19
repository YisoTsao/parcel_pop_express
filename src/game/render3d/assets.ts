/** Shared geometries / materials / canvas textures. Created once, reused by every parcel. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, type Color, type Special } from '../engine';
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

/** Special-crate overlay: bold white arrows / bomb with dark outline, readable on any colour. */
function specialTexture(kind: Special): THREE.CanvasTexture {
  const S = 256;
  const [cv, ctx] = canvas(S);
  ctx.clearRect(0, 0, S, S);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // dark rounded badge so the stamp underneath is replaced by a clear "special" sign
  ctx.fillStyle = 'rgba(52, 38, 60, 0.82)';
  ctx.beginPath();
  ctx.roundRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76, S * 0.18);
  ctx.fill();
  ctx.strokeStyle = '#FFE58A';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  const arrow = (horizontal: boolean) => {
    ctx.save();
    ctx.translate(S / 2, S / 2);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    const L = S * 0.27;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(-L + 18, 0);
    ctx.lineTo(L - 18, 0);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * L, 0);
      ctx.lineTo(s * (L - 34), -30);
      ctx.lineTo(s * (L - 34), 30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  if (kind === 'rocketRow') arrow(true);
  else if (kind === 'rocketCol') arrow(false);
  else {
    ctx.beginPath();
    ctx.arc(S * 0.47, S * 0.56, S * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(S * 0.58, S * 0.4);
    ctx.quadraticCurveTo(S * 0.64, S * 0.28, S * 0.72, S * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#FFD45E';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = i % 2 ? 9 : 22;
      ctx.lineTo(S * 0.74 + Math.cos(a) * rr, S * 0.27 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Taped crate lid: hp 2 = crossed tape, hp 1 = one torn strip. Big numeral for clarity. */
function crateTopTexture(hp: 1 | 2): THREE.CanvasTexture {
  const S = 256;
  const [cv, ctx] = canvas(S);
  ctx.fillStyle = '#C89A63';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(120, 80, 40, 0.35)';
  ctx.lineWidth = 3;
  for (let y = 18; y < S; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + 6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(245, 225, 170, 0.92)';
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-S, -24, S * 2, 48);
  if (hp === 2) {
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-S, -24, S * 2, 48);
  }
  ctx.restore();
  ctx.fillStyle = '#5B3B22';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF4DC';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(hp), S / 2, S / 2 + 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Frost pattern for the ice shell's lid. */
function frostTexture(): THREE.CanvasTexture {
  const S = 256;
  const [cv, ctx] = canvas(S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [
    [30, 40, 120, 110],
    [120, 110, 100, 200],
    [120, 110, 220, 70],
    [160, 180, 230, 220],
    [40, 200, 90, 160],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0!, y0!);
    ctx.lineTo(x1!, y1!);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, S - 20, S - 20);
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
  specialMat: Record<Special, THREE.MeshStandardMaterial>;
  crateMat: THREE.MeshStandardMaterial;
  crateTopMat: Record<1 | 2, THREE.MeshStandardMaterial>;
  iceGeo: THREE.BufferGeometry;
  iceMat: THREE.MeshStandardMaterial;
  frostMat: THREE.MeshStandardMaterial;
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
  const overlay = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const specialMat: Record<Special, THREE.MeshStandardMaterial> = {
    rocketRow: overlay(specialTexture('rocketRow')),
    rocketCol: overlay(specialTexture('rocketCol')),
    bomb: overlay(specialTexture('bomb')),
  };
  const crateMat = new THREE.MeshStandardMaterial({ color: '#B98552', roughness: 0.85 });
  const crateTopMat = { 1: overlay(crateTopTexture(1)), 2: overlay(crateTopTexture(2)) };
  crateTopMat[1].transparent = crateTopMat[2].transparent = false;
  const iceGeo = new RoundedBoxGeometry(PARCEL_W + 0.1, PARCEL_H + 0.1, PARCEL_W + 0.1, 3, 0.14);
  const iceMat = new THREE.MeshStandardMaterial({ color: '#BFEFFF', transparent: true, opacity: 0.5, roughness: 0.08, metalness: 0.05, depthWrite: false });
  const frostMat = overlay(frostTexture());

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
    specialMat,
    crateMat,
    crateTopMat,
    iceGeo,
    iceMat,
    frostMat,
    dispose() {
      iceGeo.dispose();
      [boxGeo, topGeo, labelGeo, blobGeo].forEach((g) => g.dispose());
      for (const c of COLORS) {
        boxMat[c].dispose();
        topMat[c].map?.dispose();
        topMat[c].dispose();
      }
      [labelMat, blobMat, slotMat, crateMat, iceMat, frostMat, crateTopMat[1], crateTopMat[2], ...Object.values(specialMat)].forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
  };
}
