import { useCompletionSync } from '../features/lessons/hooks/useCompletionSync';

/** Session-level lessons wiring above the navigator: the completion sync (lessons AC7). */
export function LessonSyncHost() {
  useCompletionSync();
  return null;
}
