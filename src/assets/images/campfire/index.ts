import foxCheering from './foxCheering.png';
import iosHotspotGuide from './iosHotspotGuide.jpg';
import roleCardBodyguard from './roleCard_bodyguard.jpg';
import roleCardBoss from './roleCard_boss.jpg';
import roleCardCivilian from './roleCard_civilian.jpg';
import roleCardDetective from './roleCard_detective.jpg';
import roleCardDoctor from './roleCard_doctor.jpg';
import roleCardImmortal from './roleCard_immortal.jpg';
import roleCardJournalist from './roleCard_journalist.jpg';
import roleCardLover from './roleCard_lover.jpg';
import roleCardMafia from './roleCard_mafia.jpg';
import roleCardManiac from './roleCard_maniac.jpg';
import roleCardSniper from './roleCard_sniper.jpg';
import glyphImmortal from './roleGlyph_immortal.png';
import glyphJournalist from './roleGlyph_journalist.png';
import glyphSniper from './roleGlyph_sniper.png';

/** Owner's Campfire art (@2x/@3x): CampHub fox and the iPhone hotspot guide picture. */
export { foxCheering, iosHotspotGuide };

/** Black role glyphs on transparent (40 pt) — tint with `tintColor`. */
export const roleGlyphImages = {
  sniper: glyphSniper,
  journalist: glyphJournalist,
  immortal: glyphImmortal,
} as const;

/**
 * Role card art (144×192) shown under "You are" on the Mafia role card, one per Mafia role id
 * (assets can't import feature types; `RoleCard` indexing by `RoleId` keeps the keys complete).
 */
export const roleCards = {
  boss: roleCardBoss,
  mafia: roleCardMafia,
  detective: roleCardDetective,
  doctor: roleCardDoctor,
  maniac: roleCardManiac,
  lover: roleCardLover,
  bodyguard: roleCardBodyguard,
  civilian: roleCardCivilian,
  sniper: roleCardSniper,
  journalist: roleCardJournalist,
  immortal: roleCardImmortal,
} as const;
