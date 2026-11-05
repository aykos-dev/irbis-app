import type { ImageSourcePropType } from 'react-native';
import type { LeagueTier } from '../../shared/api/generated/model';
import scout from '../../assets/images/leagues/league-scout.png';
import tracker from '../../assets/images/leagues/league-tracker.png';
import ranger from '../../assets/images/leagues/league-ranger.png';
import vanguard from '../../assets/images/leagues/league-vanguard.png';
import legend from '../../assets/images/leagues/league-legend.png';
import demotion from '../../assets/images/leagues/league-irbis-demotion.png';

export const leagueArt: Record<LeagueTier, ImageSourcePropType> = {
  scout,
  tracker,
  ranger,
  vanguard,
  legend,
};

export const leagueDemotionArt: ImageSourcePropType = demotion;
