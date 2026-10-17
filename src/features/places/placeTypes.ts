import { interestCampingSvg } from '../../assets/svg/interestCamping';
import { interestCavesSvg } from '../../assets/svg/interestCaves';
import { interestLakesSvg } from '../../assets/svg/interestLakes';
import { interestPeaksSvg } from '../../assets/svg/interestPeaks';
import { interestTrailsSvg } from '../../assets/svg/interestTrails';
import type { ImageRequireSource } from 'react-native';

import { placeHeroes } from '../../assets/images/places';
import type { PlaceType } from '../../shared/api/generated/model';
import type { IconName } from '../../shared/components/Icon';
import { placeTypeColors } from '../../shared/constants/colors';

/** A type glyph: canvas SVG (currentColor) or an `Icon` (placeholder glyphs, owner Q8). */
export type PlaceTypeGlyph = { xml: string } | { icon: IconName };

type PlaceTypeInfo = {
  color: string;
  glyph: PlaceTypeGlyph;
  /** Hero image, generic per type; shown cover-cropped in the 390×240 frame. */
  hero: ImageRequireSource;
  labelKey: string;
};

/**
 * Place type → colour token, icon, hero image and label (features/places.md AC7).
 * Waterfall and canyon icons and colours are placeholders (owner Q8).
 */
export const placeTypes: Record<PlaceType, PlaceTypeInfo> = {
  peak: {
    color: placeTypeColors.peak,
    glyph: { xml: interestPeaksSvg },
    hero: placeHeroes.peak,
    labelKey: 'places.type.peak',
  },
  lake: {
    color: placeTypeColors.lake,
    glyph: { xml: interestLakesSvg },
    hero: placeHeroes.lake,
    labelKey: 'places.type.lake',
  },
  cave: {
    color: placeTypeColors.cave,
    glyph: { xml: interestCavesSvg },
    hero: placeHeroes.cave,
    labelKey: 'places.type.cave',
  },
  camping: {
    color: placeTypeColors.camping,
    glyph: { xml: interestCampingSvg },
    hero: placeHeroes.camping,
    labelKey: 'places.type.camping',
  },
  trail: {
    color: placeTypeColors.trail,
    glyph: { xml: interestTrailsSvg },
    hero: placeHeroes.trail,
    labelKey: 'places.type.trail',
  },
  waterfall: {
    color: placeTypeColors.waterfall,
    glyph: { icon: 'waterfall' },
    hero: placeHeroes.waterfall,
    labelKey: 'places.type.waterfall',
  },
  canyon: {
    color: placeTypeColors.canyon,
    glyph: { icon: 'canyon' },
    hero: placeHeroes.canyon,
    labelKey: 'places.type.canyon',
  },
};
