import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { z } from 'zod';

/**
 * Screen protection for secret cards (campfire-party AC3), over the same in-repo `CampNet` module
 * as `campNet.ts`: Android `setSecure` (FLAG_SECURE), iOS `isCaptured` plus the
 * `campCaptureChanged` event from the `CampCapture` emitter. Kept apart from `campNet`, whose
 * callers replace that module whole. No native module (Jest, other platform) = no-op.
 */
type AndroidSecure = { setSecure: (on: boolean) => void };
type IosCapture = { isCaptured: () => Promise<unknown> };

function isAndroidSecure(value: unknown): value is AndroidSecure {
  return typeof value === 'object' && value !== null && 'setSecure' in value;
}

function isIosCapture(value: unknown): value is IosCapture {
  return typeof value === 'object' && value !== null && 'isCaptured' in value;
}

const capturedEventSchema = z.object({ captured: z.boolean() });

/** Android: blocks (on) or allows (off) screenshots and recording of this activity. */
function setSecure(on: boolean): void {
  const module: unknown = NativeModules.CampNet;
  if (Platform.OS === 'android' && isAndroidSecure(module)) {
    module.setSecure(on);
  }
}

/** iOS: whether the screen is being recorded or mirrored right now. Android: always false. */
async function isCaptured(): Promise<boolean> {
  const module: unknown = NativeModules.CampNet;
  if (Platform.OS !== 'ios' || !isIosCapture(module)) {
    return false;
  }
  return (await module.isCaptured()) === true;
}

/** iOS: calls `listener` when recording or mirroring starts or stops. Returns the unsubscribe. */
function onCaptureChange(listener: (captured: boolean) => void): () => void {
  const emitter: unknown = NativeModules.CampCapture;
  if (Platform.OS !== 'ios' || typeof emitter !== 'object' || emitter === null) {
    return () => undefined;
  }
  const subscription = new NativeEventEmitter(NativeModules.CampCapture).addListener(
    'campCaptureChanged',
    (event: unknown) => {
      const parsed = capturedEventSchema.safeParse(event);
      if (parsed.success) {
        listener(parsed.data.captured);
      }
    },
  );
  return () => subscription.remove();
}

export const secureScreen = { setSecure, isCaptured, onCaptureChange };
