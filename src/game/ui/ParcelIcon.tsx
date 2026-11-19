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

/** DOM icon for a taped crate obstacle (matches the 3D crate lid). */
export function CrateIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="膠帶箱" className="parcel-icon">
      <rect x="6" y="14" width="88" height="80" rx="14" fill="#7A5230" />
      <rect x="6" y="6" width="88" height="80" rx="14" fill="#C89A63" />
      <path d="M14 14 L86 78 M86 14 L14 78" stroke="#F5E1AA" strokeWidth="14" strokeLinecap="round" />
      <circle cx="50" cy="46" r="15" fill="#5B3B22" />
    </svg>
  );
}

/** DOM icon for a frozen parcel. */
export function IceIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="冰凍箱" className="parcel-icon">
      <rect x="6" y="14" width="88" height="80" rx="18" fill="#6FB6D3" />
      <rect x="6" y="6" width="88" height="80" rx="18" fill="#CDEFFC" />
      <path d="M50 18 V74 M26 32 L74 60 M74 32 L26 60" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <rect x="10" y="10" width="80" height="72" rx="15" fill="none" stroke="#fff" strokeWidth="5" opacity="0.8" />
    </svg>
  );
}

/** Icon for any objective type. */
export function GoalIcon({ type, color, size = 36 }: { type: 'collectColor' | 'clearCrates' | 'breakIce'; color?: Color; size?: number }) {
  if (type === 'clearCrates') return <CrateIcon size={size} />;
  if (type === 'breakIce') return <IceIcon size={size} />;
  return <ParcelIcon color={color ?? 'R'} size={size} />;
}

export function goalName(type: 'collectColor' | 'clearCrates' | 'breakIce', color?: Color): string {
  if (type === 'clearCrates') return '拆除膠帶箱';
  if (type === 'breakIce') return '解凍冰凍箱';
  return color ? PARCEL_NAME_FOR_GOAL[color] : '';
}
const PARCEL_NAME_FOR_GOAL = PARCEL_NAME;
