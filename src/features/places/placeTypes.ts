import { interestCampingSvg } from '../../assets/svg/interestCamping';
import { interestCavesSvg } from '../../assets/svg/interestCaves';
import { interestLakesSvg } from '../../assets/svg/interestLakes';
import { interestPeaksSvg } from '../../assets/svg/interestPeaks';
import { interestTrailsSvg } from '../../assets/svg/interestTrails';
import { onb3LakeSvg } from '../../assets/svg/onb3Lake';
import { onb3PeakSvg } from '../../assets/svg/onb3Peak';
import { onb3TrailSvg } from '../../assets/svg/onb3Trail';
import { placeCanyonSvg } from '../../assets/svg/placeCanyon';
import { placeCaveSvg } from '../../assets/svg/placeCave';
import { placeWaterfallSvg } from '../../assets/svg/placeWaterfall';
import type { PlaceType } from '../../shared/api/generated/model';
import type { IconName } from '../../shared/components/Icon';
import { placeTypeColors } from '../../shared/constants/colors';

/** A type glyph: canvas SVG (currentColor) or an `Icon` (placeholder glyphs, owner Q8). */
export type PlaceTypeGlyph = { xml: string } | { icon: IconName };

type PlaceTypeInfo = {
  color: string;
  glyph: PlaceTypeGlyph;
  /** 390×240 hero illustration, generic per type. */
  hero: string;
  labelKey: string;
};

/**
 * Place type → colour token, icon, hero illustration and label (features/places.md AC7).
 * Waterfall and canyon art, icons and colours are placeholders (owner Q8). Camping has no canvas
 * hero yet and shares the trail illustration (no camping places in the seed).
 */
export const placeTypes: Record<PlaceType, PlaceTypeInfo> = {
  peak: {
    color: placeTypeColors.peak,
    glyph: { xml: interestPeaksSvg },
    hero: onb3PeakSvg,
    labelKey: 'places.type.peak',
  },
  lake: {
    color: placeTypeColors.lake,
    glyph: { xml: interestLakesSvg },
    hero: onb3LakeSvg,
    labelKey: 'places.type.lake',
  },
  cave: {
    color: placeTypeColors.cave,
    glyph: { xml: interestCavesSvg },
    hero: placeCaveSvg,
    labelKey: 'places.type.cave',
  },
  camping: {
    color: placeTypeColors.camping,
    glyph: { xml: interestCampingSvg },
    hero: onb3TrailSvg,
    labelKey: 'places.type.camping',
  },
  trail: {
    color: placeTypeColors.trail,
    glyph: { xml: interestTrailsSvg },
    hero: onb3TrailSvg,
    labelKey: 'places.type.trail',
  },
  waterfall: {
    color: placeTypeColors.waterfall,
    glyph: { icon: 'waterfall' },
    hero: placeWaterfallSvg,
    labelKey: 'places.type.waterfall',
  },
  canyon: {
    color: placeTypeColors.canyon,
    glyph: { icon: 'canyon' },
    hero: placeCanyonSvg,
    labelKey: 'places.type.canyon',
  },
};
