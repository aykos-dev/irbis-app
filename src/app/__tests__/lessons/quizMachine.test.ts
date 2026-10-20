import {
  answer,
  currentIndex,
  firstTryCount,
  isPerfect,
  next,
  startQuiz,
  type QuizState,
} from '../../../features/lessons/quizMachine';

const QUESTIONS = [
  { id: 'q1', correctIndex: 0 },
  { id: 'q2', correctIndex: 2 },
];

function play(state: QuizState, optionIndex: number): QuizState {
  return next(answer(state, QUESTIONS, optionIndex));
}

describe('quizMachine (AC5, AC6)', () => {
  it('AC5: a wrong question is re-asked after the last one until right; every attempt is kept in order', () => {
    let run = startQuiz(2, 5, false);
    run = play(run, 1); // q1 wrong
    expect(run.hearts).toBe(4);
    expect(currentIndex(run)).toBe(1);
    run = play(run, 2); // q2 right
    expect(currentIndex(run)).toBe(0);
    run = answer(run, QUESTIONS, 3); // q1 wrong again
    expect(run.retry).toBe(true);
    run = play(next(run), 0); // q1 right
    expect(run.phase).toBe('done');
    expect(run.hearts).toBe(3);
    expect(run.attempts).toEqual([
      { questionId: 'q1', optionIndex: 1 },
      { questionId: 'q2', optionIndex: 2 },
      { questionId: 'q1', optionIndex: 3 },
      { questionId: 'q1', optionIndex: 0 },
    ]);
    expect(firstTryCount(run)).toBe(1);
    expect(isPerfect(run)).toBe(false);
  });

  it('AC6: a new lesson fails when hearts reach 0; practice loses no hearts and never fails', () => {
    const failed = play(startQuiz(2, 1, false), 1);
    expect(failed.hearts).toBe(0);
    expect(failed.phase).toBe('failed');
    expect(startQuiz(2, 0, false).phase).toBe('failed');

    let practice = startQuiz(2, 0, true);
    practice = play(practice, 1);
    expect(practice.phase).toBe('asking');
    expect(practice.hearts).toBe(0);
    practice = play(play(play(practice, 2), 0), 0);
    expect(practice.phase).toBe('done');
  });
});
