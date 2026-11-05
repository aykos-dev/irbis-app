import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { placeHeroes } from '../../../assets/images/places';
import { isApiError } from '../../../shared/api/errors';
import { useConditionsGetForPlace } from '../../../shared/api/generated/conditions/conditions';
import {
  getGroupTripsGetQueryKey,
  useGroupTripsApproveRequest,
  useGroupTripsCancel,
  useGroupTripsGet,
  useGroupTripsLeave,
  useGroupTripsRejectRequest,
  useGroupTripsRequest,
} from '../../../shared/api/generated/group-trips/group-trips';
import { useGetEmergencyContact } from '../../../shared/api/generated/me/me';
import type { GroupTripDto } from '../../../shared/api/generated/model';
import { groupTripsRequestBodyNoteMax } from '../../../shared/api/generated/zod/group-trips/group-trips.zod';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { statusVariant } from '../../../shared/components/conditions/reasonText';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, screenPadding, sizes, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { ContactSheet } from '../components/ContactSheet';
import { MeetingMap } from '../components/MeetingMap';
import { TextSheet } from '../components/TextSheet';
import { tripErrorKey } from '../errors';
import { formatClock, formatDay, tashkentDay } from '../tripEventTimes';

const HERO_HEIGHT = 140;
const MAP_HEIGHT = 160;
const SKELETON_BLOCK = 96;
const NOT_FOUND = 404;

type SheetKind = 'contact' | 'join' | 'leave' | 'cancel' | null;

