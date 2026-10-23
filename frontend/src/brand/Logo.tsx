import geometry from "./geometry.json";
import { SITE_EXPANDED_NAME, SITE_NAME, SITE_SLOGAN, SITE_X_URL } from "../config";

// The STEPS marks drawn from the same geometry as brand/svg. Decorative here: the surrounding
// link or text carries the accessible name, so the SVGs are hidden from assistive technology.
const earlier = geometry.symbol.earlier.join("");

export function BrandSymbol({ size = 20 }: { size?: number }) {
  return <svg className="brand-symbol" width={size} height={size} viewBox={geometry.symbol.viewBox} aria-hidden="true" focusable="false">
    <path fill="currentColor" d={earlier}/><path fill="var(--color-action)" d={geometry.symbol.latest}/>
  </svg>;
}

/** Horizontal lockup: symbol at 1.5x beside the 24-unit wordmark (same layout as steps-lockup.svg). */
export function BrandLockup({ height = 28 }: { height?: number }) {
  return <svg className="brand-lockup" width={Math.round(height * 151 / 36)} height={height} viewBox="0 0 151 36" aria-hidden="true" focusable="false">
    <g transform="translate(-7.5 -6) scale(1.5)"><path fill="currentColor" d={earlier}/><path fill="var(--color-action)" d={geometry.symbol.latest}/></g>
    <path transform="translate(45 6)" fill="currentColor" fillRule="evenodd" d={geometry.wordmark.path}/>
  </svg>;
}

export const BRAND = { name: SITE_NAME, expanded: SITE_EXPANDED_NAME, slogan: SITE_SLOGAN, x: { url: SITE_X_URL, handle: "@stepstoke" } };
