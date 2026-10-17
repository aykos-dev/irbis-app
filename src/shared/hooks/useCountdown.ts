import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * Whole seconds left, counting down once a second from `start()`. Based on a deadline, so a
 * backgrounded app catches up instead of drifting.
 */
export function useCountdown(): { secondsLeft: number; start: (seconds: number) => void } {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setDeadline(current + seconds * TICK_MS);
  }, []);

  const secondsLeft = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / TICK_MS));
  return { secondsLeft, start };
}
