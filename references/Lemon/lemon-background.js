/**
 * LEMON SQUEEZE background — pure CSS, no images.
 * Extracted from "Face Reset - Scenes.dc.html" (SCENES.lemon.bg / .tile).
 *
 *   import { lemonBackgroundStyle } from './lemon-background';
 *   <div style={lemonBackgroundStyle} />
 */

/** Sky → sea → sand strip. The horizon lives in the 43–63% stops. */
export const LEMON_SKY_GRADIENT =
  'linear-gradient(180deg,#8fdaf3 0%,#a5e2f7 18%,#bde9f9 34%,#a8dff4 43%,#7fc9ec 50%,#65b9e6 57%,#7cc5ea 63%,#a3d7ef 67.6%,#d9ecf3 70.6%,#f1eada 72.6%,#f6eed8 100%)';

/**
 * Sparkle layers. Each is one dot tiled at its own size; the sizes are
 * mutually coprime so the overlay never shows a repeating grid.
 * x/y = dot position inside its tile, r = dot radius, f = feather edge,
 * a = opacity, w/h = tile size.
 */
export const LEMON_SPARKLES = [
  { x: '17%', y: '29%', r: 1.5,  f: 2.1, a: 0.92, w: 271, h: 197 },
  { x: '63%', y: '71%', r: 1.1,  f: 1.7, a: 0.75, w: 199, h: 143 },
  { x: '88%', y: '13%', r: 1.3,  f: 1.9, a: 0.85, w: 163, h: 251 },
  { x: '37%', y: '84%', r: 0.9,  f: 1.5, a: 0.65, w: 127, h: 109 },
  { x: '72%', y: '41%', r: 1.4,  f: 2.0, a: 0.8,  w: 233, h: 179 },
  { x: '11%', y: '62%', r: 1,    f: 1.6, a: 0.7,  w: 151, h: 217 },
  { x: '53%', y: '8%',  r: 1.2,  f: 1.8, a: 0.78, w: 181, h: 131 },
  { x: '26%', y: '47%', r: 0.85, f: 1.4, a: 0.6,  w: 107, h: 167 },
];

const sparkleLayer = (s) =>
  `radial-gradient(circle at ${s.x} ${s.y},rgba(255,255,255,${s.a}) 0 ${s.r}px,rgba(255,255,255,0) ${s.f}px) 0 0/${s.w}px ${s.h}px`;

/** Full background shorthand: sparkles over the sky gradient. */
export const LEMON_BACKGROUND = [
  ...LEMON_SPARKLES.map(sparkleLayer),
  LEMON_SKY_GRADIENT,
].join(',');

/** Thumbnail / small-tile version: gradient only, no sparkles. */
export const LEMON_BACKGROUND_TILE = LEMON_SKY_GRADIENT;

/** Ink + accent colors that pair with this background. */
export const LEMON_COLORS = { accent: '#067abb', ink: '#12483a', juice: '#f2df4a' };

export const lemonBackgroundStyle = { background: LEMON_BACKGROUND };
export const lemonBackgroundTileStyle = { background: LEMON_BACKGROUND_TILE };

/** Rebuild with a custom sparkle set (e.g. fewer layers on mobile). */
export function buildLemonBackground(sparkles = LEMON_SPARKLES, gradient = LEMON_SKY_GRADIENT) {
  return [...sparkles.map(sparkleLayer), gradient].join(',');
}

export default LEMON_BACKGROUND;
