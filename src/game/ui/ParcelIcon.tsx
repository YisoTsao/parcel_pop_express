import type { Color } from '../engine';
import { PARCEL_HEX, PARCEL_INK, PARCEL_NAME, PARCEL_SYMBOL } from '../../shared/parcelStyle';

/** DOM version of a parcel: same colour + stamp symbol as the 3D texture. */
export function ParcelIcon({ color, size = 36 }: { color: Color; size?: number }) {
  const sym = PARCEL_SYMBOL[color];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={PARCEL_NAME[color]} className="parcel-icon">
      <rect x="6" y="14" width="88" height="80" rx="18" fill={PARCEL_INK[color]} />
      <rect x="6" y="6" width="88" height="80" rx="18" fill={PARCEL_HEX[color]} />
      <rect x="40" y="6" width="20" height="80" fill="#fff" opacity="0.35" />
      <g transform="translate(23 19) scale(0.54)">
        <path d={sym.fill} fill="#fff" stroke={PARCEL_INK[color]} strokeWidth="10" strokeLinejoin="round" paintOrder="stroke" />
        {sym.detail && <path d={sym.detail} fill="none" stroke={PARCEL_INK[color]} strokeWidth="7" strokeLinecap="round" />}
      </g>
    </svg>
  );
}
