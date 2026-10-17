import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../shared/components/AppText';
import { Icon, type IconName } from '../../shared/components/Icon';
import { Mascot } from '../../shared/components/Mascot';
import { Pressable } from '../../shared/components/Pressable';
import { borders, motion, radii, spacing } from '../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../shared/contexts/theme';
import { useLocale } from '../../shared/hooks/useLocale';
import { t } from '../../shared/i18n';
import { haptics } from '../../shared/utils/haptics';
import { qaLog } from '../../shared/utils/qaLog';
import type { MainTabParamList } from './types';

type TabKey = 'path' | 'explore' | 'lessons' | 'community' | 'profile';

const tabKeys: Record<keyof MainTabParamList, TabKey> = {
  Path: 'path',
  Explore: 'explore',
  Lessons: 'lessons',
  Community: 'community',
  Profile: 'profile',
};

const tabIcons: Record<Exclude<TabKey, 'profile'>, IconName> = {
  path: 'path',
  explore: 'explore',
  lessons: 'lessons',
  community: 'community',
};

const PILL_WIDTH = 54;
const PILL_HEIGHT = 42;
const PROFILE_ART = 34;
const ICON = 26;

const timing = { duration: motion.press, easing: Easing.out(Easing.cubic) };

/** Canvas Nav: five tabs, 54 × 42 pill with a 2 px border when active, 11 / 800 label. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  useLocale();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const activeName = state.routes[state.index]?.name;

  useEffect(() => {
    if (activeName && activeName in tabKeys) {
      qaLog('tab_opened', { tab: tabKeys[activeName as keyof MainTabParamList] });
    }
  }, [activeName]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.mainLabel')}
      style={[
        layout.bar,
        styles.bar,
        {
          paddingBottom: insets.bottom || spacing[10],
          paddingStart: spacing[6] + insets.left,
          paddingEnd: spacing[6] + insets.right,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const key = tabKeys[route.name as keyof MainTabParamList];
        if (!key) {
          return null;
        }
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name, route.params);
          }
        };
        return <TabItem key={route.key} tab={key} focused={focused} onPress={onPress} />;
      })}
    </View>
  );
}

function TabItem({ tab, focused, onPress }: { tab: TabKey; focused: boolean; onPress: () => void }) {
  useLocale();
  const { colors } = useTheme();
  const label = t(`nav.tabs.${tab}`);
  const color = focused ? colors.navActiveFg : colors.muted;

  const pill = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(focused ? colors.navActiveBg : 'transparent', timing),
      borderColor: withTiming(focused ? colors.navActiveBorder : 'transparent', timing),
    }),
    [focused, colors],
  );

  return (
    <Pressable
      testID={`nav.tab-${tab}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={layout.item}
    >
      <Animated.View style={[layout.pill, pill]}>
        {tab === 'profile' ? (
          <Mascot kind="fox" size={PROFILE_ART} />
        ) : (
          <Icon name={tabIcons[tab]} color={color} size={ICON} />
        )}
      </Animated.View>
      <AppText variant="navLabel" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: spacing[8],
    borderTopWidth: borders.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[4],
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: radii.input,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  bar: { backgroundColor: c.card, borderTopColor: c.line },
}));
