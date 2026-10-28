import { useCallback, useEffect, useState } from 'react';

/** Secondes restantes avant `deadline` (arrondi supérieur, jamais négatif). */
export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

const systemNow = () => Date.now();

/**
 * Compte à rebours en secondes (renvoi du code, limite atteinte). Calculé sur l'heure de fin et non
 * décrémenté : il reste juste si l'onglet est mis en veille.
 */
export function useCountdown(now: () => number = systemNow) {
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = secondsLeft(deadline, now());
      setRemaining(left);
      if (left === 0) setDeadline(0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, now]);

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        setDeadline(0);
        setRemaining(0);
        return;
      }
      setRemaining(Math.ceil(seconds));
      setDeadline(now() + seconds * 1000);
    },
    [now],
  );

  return { remaining, start };
}