/** Group trip page (AC3–AC5, AC8): details, participants, join / leave, the leader's requests. */
export function GroupTripScreen({ navigation, route }: RootStackScreenProps<'GroupTrip'>) {
  const { id } = route.params;
  const query = useGroupTripsGet(id);
  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Community' } }] });

  if (query.data) {
    return <TripPage trip={query.data} onBack={goBack} />;
  }
  const notFound = isApiError(query.error) && query.error.status === NOT_FOUND;
  let body;
  if (notFound) {
    body = (
      <EmptyState
        testID="group-trip.not-found"
        mascot="worried"
        mascotLabel={t('tripEvents.trip.notFound')}
        title={t('tripEvents.trip.notFound')}
      />
    );
  } else if (query.error) {
    body = (
      <ErrorState
        testID="group-trip.error"
        retryTestID="group-trip.retry"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    body = (
      <View testID="group-trip.skeleton" style={layout.section}>
        <Skeleton height={HERO_HEIGHT} radius={radii.card} />
        <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
        <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
      </View>
    );
  }
  return (
    <Screen testID="group-trip.screen" scroll showOfflineBanner>
      <BackButton onPress={goBack} />
      {body}
    </Screen>
  );
}

function placeName(trip: GroupTripDto, locale: Locale): string {
  return trip.place.names[locale];
}

function personName(person: { username: string; displayName: string | null }): string {
  return person.displayName ?? person.username;
}

function TripPage({ trip, onBack }: { trip: GroupTripDto; onBack: () => void }) {
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { status, user } = useAuth();
  const requireAccount = useRequireAccount('trip');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const condition = useConditionsGetForPlace(trip.place.id);
  const contact = useGetEmergencyContact({ query: { enabled: status === 'signedIn' } });

  const silent = { mutation: { meta: { silentError: true } } };
  const join = useGroupTripsRequest(silent);
  const approve = useGroupTripsApproveRequest(silent);
  const reject = useGroupTripsRejectRequest(silent);
  const leave = useGroupTripsLeave(silent);
  const cancel = useGroupTripsCancel(silent);

  const store = (next: GroupTripDto) => queryClient.setQueryData(getGroupTripsGetQueryKey(trip.id), next);
  const fail = (error: unknown) => {
    haptics.error();
    toast.show({ variant: 'error', message: t(tripErrorKey(error)) });
  };
  const done = (message: string) => {
    haptics.success();
    toast.show({ variant: 'success', message });
  };

  const cancelled = trip.status === 'cancelled';
  const me = trip.me;
  const isLeader = me?.role === 'leader';
  const memberStatus = isLeader ? null : (me?.status ?? null);
  const full = trip.spotsLeft === 0;
  const startAt = new Date(trip.startAt);
  const backBy = new Date(trip.backBy);
  const day = tashkentDay(startAt);
  const started = tashkentDay(new Date()) >= day;

  const askToJoin = () =>
    requireAccount(() => {
      if (user?.isDemo) {
        toast.show({ variant: 'error', message: t('tripEvents.errors.SECURED_ACCOUNT_REQUIRED') });
        navigation.navigate('SecureAccount');
        return;
      }
      setJoinError(null);
      setSheet(contact.data ? 'join' : 'contact');
    });

  const sendJoin = async (note: string): Promise<boolean> => {
    try {
      store(await join.mutateAsync({ id: trip.id, data: note === '' ? {} : { note } }));
      done(t('tripEvents.trip.requestSent'));
      return true;
    } catch (error) {
      haptics.error();
      setJoinError(t(tripErrorKey(error)));
      return false;
    }
  };

  const decide = async (userId: string, approved: boolean) => {
    try {
      const next = approved
        ? await approve.mutateAsync({ id: trip.id, userId })
        : await reject.mutateAsync({ id: trip.id, userId });
      store(next);
      done(t(approved ? 'tripEvents.trip.approved' : 'tripEvents.trip.rejected'));
    } catch (error) {
      fail(error);
    }
  };

  const confirmLeave = async (): Promise<boolean> => {
    try {
      await leave.mutateAsync({ id: trip.id });
      await queryClient.invalidateQueries({ queryKey: getGroupTripsGetQueryKey(trip.id) });
      done(t('tripEvents.trip.left'));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const confirmCancel = async (): Promise<boolean> => {
    try {
      store(await cancel.mutateAsync({ id: trip.id }));
      done(t('tripEvents.trip.cancelledToast'));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const conditionStatus = condition.data?.status;
  const { lat, lng } = trip.meeting;
  const participantsLine =
    trip.maxPeople === null
      ? t('tripEvents.trip.count', { n: trip.approvedCount })
      : t('tripEvents.trip.countOf', { n: trip.approvedCount, max: trip.maxPeople });

  let footer = null;
  if (!cancelled && isLeader) {
    footer = (
      <View style={layout.buttons}>
        <View style={layout.button}>
          <AppButton
            testID="group-trip.edit"
            variant="white"
            label={t('tripEvents.trip.edit')}
            disabled={!isOnline}
            onPress={() => navigation.navigate('CreateTrip', { placeId: trip.place.id, groupTripId: trip.id })}
          />
        </View>
        <View style={layout.button}>
          <AppButton
            testID="group-trip.cancel"
            variant="danger"
            label={t('tripEvents.trip.cancel')}
            disabled={!isOnline}
            onPress={() => setSheet('cancel')}
          />
        </View>
      </View>
    );
  } else if (!cancelled && (memberStatus === 'approved' || memberStatus === 'pending')) {
    footer = (
      <View style={layout.section}>
        <AppText testID="group-trip.my-status" variant="h3" style={layout.center}>
          {t(memberStatus === 'approved' ? 'tripEvents.trip.youreIn' : 'tripEvents.trip.requestSent')}
        </AppText>
        <AppButton
          testID="group-trip.leave"
          variant="white"
          label={t(memberStatus === 'approved' ? 'tripEvents.trip.leave' : 'tripEvents.trip.withdraw')}
          disabled={!isOnline}
          onPress={() => setSheet('leave')}
        />
      </View>
    );
  } else if (!cancelled) {
    footer = (
      <AppButton
        testID="group-trip.join"
        label={t(full ? 'tripEvents.trip.full' : 'tripEvents.trip.join')}
        disabled={!isOnline || full}
        onPress={askToJoin}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Screen testID="group-trip.screen" scroll showOfflineBanner bottomInset={footer === null}>
        <BackButton onPress={onBack} />
        {cancelled ? (
          <View testID="group-trip.cancelled" style={styles.banner} accessibilityRole="alert">
            <AppText variant="body" tone="red700">
              {t('tripEvents.trip.cancelled')}
            </AppText>
          </View>
        ) : null}
        <View style={styles.card}>
          <Image source={placeHeroes[trip.place.type]} resizeMode="cover" accessible={false} style={layout.hero} />
          <View style={layout.cardBody}>
            <AppText testID="group-trip.place" variant="h2" accessibilityRole="header">
              {placeName(trip, locale)}
            </AppText>
            <AppText testID="group-trip.when" variant="body">
              {t('tripEvents.trip.when', {
                day: formatDay(day, locale),
                start: formatClock(startAt, locale),
                backBy: formatClock(backBy, locale),
              })}
            </AppText>
            {conditionStatus ? (
              <StatusChip
                testID="group-trip.condition"
                variant={statusVariant[conditionStatus]}
                label={t(`conditions.status.${conditionStatus}`)}
              />
            ) : null}
          </View>
        </View>

        <Block title={t('tripEvents.create.meeting')}>
          <AppText testID="group-trip.meeting" variant="body">
            {trip.meeting.text}
          </AppText>
          {lat !== null && lng !== null ? (
            <MeetingMap testID="group-trip.meeting-map" center={{ lat, lng }} pin={{ lat, lng }} height={MAP_HEIGHT} />
          ) : null}
          {trip.carpool ? (
            <AppText testID="group-trip.carpool" variant="small">
              {t('tripEvents.trip.carpool', { time: trip.carpool.from, seats: trip.carpool.seats })}
            </AppText>
          ) : null}
        </Block>

        <Block title={t('tripEvents.trip.leader')}>
          <View style={layout.personRow}>
            <AppText testID="group-trip.leader" variant="body" style={layout.fill}>
              {t('tripEvents.trip.person', { name: personName(trip.leader), level: trip.leader.level })}
            </AppText>
            {trip.leader.verifiedLeader ? <VerifiedLeader /> : null}
          </View>
        </Block>

        <Block title={t('tripEvents.trip.participants')}>
          <AppText testID="group-trip.count" variant="body">
            {participantsLine}
          </AppText>
          {trip.minLevel !== null ? (
            <AppText variant="small">{t('tripEvents.trip.minLevel', { level: trip.minLevel })}</AppText>
          ) : null}
          {trip.participants.map(person => (
            <AppText key={person.id} testID={`group-trip.participant-${person.id}`} variant="body">
              {t('tripEvents.trip.person', { name: personName(person), level: person.level })}
            </AppText>
          ))}
        </Block>

        {isLeader && !cancelled ? (
          <Block title={t('tripEvents.trip.requests')}>
            {trip.requests.length === 0 ? (
              <AppText testID="group-trip.requests-empty" variant="small">
                {t('tripEvents.trip.noRequests')}
              </AppText>
            ) : (
              trip.requests.map(request => {
                const below = trip.minLevel !== null && request.level < trip.minLevel;
                return (
                  <View key={request.userId} testID={`group-trip.request-${request.userId}`} style={styles.request}>
                    <AppText variant="h3">{request.username}</AppText>
                    <AppText variant="small" tone={below ? 'red700' : undefined}>
                      {trip.minLevel === null
                        ? t('tripEvents.trip.level', { level: request.level })
                        : t('tripEvents.trip.levelVsMin', { level: request.level, min: trip.minLevel })}
                    </AppText>
                    {request.note ? <AppText variant="body">{request.note}</AppText> : null}
                    <View style={layout.buttons}>
                      <View style={layout.button}>
                        <AppButton
                          testID={`group-trip.reject-${request.userId}`}
                          variant="white"
                          label={t('tripEvents.trip.reject')}
                          disabled={!isOnline}
                          onPress={() => void decide(request.userId, false)}
                        />
                      </View>
                      <View style={layout.button}>
                        <AppButton
                          testID={`group-trip.approve-${request.userId}`}
                          label={t('tripEvents.trip.approve')}
                          disabled={!isOnline || full}
                          onPress={() => void decide(request.userId, true)}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Block>
        ) : null}

        {trip.gear.keys.length + trip.gear.custom.length > 0 ? (
          <Block title={t('tripEvents.create.gear')}>
            <AppText testID="group-trip.gear" variant="body">
              {[...trip.gear.keys.map(key => t(`tripEvents.gear.${key}`)), ...trip.gear.custom].join(' · ')}
            </AppText>
          </Block>
        ) : null}

        {trip.description ? (
          <Block title={t('tripEvents.create.description')}>
            <AppText testID="group-trip.description" variant="body">
              {trip.description}
            </AppText>
          </Block>
        ) : null}

        {trip.groups.length > 0 ? (
          <Block title={t('tripEvents.create.groups')}>
            <View style={layout.chips}>
              {trip.groups.map(group => (
                <View key={group.id} testID={`group-trip.group-${group.id}`} style={styles.chip}>
                  <AppText variant="chip">{group.name}</AppText>
                </View>
              ))}
            </View>
          </Block>
        ) : null}
        {isLeader && !cancelled && started ? (
          <AppText variant="small">{t('tripEvents.create.locked')}</AppText>
        ) : null}
      </Screen>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom || spacing[20],
              paddingStart: screenPadding + insets.left,
              paddingEnd: screenPadding + insets.right,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
      {sheet === 'contact' ? (
        <ContactSheet scope="group-trip" onSaved={() => setSheet('join')} onDismiss={() => setSheet(s => (s === 'contact' ? null : s))} />
      ) : null}
      {sheet === 'join' ? (
        <TextSheet
          testID="group-trip.join-sheet"
          title={t('tripEvents.trip.joinTitle')}
          body={
            contact.data
              ? t('tripEvents.trip.joinContact', { name: contact.data.name, relation: contact.data.relation })
              : undefined
          }
          label={t('tripEvents.trip.note')}
          optional
          optionalLabel={t('tripEvents.optional')}
          inputTestID="group-trip.join-note"
          submitTestID="group-trip.join-send"
          submitLabel={t('tripEvents.trip.send')}
          maxLength={groupTripsRequestBodyNoteMax}
          loading={join.isPending}
          disabled={!isOnline}
          error={joinError}
          onSubmit={sendJoin}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'leave' ? (
        <ConfirmSheet
          testID="group-trip.leave-sheet"
          title={t('tripEvents.trip.leaveTitle')}
          body={t('tripEvents.trip.leaveBody')}
          confirmLabel={t('tripEvents.trip.leave')}
          loading={leave.isPending}
          onConfirm={confirmLeave}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'cancel' ? (
        <ConfirmSheet
          testID="group-trip.cancel-sheet"
          title={t('tripEvents.trip.cancelTitle')}
          body={t('tripEvents.trip.cancelBody')}
          confirmLabel={t('tripEvents.trip.cancel')}
          loading={cancel.isPending}
          onConfirm={confirmCancel}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={layout.section}>
      <AppText variant="caption">{title}</AppText>
      {children}
    </View>
  );
}

function VerifiedLeader() {
  const { colors } = useTheme();
  return (
    <View testID="group-trip.verified-leader" style={layout.verified} accessible accessibilityLabel={t('tripEvents.trip.verifiedLeader')}>
      <Icon name="shield" color={colors.teal700} />
      <AppText variant="chip" tone="teal700">
        {t('tripEvents.trip.verifiedLeader')}
      </AppText>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID="group-trip.back"
      accessibilityRole="button"
      accessibilityLabel={t('places.back')}
      onPress={onPress}
      style={styles.back}
    >
      <Icon name="back" color={colors.ink} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  section: { gap: spacing[8] },
  hero: { width: '100%', height: HERO_HEIGHT },
  cardBody: { gap: spacing[8], padding: spacing[14], alignItems: 'flex-start' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  verified: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  button: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  banner: {
    padding: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.red700,
    backgroundColor: c.card,
  },
  request: {
    gap: spacing[8],
    padding: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  chip: {
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    justifyContent: 'center',
  },
  footer: {
    gap: spacing[10],
    paddingTop: spacing[12],
    borderTopWidth: borders.card,
    borderTopColor: c.line,
    backgroundColor: c.bg,
  },
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: borders.card,
    borderColor: c.line,
  },
}));
