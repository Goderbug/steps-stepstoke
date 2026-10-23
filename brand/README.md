# STEPS · Stepstoke

STEPS is the primary display name; Stepstoke is the expanded brand. The official X destination is [@stepstoke](https://x.com/stepstoke). Nothing in the site posts to X.

**Build on every step.** This four-word slogan describes a workspace where people and agents propose work, explicitly fund execution, inspect outputs and continue or fork accepted history. Use it at entry and on the share card, without adding a large workspace hero. The identity makes no investment, quality or fully-onchain claims.

## Primary direction: Joined Steps

Three offset treads join into a compact, stepped S. Ink carries the earlier contribution; the vermillion segment leaves a visible place for what comes next. Rounded outside turns and square internal joints echo the platform's precise, warm workspace. The custom five-letter wordmark repeats those terminals with an open, even rhythm. This is original geometric artwork, not lettering from a font, a growth chart, token or robot.

The accepted checkout already contained this coherent direction. This delivery finishes its documentation and verifies its integration against the final runtime. Geometry is editable in `frontend/src/brand/geometry.json`; both React marks and portable SVGs derive from it. No project artwork or authenticated file is rebranded.

Two alternatives considered internally: **Open seam**, offset page corners showing an unfinished joint (clear continuation, but too close to a file icon); **Shared margin**, interlocking marginal marks (collaboration, but less legible at 16px). Joined Steps wins for its S silhouette, compact proportions and explicit earlier/next relationship. These are recorded alternatives, not pending choices.

## Asset inventory and use

| Assets | Use |
| --- | --- |
| `svg/steps-lockup.svg` | Primary transparent horizontal symbol + outlined STEPS; header, documents |
| `svg/steps-lockup-mono.svg` | Single ink color, transparent; printing, stamps, constrained reproduction |
| `svg/steps-lockup-reversed.svg` | White wordmark and earlier treads, vermillion next tread, transparent; supplied for dark external placements only |
| `svg/steps-symbol{,-mono,-reversed}.svg` | Standalone 32-unit symbol; retain the internal gaps |
| `svg/steps-wordmark{,-reversed}.svg` | Portable outlined STEPS lettering, transparent |
| `svg/steps-favicon.svg`, `png/favicon-{16,32}.png` | Optically redrawn 16-unit mark; local favicon |
| `svg/steps-avatar.svg`, `png/steps-avatar-512.png` | 512×512 square paper composition with circular-crop clearance |
| `svg/steps-social.svg`, `png/og.png` | Editable 1200×630 share composition and complete raster; outlined copy |
| `png/steps-lockup-604.png` | Transparent 604×144 PNG for raster-only placement |
| `png/apple-touch-icon.png` | 180×180 browser touch icon |

`docs/validation/steps-brand-v1/assets-sha256.json` inventories exact delivered sizes and hashes. Runtime copies are `frontend/public/{favicon.svg,favicon-16.png,favicon-32.png,apple-touch-icon.png,og.svg,og.png}`, copied into `dist/`. Use relative URLs below gateway subpaths. No production domain or canonical URL has been invented. Relative OG image URLs await a known host for platform-specific absolute URL unfurl requirements.

## Geometry, color and clear space

The symbol uses a 32×32 viewBox, six-unit strokes and rounded outer corners. The lockup is 151×36 with 24-unit capital height and a 45-unit wordmark offset. Keep at least six viewBox units clear around the lockup; never squeeze or rotate it. At small display sizes prefer the dedicated favicon or symbol. The UI lockup is 28px high (about 117px wide), 24px at the narrowest breakpoint; use at least 100px width for standalone lockups. Use the 16-unit favicon for 16px/32px raster output.

Colors match Open Workshop: ink `#22231F`, action `#C1452A`, paper `#F6F5F1`, white `#FFFFFF`. The social composition also uses secondary `#666961` and border `#DDDCD4`. Monochrome uses ink only. Reversed assets are transparent supplied variants, not a new site theme. Use them on a solid ink surface; do not introduce a dark application theme. Keep the vermillion segment in the primary mark. Do not put gradients, shadows, slogans inside the wordmark or project-specific art behind it.

## Accessibility and portability

All SVG exports contain only local vector geometry and semantic titles, with explicit fills and dimensions. No scripts, links, `foreignObject`, external fonts, remote resources or SVG text nodes are present. The wordmark is outlined. In the UI, decorative SVGs are hidden from assistive technology and the home link has the semantic name “STEPS home”; the footer spells out “STEPS by Stepstoke.” The external X link names its new-tab behavior and uses `noopener noreferrer`.

## Local typography and reproduction

The wordmark is custom path geometry: no font dependency or font license applies to its letters. The application retains its system stack, Arial / Helvetica / sans-serif, with Courier New / Courier / monospace for identifiers; it downloads no fonts. System fallback rendering depends on the reader's installed fonts.

Only the share-card supporting copy and slogan were outlined from locally installed Liberation Sans 2.1.5, Regular and Bold, SIL OFL 1.1. Copyright and license provenance are retained in `licenses/Liberation-Fonts-OFL.txt`; exact local font SHA-256 values are in `source/font-provenance.json`. No font files or runtime font service are required. Outlined copy is committed in `source/text-outlines.json`.

Rebuild vectors without dependencies:

```sh
node brand/tools/build-brand.mjs
```

Rebuild PNGs locally after frontend installation and Playwright Chromium provisioning:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/steps-browsers node brand/tools/rasterize.mjs
```

`ffmpeg` optionally reduces the flat-color social/avatar PNG palette. Regenerating outlines is only necessary for changed social copy: install `opentype.js@1.3.4` outside the repository, pass its folder through `OPENTYPE_DIR`, then run `brand/tools/outline-text.mjs`. Inspect the outputs, rebuild the website and rerun affected checks after asset changes. Do not commit that tooling's dependency directories.
