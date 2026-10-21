import { AudioContext, AudioManager, type AudioBuffer } from 'react-native-audio-api';

import completeClip from '../../assets/sounds/lesson-complete.m4a';
import correctClip from '../../assets/sounds/lesson-correct.m4a';
import wrongClip from '../../assets/sounds/lesson-wrong.m4a';
import { storage } from '../storage';
import { qaLog } from '../utils/qaLog';

const CLIPS = ['correct', 'wrong', 'complete'] as const;
export type Clip = (typeof CLIPS)[number];

const clips: Record<Clip, number> = { correct: correctClip, wrong: wrongClip, complete: completeClip };

let context: AudioContext | null = null;
const buffers: Partial<Record<Clip, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

/** Audio never breaks a screen: the error is logged and the lesson or game goes on silently. */
function logFailure(stage: string, error: unknown): void {
  qaLog('lesson_audio_error', { stage, error: error instanceof Error ? error.name : 'unknown' });
}

async function loadAll(): Promise<void> {
  try {
    // iOS `ambient`: respects the silent switch and mixes with the user's music.
    AudioManager.setAudioSessionOptions({ iosCategory: 'ambient', iosOptions: ['mixWithOthers'] });
    context = new AudioContext();
  } catch (error) {
    logFailure('context', error);
    return;
  }
  const audio = context;
  await Promise.all(
    CLIPS.map(async clip => {
      try {
        buffers[clip] = await audio.decodeAudioData(clips[clip]);
      } catch (error) {
        logFailure(`decode_${clip}`, error);
      }
    }),
  );
}

/**
 * App sounds with `react-native-audio-api` (lessons quiz, X and O); the three clips load once per
 * app run and one mute setting covers every screen.
 */
export const sounds = {
  load(): Promise<void> {
    loading ??= loadAll();
    return loading;
  },

  /** `stage` prefixes a failure's logged stage (e.g. `xo_`) so callers other than the quiz stand out. */
  play(clip: Clip, stage = ''): void {
    const buffer = buffers[clip];
    if (sounds.muted() || !context || !buffer) {
      return;
    }
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    } catch (error) {
      logFailure(`${stage}play_${clip}`, error);
    }
  },

  /** MMKV `lessons.muted` (shared by every screen with sound); sound is on by default. */
  muted(): boolean {
    return storage.getString('lessons.muted') === '1';
  },

  setMuted(muted: boolean): void {
    storage.setString('lessons.muted', muted ? '1' : '0');
  },

  /** Flips the shared mute; returns the new value. */
  toggleMuted(): boolean {
    const next = !sounds.muted();
    sounds.setMuted(next);
    return next;
  },
};
