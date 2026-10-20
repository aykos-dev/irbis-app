import { AudioContext, AudioManager, type AudioBuffer } from 'react-native-audio-api';

import completeClip from '../../assets/sounds/lesson-complete.m4a';
import correctClip from '../../assets/sounds/lesson-correct.m4a';
import wrongClip from '../../assets/sounds/lesson-wrong.m4a';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';

const CLIPS = ['correct', 'wrong', 'complete'] as const;
export type Clip = (typeof CLIPS)[number];

const clips: Record<Clip, number> = { correct: correctClip, wrong: wrongClip, complete: completeClip };

let context: AudioContext | null = null;
const buffers: Partial<Record<Clip, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

/** Audio never breaks the quiz: the error is logged and the lesson goes on silently. */
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

/** Quiz sounds (AC5, AC7) with `react-native-audio-api`; the three clips load once per app run. */
export const sounds = {
  load(): Promise<void> {
    loading ??= loadAll();
    return loading;
  },

  play(clip: Clip): void {
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
      logFailure(`play_${clip}`, error);
    }
  },

  /** MMKV `lessons.muted`; sound is on by default. */
  muted(): boolean {
    return storage.getString('lessons.muted') === '1';
  },

  setMuted(muted: boolean): void {
    storage.setString('lessons.muted', muted ? '1' : '0');
  },
};
