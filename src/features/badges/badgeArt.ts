import type { ImageSourcePropType } from 'react-native';

import campMaster from '../../assets/images/badges/badge-camp-master.png';
import caveCrawler from '../../assets/images/badges/badge-cave-crawler.png';
import lakeHopper from '../../assets/images/badges/badge-lake-hopper.png';
import peakBagger1 from '../../assets/images/badges/badge-peak-bagger-1.png';
import peakBagger2 from '../../assets/images/badges/badge-peak-bagger-2.png';
import peakBagger3 from '../../assets/images/badges/badge-peak-bagger-3.png';
import regionSurkhandarya from '../../assets/images/badges/badge-region-surkhandarya.png';
import regionTashkent from '../../assets/images/badges/badge-region-tashkent.png';
import regionUgamChatkal from '../../assets/images/badges/badge-region-ugam-chatkal.png';
import regionZaamin from '../../assets/images/badges/badge-region-zaamin.png';
import trailRunner from '../../assets/images/badges/badge-trail-runner.png';

/** Owner-supplied badge art. Catalogue entries without art render the code-native fallback. */
export const badgeArt: Record<string, ImageSourcePropType> = {
  'peak-bagger-1': peakBagger1,
  'peak-bagger-2': peakBagger2,
  'peak-bagger-3': peakBagger3,
  'lake-hopper': lakeHopper,
  'cave-crawler': caveCrawler,
  'camp-master': campMaster,
  'trail-runner': trailRunner,
  'region-tashkent': regionTashkent,
  'region-ugam-chatkal': regionUgamChatkal,
  'region-zaamin': regionZaamin,
  'region-surkhandarya': regionSurkhandarya,
};
