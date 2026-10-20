import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
  type Code,
} from 'react-native-vision-camera';
import WifiManager from 'react-native-wifi-reborn';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, ThemeProvider, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { campScheme, joinSizes } from '../campTheme';
import { RoomCodeInput } from '../components/RoomCodeInput';
import { discoverRoom, findRoomAt, type DiscoveryResult, type FoundRoom } from '../join/discovery';
import { createPlayerClient, playerSession, type PlayerClient, type PlayerEnd } from '../join/playerClient';
import { readSeatToken } from '../join/seatStore';
import { campNet } from '../native/campNet';
import { initialProfile, readProfile } from '../playerProfile';
import { MAX_SEATS } from '../protocol/codec';
import { parseJoinUrl, type JoinInfo } from '../protocol/qr';

type JoinError = 'not_found' | 'full' | 'version' | 'wifi' | 'removed' | 'closed';

type Attempt = { kind: 'code'; code: string } | { kind: 'qr'; info: JoinInfo };

type JoinState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'found'; room: FoundRoom }
  | { phase: 'joining'; room: FoundRoom }
  | { phase: 'error'; reason: JoinError };

const errorCopy: Record<JoinError, string> = {
  not_found: 'camp.join.notFound',
  full: 'camp.join.full',
  version: 'camp.join.version',
  wifi: 'camp.join.wifiFailed',
  removed: 'camp.join.removed',
  closed: 'camp.join.closed',
};

/** Why a hello did not end in a seat, as the join screen shows it. */
function endToError(reason: PlayerEnd): JoinError {
  switch (reason) {
    case 'full':
    case 'version':
    case 'removed':
    case 'closed':
      return reason;
    default:
      return 'not_found';
  }
}

function reportFailure(reason: JoinError): void {
  if (reason !== 'removed' && reason !== 'closed') {
    qaLog('camp_join_failed', { reason });
  }
}

/** The QR carries the host's hotspot: join it unless the phone is already on it. */
async function joinHostWifi(wifi: NonNullable<JoinInfo['wifi']>): Promise<boolean> {
  if ((await campNet.getWifiName()) === wifi.ssid) {
    return true;
  }
  try {
    await WifiManager.connectToProtectedSSID(wifi.ssid, wifi.password, false, false);
    return true;
  } catch {
    return false;
  }
}

/**
 * CampJoin (AC5): scan the host's QR (joins its hotspot when the QR carries one) or type the room
 * code (Bonjour, then a subnet scan); found → "Join as <name>" → seated → player lobby.
 */
