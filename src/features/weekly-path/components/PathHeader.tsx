import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { pathColors } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { headerSize } from '../pathLayout';
import { monthNumber, seasonOf } from '../pathMonth';

type Props = {
  level: number;
  /** Accounts only; null hides the XP stat. */
  xp: number | null;
  month: string;
  locale: Locale;
  onInfo: () => void;
  children?: ReactNode;
};

/** Header (AC6): companion + XP, then the intro card with title, subtitle, info and weather. */
export function PathHeader({ level, xp, month, locale, onInfo, children }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = levelMeta(level);
  const n = monthNumber(month);
  const levelName = t(meta.nameKey);
  const subtitle = t('path.subtitle', {
    month: t(`path.months.${n}`),
    levelName,
    season: t(`path.seasons.${seasonOf(n)}`),
  });
  return (
    <>
      <View style={styles.top}>
        <View
          testID="path.companion"
          style={[layout.avatar, { backgroundColor: meta.tint, borderColor: meta.color }]}
        >
          <View style={layout.art}>
            <CompanionArt level={meta.level} size={headerSize.avatar} accessibilityLabel={levelName} />
          </View>
        </View>
        {xp !== null ? (
          <View testID="path.xp" style={layout.xp} accessible accessibilityLabel={`${xp} XP`}>
            <Svg width={headerSize.bolt} height={headerSize.bolt} viewBox="0 0 24 24">
              <Path d="M13.5 1.5L4 14h7l-1.5 8.5L20 9.5h-7z" fill={pathColors.bolt} />
            </Svg>
            <AppText variant="h3">{new Intl.NumberFormat(locale).format(xp)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        <View style={layout.titleRow}>
          <View style={layout.titles}>
            <AppText variant="h2" accessibilityRole="header">
              {t('path.title')}
            </AppText>
            <AppText testID="path.subtitle" variant="small">
              {subtitle}
            </AppText>
          </View>
          <Pressable testID="path.info" accessibilityLabel={t('path.info.title')} onPress={onInfo} style={styles.info}>
            <Icon name="info" color={colors.muted} />
          </Pressable>
        </View>
        {children}
      </View>
    </>
  );
}

const layout = StyleSheet.create({
  avatar: {
    width: headerSize.avatar,
    height: headerSize.avatar,
    borderRadius: radii.pill,
    borderWidth: headerSize.avatarBorder,
    overflow: 'hidden',
    alignItems: 'center',
  },
  art: { marginTop: headerSize.avatarArtOffset },
  xp: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[12] },
  titles: { flex: 1, gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[14],
    paddingBottom: spacing[10],
    borderBottomWidth: borders.card,
    borderBottomColor: c.line,
  },
  card: {
    gap: spacing[14],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  info: {
    width: headerSize.info,
    height: headerSize.info,
    borderRadius: radii.checkbox + spacing[4],
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
