import type { CompletionAttempt } from '../../shared/api/generated/model';

/** What the quiz needs of a question: its id and the right option. */
export type QuizQuestion = { id: string; correctIndex: number };

/**
 * One lesson run (AC5, AC6), pure. `queue` holds question indexes still to answer right; its head
 * is on screen. A wrong answer moves the question to the end of the queue and, outside practice,
 * costs a heart.
 *
 * - `asking`: waiting for Check · `answered`: the sheet shows `lastCorrect`
 * - `failed`: no hearts left in a new lesson · `done`: every question answered right
 */
export type QuizState = {
  phase: 'asking' | 'answered' | 'failed' | 'done';
  queue: number[];
  total: number;
  /** Questions answered right so far (progress bar). */
  right: number;
  /** Ids of questions answered wrong at least once. */
  missed: string[];
  attempts: CompletionAttempt[];
  hearts: number;
  practice: boolean;
  lastCorrect: boolean | null;
  /** True when the question on screen was answered wrong before (QA `retry`). */
  retry: boolean;
};

export function startQuiz(total: number, hearts: number, practice: boolean): QuizState {
  return {
    phase: !practice && hearts <= 0 ? 'failed' : 'asking',
    queue: Array.from({ length: total }, (_, index) => index),
    total,
    right: 0,
    missed: [],
    attempts: [],
    hearts,
    practice,
    lastCorrect: null,
    retry: false,
  };
}

/** The index of the question on screen, if any. */
export function currentIndex(state: QuizState): number | undefined {
  return state.queue[0];
}

/** Check pressed with `optionIndex` picked. */
export function answer(state: QuizState, questions: QuizQuestion[], optionIndex: number): QuizState {
  const index = currentIndex(state);
  const question = index === undefined ? undefined : questions[index];
  if (state.phase !== 'asking' || index === undefined || !question) {
    return state;
  }
  const correct = optionIndex === question.correctIndex;
  const attempts = [...state.attempts, { questionId: question.id, optionIndex }];
  const retry = state.missed.includes(question.id);
  if (correct) {
    return { ...state, phase: 'answered', attempts, right: state.right + 1, lastCorrect: true, retry };
  }
  return {
    ...state,
    phase: 'answered',
    attempts,
    missed: retry ? state.missed : [...state.missed, question.id],
    hearts: state.practice ? state.hearts : Math.max(0, state.hearts - 1),
    lastCorrect: false,
    retry,
  };
}

/** Continue / Got it on the sheet: the next question, or the end of the run. */
export function next(state: QuizState): QuizState {
  if (state.phase !== 'answered') {
    return state;
  }
  const [head, ...rest] = state.queue;
  const queue = state.lastCorrect || head === undefined ? rest : [...rest, head];
  if (!state.practice && state.hearts <= 0 && !state.lastCorrect) {
    return { ...state, phase: 'failed', queue };
  }
  if (queue.length === 0) {
    return { ...state, phase: 'done', queue };
  }
  return { ...state, phase: 'asking', queue, lastCorrect: null };
}

/** Questions answered right on the first try. */
export function firstTryCount(state: QuizState): number {
  return state.total - state.missed.length;
}

export function isPerfect(state: QuizState): boolean {
  return state.missed.length === 0;
}