export function CampJoinScreen({ navigation }: RootStackScreenProps<'CampJoin'>) {
  useLocale();
  const styles = useStyles();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [state, setState] = useState<JoinState>({ phase: 'idle' });
  const lastAttempt = useRef<Attempt | null>(null);
  const search = useRef<AbortController | null>(null);
  const pending = useRef<{ client: PlayerClient; unsubscribe: () => void } | null>(null);
  const [profile] = useState(() => readProfile() ?? initialProfile(null, undefined));

  const busy = state.phase === 'searching' || state.phase === 'joining';

  const fail = useCallback((reason: JoinError) => {
    haptics.error();
    reportFailure(reason);
    setState({ phase: 'error', reason });
  }, []);

  const settle = useCallback(
    (result: DiscoveryResult) => {
      if (result.kind === 'found') {
        const { room } = result;
        if (room.players >= MAX_SEATS && !readSeatToken(room.code)) {
          fail('full');
          return;
        }
        haptics.success();
        setState({ phase: 'found', room });
        return;
      }
      fail(result.kind);
    },
    [fail],
  );

  const run = useCallback(
    async (attempt: Attempt) => {
      search.current?.abort();
      const controller = new AbortController();
      search.current = controller;
      lastAttempt.current = attempt;
      setState({ phase: 'searching' });
      if (attempt.kind === 'qr' && attempt.info.wifi && !(await joinHostWifi(attempt.info.wifi))) {
        if (!controller.signal.aborted) {
          fail('wifi');
        }
        return;
      }
      const result =
        attempt.kind === 'qr'
          ? await findRoomAt(attempt.info.ip, attempt.info.port, attempt.info.code, controller.signal)
          : await discoverRoom(attempt.code, controller.signal);
      if (!controller.signal.aborted) {
        settle(result);
      }
    },
    [fail, settle],
  );

  const stopPending = useCallback(() => {
    const current = pending.current;
    pending.current = null;
    current?.unsubscribe();
    current?.client.stop();
  }, []);

  useEffect(
    () => () => {
      search.current?.abort();
      stopPending();
    },
    [stopPending],
  );

  const onCode = (value: string) => {
    setCode(value);
    if (value.length === joinSizes.codeDigits) {
      run({ kind: 'code', code: value });
    }
  };

  const onScanned = (codes: Code[]) => {
    if (busy || state.phase === 'found') {
      return;
    }
    const info = codes.map(item => (item.value ? parseJoinUrl(item.value) : null)).find(Boolean);
    if (info) {
      haptics.tap();
      setCode(info.code);
      run({ kind: 'qr', info });
    }
  };

  const join = (room: FoundRoom) => {
    haptics.tap();
    stopPending();
    const client = createPlayerClient({
      code: room.code,
      host: room.host,
      port: room.port,
      nickname: profile.nickname,
      avatar: profile.animal,
    });
    const unsubscribe = client.subscribe(() => {
      const snapshot = client.getSnapshot();
      if (snapshot.status === 'connected') {
        pending.current?.unsubscribe();
        pending.current = null;
        playerSession.set(client);
        haptics.success();
        navigation.replace('CampLobby', { player: true });
      } else if (snapshot.ended) {
        stopPending();
        fail(endToError(snapshot.ended));
      }
    });
    pending.current = { client, unsubscribe };
    setState({ phase: 'joining', room });
    client.start();
  };

  const retry = () => {
    if (lastAttempt.current) {
      run(lastAttempt.current);
    }
  };

  return (
    <ThemeProvider scheme={campScheme}>
      <Screen testID="camp.join.screen" keyboardAware showOfflineBanner={false}>
        <View style={layout.header}>
          <Pressable
            testID="camp.join.back"
            accessibilityRole="button"
            accessibilityLabel={t('camp.join.back')}
            hitSlop={spacing[8]}
            onPress={() => navigation.goBack()}
            style={layout.back}
          >
            <Icon name="back" color={colors.ink} />
          </Pressable>
          <AppText variant="h2" accessibilityRole="header">
            {t('camp.join.title')}
          </AppText>
        </View>

        <Viewfinder active={!busy && state.phase !== 'found'} onScanned={onScanned} />

        <AppText variant="body" tone="muted" style={layout.center}>
          {t('camp.join.orCode')}
        </AppText>
        <RoomCodeInput value={code} onChangeText={onCode} label={t('camp.join.orCode')} editable={!busy} />

        {state.phase === 'searching' ? (
          <View testID="camp.join.searching" style={layout.row} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.orange} />
            <AppText variant="body">{t('camp.join.searching')}</AppText>
          </View>
        ) : null}

        {state.phase === 'found' || state.phase === 'joining' ? (
          <View style={layout.section}>
            <View testID="camp.join.found" style={[layout.card, styles.card]} accessibilityLiveRegion="polite">
              <Icon name="checkCircle" color={colors.pine} accent={colors.white} />
              <View style={layout.flex}>
                <AppText variant="h3">{t('camp.join.connected', { network: state.room.network })}</AppText>
                <AppText variant="small">{t('camp.join.roomFound', { n: state.room.players })}</AppText>
              </View>
            </View>
            <AppButton
              testID="camp.join.submit"
              label={t('camp.join.as', { name: profile.nickname })}
              loading={state.phase === 'joining'}
              onPress={() => join(state.room)}
            />
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <View testID="camp.join.error" style={[layout.card, layout.column, styles.card]} accessibilityLiveRegion="polite">
            <AppText variant="body" style={styles.errorText}>
              {t(errorCopy[state.reason])}
            </AppText>
            <AppButton testID="camp.join.retry" label={t('camp.lobby.tryAgain')} variant="white" onPress={retry} />
          </View>
        ) : null}

        <AppText testID="camp.join.hint" variant="small" tone="muted" style={layout.center}>
          {t('camp.join.hint')}
        </AppText>
      </Screen>
    </ThemeProvider>
  );
}

