import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, ThemeProvider } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campScheme } from '../campTheme';
import { CampHubScreen } from './CampHubScreen';

type Segment = 'feed' | 'groups' | 'campfire';

const segments: Segment[] = ['feed', 'groups', 'campfire'];

/**
 * Community tab (AC1): Feed · Groups · Campfire games, Campfire by default. Campfire is always
 * dark (light status bar); Feed and Groups show the coming-soon state in the system scheme.
 */
export function CommunityScreen() {
  useLocale();
  const [segment, setSegment] = useState<Segment>('campfire');
  const campfire = segment === 'campfire';

  return (
    <ThemeProvider scheme={campfire ? campScheme : undefined}>
      <Screen testID="community.screen" scroll={campfire} bottomInset={false}>
        <SegmentedControl
          value={segment}
          onChange={next => {
            haptics.selection();
            setSegment(next);
          }}
        />
        {campfire ? (
          <CampHubScreen />
        ) : (
          <EmptyState
            testID={`community.${segment}.coming-soon`}
            mascot="sleepy"
            mascotLabel={t('nav.comingSoon.mascot')}
            title={t('nav.comingSoon.title')}
            body={t('nav.comingSoon.body')}
          />
        )}
      </Screen>
    </ThemeProvider>
  );
}

function SegmentedControl({ value, onChange }: { value: Segment; onChange: (next: Segment) => void }) {
  const styles = useStyles();
  return (
    <View style={[layout.track, styles.track]} accessibilityRole="tablist">
      {segments.map(option => {
        const selected = option === value;
        const label = t(`camp.segments.${option}`);
        return (
          <Pressable
            key={option}
            testID={`community.segment.${option}`}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                onChange(option);
              }
            }}
            style={[layout.pill, selected ? styles.selected : null]}
          >
            <AppText variant="small" tone={selected ? 'ink' : 'muted'} numberOfLines={2} style={layout.label}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const layout = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[4],
    borderRadius: radii.pill,
  },
  pill: {
    flex: 1,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
  },
  label: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  track: { backgroundColor: c.soft },
  selected: { backgroundColor: c.card },
}));
