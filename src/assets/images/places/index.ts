import camping from './hero-camping.jpg';
import canyon from './hero-canyon.jpg';
import cave from './hero-cave.jpg';
import lake from './hero-lake.jpg';
import peak from './hero-peak.jpg';
import trail from './hero-trail.jpg';
import waterfall from './hero-waterfall.jpg';

/** Owner hero art per place type (1170 px JPEG, 3× of the 390 pt hero), same in light and dark. */
export const placeHeroes = { camping, canyon, cave, lake, peak, trail, waterfall } as const;