/** Camera area with orange corners; denied → a note and "Allow camera" (code entry still works). */
function Viewfinder({ active, onScanned }: { active: boolean; onScanned: (codes: Code[]) => void }) {
  const styles = useStyles();
  const focused = useIsFocused();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [denied, setDenied] = useState(false);
  const asked = useRef(false);
  const codeScanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned: onScanned });

  // Android reports 'denied' before the first request too, so any non-granted status asks the OS once;
  // the hook re-reads the status on app foreground, so a grant made in Settings starts the camera.
  useEffect(() => {
    if (hasPermission) {
      setDenied(false);
      return;
    }
    if (asked.current) {
      setDenied(true);
      return;
    }
    asked.current = true;
    requestPermission().then(granted => setDenied(!granted));
  }, [hasPermission, requestPermission]);

  // Ask the OS dialog again; only a denied answer (the OS will not ask any more) leads to Settings.
  const allowCamera = async () => {
    haptics.tap();
    if (!(await requestPermission())) {
      Linking.openSettings();
    }
  };

  useEffect(() => {
    if (denied) {
      qaLog('camp_join_failed', { reason: 'camera_denied' });
    }
  }, [denied]);

  return (
    <View style={[layout.camera, styles.camera]}>
      {hasPermission && device ? (
        <Camera
          testID="camp.join.camera"
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={focused && active}
          codeScanner={codeScanner}
        />
      ) : null}
      {denied && !hasPermission ? (
        <View testID="camp.join.camera-denied" style={layout.denied}>
          <AppText variant="body" style={layout.center}>
            {t('camp.join.cameraDenied')}
          </AppText>
          <AppButton
            testID="camp.join.allow-camera"
            label={t('camp.join.allowCamera')}
            variant="white"
            onPress={allowCamera}
          />
        </View>
      ) : null}
      <View style={[layout.corner, layout.topStart, styles.corner]} pointerEvents="none" />
      <View style={[layout.corner, layout.topEnd, styles.corner]} pointerEvents="none" />
      <View style={[layout.corner, layout.bottomStart, styles.corner]} pointerEvents="none" />
      <View style={[layout.corner, layout.bottomEnd, styles.corner]} pointerEvents="none" />
      {!denied ? (
        <AppText variant="small" style={[layout.caption, styles.caption]}>
          {t('camp.join.point')}
        </AppText>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[8], marginBottom: spacing[16] },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  section: { gap: spacing[12], marginTop: spacing[16] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[8], marginTop: spacing[16] },
  column: { flexDirection: 'column', alignItems: 'stretch', marginTop: spacing[16] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  camera: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: joinSizes.cameraWidth,
    height: joinSizes.cameraHeight,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: spacing[20],
  },
  denied: { flex: 1, justifyContent: 'center', gap: spacing[16], padding: spacing[24] },
  corner: { position: 'absolute', width: joinSizes.corner, height: joinSizes.corner },
  topStart: {
    top: spacing[16],
    start: spacing[16],
    borderTopWidth: joinSizes.cornerStroke,
    borderStartWidth: joinSizes.cornerStroke,
    borderTopStartRadius: radii.input,
  },
  topEnd: {
    top: spacing[16],
    end: spacing[16],
    borderTopWidth: joinSizes.cornerStroke,
    borderEndWidth: joinSizes.cornerStroke,
    borderTopEndRadius: radii.input,
  },
  bottomStart: {
    bottom: spacing[16],
    start: spacing[16],
    borderBottomWidth: joinSizes.cornerStroke,
    borderStartWidth: joinSizes.cornerStroke,
    borderBottomStartRadius: radii.input,
  },
  bottomEnd: {
    bottom: spacing[16],
    end: spacing[16],
    borderBottomWidth: joinSizes.cornerStroke,
    borderEndWidth: joinSizes.cornerStroke,
    borderBottomEndRadius: radii.input,
  },
  caption: {
    position: 'absolute',
    bottom: spacing[16] + joinSizes.corner + spacing[8],
    start: spacing[24],
    end: spacing[24],
    textAlign: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
  camera: { backgroundColor: c.line },
  corner: { borderColor: c.orange },
  caption: { color: c.ink },
  errorText: { color: c.ink },
}));
