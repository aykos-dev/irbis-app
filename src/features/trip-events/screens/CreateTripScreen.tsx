import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { placeHeroes } from '../../../assets/images/places';
import {
  getGroupTripsGetQueryKey,
  useGroupTripsCreate,
  useGroupTripsGet,
  useGroupTripsUpdate,
} from '../../../shared/api/generated/group-trips/group-trips';
import { useGetEmergencyContact } from '../../../shared/api/generated/me/me';
import {
  GearKey,
  type CreateGroupTripDto,
  type GroupTripDto,
  type GroupTripVisibility,
  type PlaceDetailDto,
} from '../../../shared/api/generated/model';
import { usePlacesGet } from '../../../shared/api/generated/places/places';
import { useGetTripPreview } from '../../../shared/api/generated/trips/trips';
import {
  groupTripsCreateBodyCarpoolSeatsMax,
  groupTripsCreateBodyCustomGearMax,
  groupTripsCreateBodyDescriptionMax,
  groupTripsCreateBodyMaxPeopleMax,
  groupTripsCreateBodyMaxPeopleMin,
  groupTripsCreateBodyMeetingTextMax,
} from '../../../shared/api/generated/zod/group-trips/group-trips.zod';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, screenPadding, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { Chip } from '../components/Chip';
import { ContactSheet } from '../components/ContactSheet';
import type { LatLng } from '../components/MeetingMap';
import { PickerField } from '../components/PickerField';
import { PinSheet } from '../components/PinSheet';
import { Stepper } from '../components/Stepper';
import { TextSheet } from '../components/TextSheet';
import { hasCode, tripErrorKey } from '../errors';
import { useLeaderGroups } from '../hooks/useLeaderGroups';
import {
  CARPOOL_SEATS_DEFAULT,
  CUSTOM_GEAR_ITEM_MAX,
  LEVELS,
  MAX_PEOPLE_DEFAULT,
  sectionErrors,
  type FormSection,
} from '../schemas';
import {
  DEFAULT_BACK_BY,
  DEFAULT_START,
  MAX_BACK_DAYS,
  PLAN_AHEAD_DAYS,
  addDays,
  clockText,
  daysBetween,
  formatClock,
  formatDay,
  fromPickerDate,
  parseClock,
  tashkentClock,
  tashkentDay,
  timesError,
  toInstant,
  toPickerDate,
  type Clock,
  type TripWindow,
} from '../tripEventTimes';

const HERO_HEIGHT = 96;
const SKELETON_BLOCK = 96;
const DEFAULT_CARPOOL_FROM: Clock = { h: 6, m: 0 };
const gearKeys = Object.values(GearKey);

/** Create a group trip (AC1, AC8; canvas CreateTrip). `groupTripId` edits one (AC5). */
export function CreateTripScreen({ navigation, route }: RootStackScreenProps<'CreateTrip'>) {
  const { placeId, groupTripId } = route.params;
  const place = usePlacesGet(placeId);
  const existing = useGroupTripsGet(groupTripId ?? '', { query: { enabled: groupTripId !== undefined } });
  const waiting = groupTripId !== undefined && existing.isPending;
  const error = place.error ?? (groupTripId ? existing.error : null);

  if (place.data && !waiting) {
    return (
      <TripForm
        place={place.data}
        trip={existing.data ?? null}
        onBack={() => navigation.goBack()}
        onSaved={(id, edited) =>
          edited ? navigation.goBack() : navigation.replace('GroupTrip', { id })
        }
      />
    );
  }
  return (
    <Screen testID="create-trip.screen" scroll>
      <BackButton onPress={() => navigation.goBack()} />
      {error ? (
        <ErrorState
          testID="create-trip.error"
          retryTestID="create-trip.retry"
          error={error}
          onRetry={() => {
            void place.refetch();
            if (groupTripId) {
              void existing.refetch();
            }
          }}
        />
      ) : (
        <View testID="create-trip.skeleton" style={layout.section}>
          <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
          <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
          <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
        </View>
      )}
    </Screen>
  );
}

