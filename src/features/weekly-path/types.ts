import type { ReactNode } from 'react';

import type { Interest, PlaceType } from '../../shared/api/generated/model';
import type { IconName } from '../../shared/components/Icon';

/** A place-type glyph: canvas SVG (currentColor) or an `Icon`. */
export type PlaceGlyph = { xml: string } | { icon: IconName };

/**
 * What the Path tab needs from other features, passed in by the app layer (features never import
 * each other): the guest's onboarding interests and the place-type colour + glyph.
 */
export type PathDeps = {
  readInterests: () => readonly Interest[];
  placeType: (type: PlaceType) => { color: string; glyph: PlaceGlyph };
  /** The trip-plan card (trip-plan AC7), shown above the path; renders nothing when there is no trip. */
  tripCard: ReactNode;
  /** Streak chips (streaks AC6), next to XP; renders nothing for guests. */
  streakChips?: ReactNode;
};
