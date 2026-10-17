import camping from './pinGlyph_camping.png';
import canyon from './pinGlyph_canyon.png';
import cave from './pinGlyph_cave.png';
import lake from './pinGlyph_lake.png';
import peak from './pinGlyph_peak.png';
import trail from './pinGlyph_trail.png';
import waterfall from './pinGlyph_waterfall.png';

/**
 * White type glyphs (16 pt, @2x/@3x) for map pins — rasterised from the same artwork as the
 * interest glyphs and the waterfall/canyon `Icon` placeholders (owner Q8). MapLibre symbol
 * layers take raster images only.
 */
export const pinGlyphs = { camping, canyon, cave, lake, peak, trail, waterfall } as const;