function placeName(place: PlaceDetailDto, locale: Locale): string {
  return place.name[locale] ?? place.name.uz;
}

function nextSaturday(now: Date): string {
  const today = tashkentDay(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const SATURDAY = 6;
  const WEEK = 7;
  return addDays(today, (SATURDAY - weekday + WEEK) % WEEK || WEEK);
}

type FormState = {
  window: TripWindow;
  meetingText: string;
  pin: LatLng | null;
  carpool: { from: Clock; seats: number } | null;
  maxPeople: number | null;
  minLevel: number | null;
  gear: string[];
  custom: string[];
  description: string;
  groupIds: string[];
  visibility: GroupTripVisibility;
};

function initialState(place: PlaceDetailDto, trip: GroupTripDto | null, now: Date): FormState {
  if (!trip) {
    const day = nextSaturday(now);
    return {
      window: { day, start: DEFAULT_START, backDay: day, backBy: DEFAULT_BACK_BY },
      meetingText: '',
      pin: null,
      carpool: null,
      maxPeople: null,
      minLevel: place.requiredLevel,
      gear: [],
      custom: [],
      description: '',
      groupIds: [],
      visibility: 'public',
    };
  }
  const startAt = new Date(trip.startAt);
  const backBy = new Date(trip.backBy);
  const { lat, lng } = trip.meeting;
  return {
    window: {
      day: tashkentDay(startAt),
      start: tashkentClock(startAt),
      backDay: tashkentDay(backBy),
      backBy: tashkentClock(backBy),
    },
    meetingText: trip.meeting.text,
    pin: lat !== null && lng !== null ? { lat, lng } : null,
    carpool: trip.carpool ? { from: parseClock(trip.carpool.from), seats: trip.carpool.seats } : null,
    maxPeople: trip.maxPeople,
    minLevel: trip.minLevel,
    gear: trip.gear.keys,
    custom: trip.gear.custom,
    description: trip.description,
    groupIds: trip.groups.map(group => group.id),
    visibility: trip.visibility,
  };
}

function createBody(placeId: string, form: FormState): CreateGroupTripDto {
  const { window } = form;
  return {
    placeId,
    groupIds: form.groupIds,
    visibility: form.visibility,
    startAt: toInstant(window.day, window.start).toISOString(),
    backBy: toInstant(window.backDay, window.backBy).toISOString(),
    meetingText: form.meetingText.trim(),
    ...(form.pin ? { meetingLat: form.pin.lat, meetingLng: form.pin.lng } : {}),
    ...(form.carpool ? { carpoolFrom: clockText(form.carpool.from), carpoolSeats: form.carpool.seats } : {}),
    ...(form.maxPeople !== null ? { maxPeople: form.maxPeople } : {}),
    ...(form.minLevel !== null ? { minLevel: form.minLevel } : {}),
    gearKeys: gearKeys.filter(key => form.gear.includes(key)),
    customGear: form.custom,
    description: form.description.trim(),
  };
}

type FormProps = {
  place: PlaceDetailDto;
  trip: GroupTripDto | null;
  onBack: () => void;
  onSaved: (id: string, edited: boolean) => void;
};

function TripForm({ place, trip, onBack, onSaved }: FormProps) {
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const [openedAt] = useState(() => new Date());
  const [form, setForm] = useState<FormState>(() => initialState(place, trip, openedAt));
  const [invalid, setInvalid] = useState<Partial<Record<FormSection, true>>>({});
  const [sheet, setSheet] = useState<'contact' | 'pin' | 'gear' | null>(null);
  const contact = useGetEmergencyContact();
  const { groups } = useLeaderGroups();
  const create = useGroupTripsCreate({ mutation: { meta: { silentError: true } } });
  const update = useGroupTripsUpdate({ mutation: { meta: { silentError: true } } });
  const pending = create.isPending || update.isPending;

  const today = tashkentDay(openedAt);
  const locked = trip !== null && today >= tashkentDay(new Date(trip.startAt));
  const { window } = form;
  const startAt = toInstant(window.day, window.start);
  const backBy = toInstant(window.backDay, window.backBy);
  const inlineError = timesError(window, openedAt);

  // Server gear keys for this window preselect the chips once (create only).
  const preview = useGetTripPreview(
    place.id,
    { startAt: startAt.toISOString(), backBy: backBy.toISOString() },
    { query: { enabled: trip === null && inlineError === null } },
  );
  const preselected = useRef(trip !== null);
  useEffect(() => {
    if (preselected.current || !preview.data) {
      return;
    }
    preselected.current = true;
    const keys = preview.data.gear.map(item => item.key);
    setForm(current => ({ ...current, gear: gearKeys.filter(key => keys.includes(key)) }));
  }, [preview.data]);

  const change = (patch: Partial<FormState>, section?: FormSection) => {
    setForm(current => ({ ...current, ...patch }));
    if (section && invalid[section]) {
      setInvalid(current => ({ ...current, [section]: undefined }));
    }
  };
  const changeWindow = (next: TripWindow) => change({ window: next }, 'times');
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(item => item !== value) : [...list, value];

  const hasContact = Boolean(contact.data);
  const blocked = !isOnline || locked || pending || inlineError !== null || form.meetingText.trim() === '';

  /** `contactSaved`: the contact sheet just saved one, so the cached query may lag behind. */
  const publish = async (contactSaved = false) => {
    if (!hasContact && !contactSaved) {
      setSheet('contact');
      return;
    }
    const body = createBody(place.id, form);
    try {
      let saved: GroupTripDto;
      if (trip) {
        saved = await update.mutateAsync({
          id: trip.id,
          data: {
            ...body,
            meetingLat: form.pin?.lat ?? null,
            meetingLng: form.pin?.lng ?? null,
            carpoolFrom: form.carpool ? clockText(form.carpool.from) : null,
            carpoolSeats: form.carpool?.seats ?? null,
            maxPeople: form.maxPeople,
            minLevel: form.minLevel,
          },
        });
      } else {
        saved = await create.mutateAsync({ data: body });
      }
      queryClient.setQueryData(getGroupTripsGetQueryKey(saved.id), saved);
      haptics.success();
      toast.show({ variant: 'success', message: t(trip ? 'tripEvents.create.saved' : 'tripEvents.create.published') });
      onSaved(saved.id, trip !== null);
    } catch (error) {
      haptics.error();
      const sections = sectionErrors(error);
      if (sections) {
        setInvalid(sections);
        return;
      }
      if (hasCode(error, 'EMERGENCY_CONTACT_REQUIRED')) {
        setSheet('contact');
        return;
      }
      toast.show({ variant: 'error', message: t(tripErrorKey(error)) });
    }
  };

  const sectionError = (section: FormSection) =>
    invalid[section] ? (
      <AppText testID={`create-trip.error-${section}`} variant="small" accessibilityRole="alert" style={styles.error}>
        {t(`tripEvents.create.invalid.${section}`)}
      </AppText>
    ) : null;

  const timeLabel = (label: string, day: string, clock: Clock) => `${label} ${formatClock(toInstant(day, clock), locale)}`;

  return (
    <View style={styles.root}>
      <Screen testID="create-trip.screen" scroll keyboardAware showOfflineBanner bottomInset={false}>
        <BackButton onPress={onBack} />
        <AppText variant="h1" accessibilityRole="header">
          {t(trip ? 'tripEvents.create.editTitle' : 'tripEvents.create.title')}
        </AppText>
        {locked ? (
          <AppText testID="create-trip.locked" variant="body" accessibilityRole="alert" style={styles.error}>
            {t('tripEvents.create.locked')}
          </AppText>
        ) : null}

        <Section label={t('tripEvents.create.place')}>
          <View testID="create-trip.place" style={styles.card}>
            <Image source={placeHeroes[place.type]} resizeMode="cover" accessible={false} style={layout.hero} />
            <View style={layout.placeRow}>
              <View style={layout.fill}>
                <AppText variant="h3">{placeName(place, locale)}</AppText>
                <AppText variant="small">
                  {t('tripEvents.create.placeMeta', { difficulty: place.difficulty })}
                </AppText>
              </View>
              <Pressable
                testID="create-trip.place-change"
                accessibilityRole="button"
                accessibilityLabel={t('tripEvents.create.change')}
                onPress={onBack}
                style={layout.change}
              >
                <AppText variant="chip" tone="teal700">
                  {t('tripEvents.create.change')}
                </AppText>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section label={t('tripEvents.create.date')}>
          <PickerField
            testID="create-trip.date"
            text={formatDay(window.day, locale)}
            accessibilityLabel={`${t('tripEvents.create.date')} ${formatDay(window.day, locale)}`}
            mode="date"
            value={toPickerDate(window.day, window.start)}
            minimumDate={toPickerDate(today, window.start)}
            maximumDate={toPickerDate(addDays(today, PLAN_AHEAD_DAYS), window.start)}
            onChange={value => {
              const day = fromPickerDate(value).day;
              changeWindow({ ...window, day, backDay: addDays(day, daysBetween(window.day, window.backDay)) });
            }}
          />
        </Section>
        <View style={layout.row}>
          <Section label={t('tripEvents.create.start')}>
            <PickerField
              testID="create-trip.start"
              text={formatClock(startAt, locale)}
              accessibilityLabel={timeLabel(t('tripEvents.create.start'), window.day, window.start)}
              mode="time"
              value={toPickerDate(window.day, window.start)}
              onChange={value => changeWindow({ ...window, start: fromPickerDate(value).clock })}
            />
          </Section>
          <Section label={t('tripEvents.create.backBy')}>
            <View style={layout.row}>
              <PickerField
                testID="create-trip.back-by-day"
                text={formatDay(window.backDay, locale)}
                accessibilityLabel={`${t('tripEvents.create.backBy')} ${formatDay(window.backDay, locale)}`}
                mode="date"
                value={toPickerDate(window.backDay, window.backBy)}
                minimumDate={toPickerDate(window.day, window.backBy)}
                maximumDate={toPickerDate(addDays(window.day, MAX_BACK_DAYS), window.backBy)}
                onChange={value => changeWindow({ ...window, backDay: fromPickerDate(value).day })}
              />
              <PickerField
                testID="create-trip.back-by"
                text={formatClock(backBy, locale)}
                accessibilityLabel={timeLabel(t('tripEvents.create.backBy'), window.backDay, window.backBy)}
                mode="time"
                value={toPickerDate(window.backDay, window.backBy)}
                onChange={value => changeWindow({ ...window, backBy: fromPickerDate(value).clock })}
              />
            </View>
          </Section>
        </View>
        {inlineError ? (
          <AppText testID="create-trip.times-error" variant="small" accessibilityRole="alert" style={styles.error}>
            {t(`tripEvents.create.${inlineError}`)}
          </AppText>
        ) : null}
        {sectionError('times')}

        <Section label={t('tripEvents.create.meeting')}>
          <TextField
            testID="create-trip.meeting"
            label={t('tripEvents.create.meetingLabel')}
            value={form.meetingText}
            onChangeText={meetingText => change({ meetingText }, 'meeting')}
            maxLength={groupTripsCreateBodyMeetingTextMax}
            placeholder={t('tripEvents.create.meetingPlaceholder')}
          />
          <AppButton
            testID="create-trip.meeting-pin"
            variant="white"
            label={form.pin ? t('tripEvents.meeting.pinned') : t('tripEvents.meeting.pin')}
            onPress={() => setSheet('pin')}
          />
          {sectionError('meeting')}
        </Section>

        <Section label={t('tripEvents.create.carpool')}>
          <SwitchRow
            testID="create-trip.carpool-toggle"
            label={t('tripEvents.create.carpoolOffer')}
            value={form.carpool !== null}
            onChange={on =>
              change({ carpool: on ? { from: DEFAULT_CARPOOL_FROM, seats: CARPOOL_SEATS_DEFAULT } : null }, 'carpool')
            }
          />
          {form.carpool ? (
            <View style={layout.row}>
              <PickerField
                testID="create-trip.carpool-from"
                text={clockText(form.carpool.from)}
                accessibilityLabel={`${t('tripEvents.create.carpoolFrom')} ${clockText(form.carpool.from)}`}
                mode="time"
                value={toPickerDate(window.day, form.carpool.from)}
                onChange={value =>
                  form.carpool && change({ carpool: { ...form.carpool, from: fromPickerDate(value).clock } }, 'carpool')
                }
              />
              <Stepper
                testID="create-trip.carpool-seats"
                label={t('tripEvents.create.seats')}
                value={form.carpool.seats}
                min={1}
                max={groupTripsCreateBodyCarpoolSeatsMax}
                onChange={seats => form.carpool && change({ carpool: { ...form.carpool, seats } }, 'carpool')}
              />
            </View>
          ) : null}
          {sectionError('carpool')}
        </Section>

        <Section label={t('tripEvents.create.maxPeople')}>
          <SwitchRow
            testID="create-trip.max-people-toggle"
            label={form.maxPeople === null ? t('tripEvents.create.noLimit') : t('tripEvents.create.limit')}
            value={form.maxPeople !== null}
            onChange={on => change({ maxPeople: on ? MAX_PEOPLE_DEFAULT : null }, 'maxPeople')}
          />
          {form.maxPeople !== null ? (
            <Stepper
              testID="create-trip.max-people"
              label={t('tripEvents.create.maxPeople')}
              value={form.maxPeople}
              min={groupTripsCreateBodyMaxPeopleMin}
              max={groupTripsCreateBodyMaxPeopleMax}
              onChange={maxPeople => change({ maxPeople }, 'maxPeople')}
            />
          ) : null}
          {sectionError('maxPeople')}
        </Section>

        <Section label={t('tripEvents.create.minLevel')}>
          <View testID="create-trip.min-level" style={layout.chips}>
            {LEVELS.map(level => (
              <Chip
                key={level}
                testID={`create-trip.min-level-${level}`}
                label={`L${level} ${t(`levels.animal.${level}`)}`}
                selected={form.minLevel === level}
                onPress={() => change({ minLevel: form.minLevel === level ? null : level }, 'minLevel')}
              />
            ))}
          </View>
          <AppText variant="small">{t('tripEvents.create.minLevelHint')}</AppText>
          {sectionError('minLevel')}
        </Section>

        <Section label={t('tripEvents.create.gear')}>
          <View style={layout.chips}>
            {gearKeys.map(key => (
              <Chip
                key={key}
                testID={`create-trip.gear-${key}`}
                label={t(`tripEvents.gear.${key}`)}
                selected={form.gear.includes(key)}
                onPress={() => change({ gear: toggle(form.gear, key) }, 'gear')}
              />
            ))}
            {form.custom.map((item, index) => (
              <Chip
                key={item}
                testID={`create-trip.gear-custom-${index}`}
                label={item}
                selected
                onPress={() => change({ custom: form.custom.filter(other => other !== item) }, 'gear')}
              />
            ))}
            <Chip
              testID="create-trip.gear-add"
              label={t('tripEvents.create.addGear')}
              selected={false}
              disabled={form.custom.length >= groupTripsCreateBodyCustomGearMax}
              onPress={() => setSheet('gear')}
            />
          </View>
          {sectionError('gear')}
        </Section>

        <Section label={t('tripEvents.create.description')}>
          <TextField
            testID="create-trip.description"
            label={t('tripEvents.create.descriptionLabel')}
            optionalLabel={t('tripEvents.optional')}
            value={form.description}
            onChangeText={description => change({ description }, 'description')}
            maxLength={groupTripsCreateBodyDescriptionMax}
          />
          {sectionError('description')}
        </Section>

        <Section label={t('tripEvents.create.groups')}>
          {groups.length === 0 ? (
            <AppText variant="small">{t('tripEvents.create.noGroups')}</AppText>
          ) : (
            <View style={layout.chips}>
              {groups.map(group => (
                <Chip
                  key={group.id}
                  testID={`create-trip.group-${group.id}`}
                  label={group.name}
                  selected={form.groupIds.includes(group.id)}
                  onPress={() => change({ groupIds: toggle(form.groupIds, group.id) }, 'groups')}
                />
              ))}
            </View>
          )}
          {sectionError('groups')}
        </Section>

        <Section label={t('tripEvents.create.visibility')}>
          <View style={layout.chips}>
            <Chip
              testID="create-trip.public"
              label={t('tripEvents.create.public')}
              selected={form.visibility === 'public'}
              onPress={() => change({ visibility: 'public' })}
            />
            <Chip
              testID="create-trip.private"
              label={t('tripEvents.create.private')}
              selected={form.visibility === 'private'}
              onPress={() => change({ visibility: 'private' })}
            />
          </View>
          <AppText variant="small">
            {t(form.visibility === 'public' ? 'tripEvents.create.publicHint' : 'tripEvents.create.privateHint')}
          </AppText>
        </Section>
      </Screen>
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
        <AppButton
          testID="create-trip.publish"
          label={t(trip ? 'tripEvents.create.save' : 'tripEvents.create.publish')}
          disabled={blocked}
          loading={pending}
          onPress={() => void publish()}
        />
      </View>
      {sheet === 'contact' ? (
        <ContactSheet scope="create-trip" onSaved={() => void publish(true)} onDismiss={() => setSheet(null)} />
      ) : null}
      {sheet === 'pin' ? (
        <PinSheet
          center={{ lat: place.latitude, lng: place.longitude }}
          initial={form.pin}
          onDone={pin => change({ pin }, 'meeting')}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'gear' ? (
        <TextSheet
          testID="create-trip.gear-sheet"
          title={t('tripEvents.create.addGearTitle')}
          label={t('tripEvents.create.addGearLabel')}
          inputTestID="create-trip.gear-input"
          submitTestID="create-trip.gear-save"
          submitLabel={t('tripEvents.create.addGear')}
          maxLength={CUSTOM_GEAR_ITEM_MAX}
          onSubmit={value => {
            if (value !== '' && !form.custom.includes(value)) {
              change({ custom: [...form.custom, value] }, 'gear');
            }
            return true;
          }}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={[layout.section, layout.fill]}>
      <AppText variant="caption">{label}</AppText>
      {children}
    </View>
  );
}

type SwitchRowProps = { testID: string; label: string; value: boolean; onChange: (value: boolean) => void };

function SwitchRow({ testID, label, value, onChange }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={layout.switchRow}>
      <AppText variant="body" style={layout.fill}>
        {label}
      </AppText>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={next => {
          haptics.selection();
          onChange(next);
        }}
        trackColor={{ true: colors.teal700, false: colors.line }}
      />
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID="create-trip.back"
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
  section: { gap: spacing[8] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  hero: { width: '100%', height: HERO_HEIGHT },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[12], padding: spacing[14] },
  change: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[8] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[12], minHeight: sizes.touchTarget },
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
  error: { color: c.red700 },
  footer: {
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
