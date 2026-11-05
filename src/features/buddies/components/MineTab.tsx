import { useNavigation } from '@react-navigation/native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useBuddiesList, useBuddiesTrips } from '../../../shared/api/generated/buddies/buddies';
import type { BuddyLinkDto, BuddyTripDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Skeleton } from '../../../shared/components/Skeleton';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { formatTripStart } from '../../../shared/utils/format';
import { useBuddyActions } from '../hooks/useBuddyActions';
import { levelName, personName } from '../labels';
import { Avatar } from './Avatar';
import { ConfirmSheet } from './ConfirmSheet';

const AVATAR = 44;
const ROW_HEIGHT = 72;

/** Mine (AC5, AC6): incoming requests, my buddies, sent requests and "Buddies are going". */
export function MineTab({ header }: { header: ReactNode }) {
  const navigation = useNavigation();
  const list = useBuddiesList();
  const trips = useBuddiesTrips();
  const actions = useBuddyActions();
  const { isOnline } = useNetworkStatus();
  const [removing, setRemoving] = useState<BuddyLinkDto | null>(null);
  const disabled = !isOnline || actions.busy;

  let body;
  if (list.data) {
    const { incoming, buddies, outgoing } = list.data;
    const going = trips.data?.items ?? [];
    body =
      incoming.length + buddies.length + outgoing.length === 0 && going.length === 0 ? (
        <EmptyState
          inline
          testID="buddies.mine-empty"
          mascot="default"
          mascotLabel={t('buddies.mine.empty')}
          title={t('buddies.mine.empty')}
          body={t('buddies.mine.emptyBody')}
        />
      ) : (
        <>
          {incoming.length ? (
            <Section title={t('buddies.mine.incoming')}>
              {incoming.map(link => (
                <PersonRow key={link.id} person={link}>
                  <Action testID={`buddies.accept-${link.id}`} label={t('buddies.mine.accept')} primary disabled={disabled} onPress={() => void actions.accept(link.id)} />
                  <Action testID={`buddies.decline-${link.id}`} label={t('buddies.mine.decline')} disabled={disabled} onPress={() => void actions.decline(link.id)} />
                </PersonRow>
              ))}
            </Section>
          ) : null}
          {going.length ? (
            <Section title={t('buddies.mine.going')}>
              {going.map(trip => (
                <GoingRow key={trip.id} trip={trip} onPress={() => navigation.navigate('GroupTrip', { id: trip.id })} />
              ))}
            </Section>
          ) : null}
          <Section title={t('buddies.mine.buddies')}>
            {buddies.length ? (
              buddies.map(link => (
                <PersonRow
                  key={link.id}
                  person={link}
                  onOpen={() => navigation.navigate('PublicProfile', { username: link.username, userId: link.userId })}
                >
                  <Action testID={`buddies.remove-${link.userId}`} label={t('buddies.mine.remove')} disabled={disabled} onPress={() => setRemoving(link)} />
                </PersonRow>
              ))
            ) : (
              <AppText tone="muted">{t('buddies.mine.empty')}</AppText>
            )}
          </Section>
          {outgoing.length ? (
            <Section title={t('buddies.mine.sent')}>
              {outgoing.map(link => (
                <PersonRow key={link.id} person={link}>
                  <Action testID={`buddies.cancel-${link.userId}`} label={t('buddies.mine.cancel')} disabled={disabled} onPress={() => void actions.cancel(link.userId)} />
                </PersonRow>
              ))}
            </Section>
          ) : null}
        </>
      );
  } else if (list.error) {
    body = <ErrorState testID="buddies.mine-error" retryTestID="buddies.mine-retry" error={list.error} onRetry={() => void list.refetch()} />;
  } else {
    body = (
      <View testID="buddies.mine-skeleton" style={layout.list}>
        <Skeleton height={ROW_HEIGHT} radius={radii.card} />
        <Skeleton height={ROW_HEIGHT} radius={radii.card} />
      </View>
    );
  }

  return (
    <>
      <ScrollView testID="buddies.mine-list" contentContainerStyle={layout.list} showsVerticalScrollIndicator={false}>
        {header}
        {body}
      </ScrollView>
      {removing ? (
        <ConfirmSheet
          testID="buddies.remove-sheet"
          title={t('buddies.remove.title')}
          body={t('buddies.remove.body', { name: personName(removing) })}
          confirmLabel={t('buddies.remove.confirm')}
          loading={actions.removing}
          onConfirm={() => actions.remove(removing.userId)}
          onDismiss={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={layout.section}>
      <AppText variant="caption" tone="muted" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function PersonRow({ person, onOpen, children }: { person: BuddyLinkDto; onOpen?: () => void; children: ReactNode }) {
  const styles = useStyles();
  const name = personName(person);
  const content = (
    <>
      <Avatar avatarUrl={person.avatarUrl} level={person.level} size={AVATAR} />
      <View style={layout.copy}>
        <AppText variant="h3" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {levelName(person.level)}
        </AppText>
      </View>
    </>
  );
  return (
    <View testID={`buddies.person-${person.userId}`} style={[layout.row, styles.row]}>
      {onOpen ? (
        <Pressable
          testID={`buddies.open-${person.userId}`}
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={onOpen}
          style={layout.open}
        >
          {content}
        </Pressable>
      ) : (
        <View style={layout.open}>{content}</View>
      )}
      <View style={layout.actions}>{children}</View>
    </View>
  );
}

function Action({
  testID,
  label,
  onPress,
  disabled,
  primary = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[layout.action, primary ? styles.primary : styles.secondary]}
    >
      <AppText variant="chip" tone={primary ? 'white' : 'teal700'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function GoingRow({ trip, onPress }: { trip: BuddyTripDto; onPress: () => void }) {
  const locale = useLocale();
  const styles = useStyles();
  const { colors } = useTheme();
  const place = trip.placeName[locale];
  const when = formatTripStart(new Date(trip.startAt), locale);
  const names = t('buddies.mine.goingWith', { names: trip.buddies.map(personName).join(', ') });
  return (
    <Pressable
      testID={`buddies.going-${trip.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${place}, ${when}, ${names}`}
      onPress={onPress}
      style={[layout.row, styles.row]}
    >
      <View style={layout.copy}>
        <AppText variant="h3" numberOfLines={1}>
          {place}
        </AppText>
        <AppText variant="small" tone="muted">
          {when}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {names}
        </AppText>
      </View>
      <Icon name="chevron" color={colors.muted} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  list: { gap: spacing[16], paddingBottom: spacing[20] },
  section: { gap: spacing[10] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  copy: { flex: 1, gap: spacing[4] },
  actions: { flexDirection: 'row', gap: spacing[6] },
  action: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[10],
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
  primary: { backgroundColor: c.teal700 },
  secondary: { backgroundColor: c.soft },
}));
