'use client';

import { useEffect, useRef, useState } from 'react';

export type LivePrice<T> =
  | { status: 'idle'; last: T | null }
  | { status: 'loading'; last: T | null }
  | { status: 'ready'; data: T; last: T }
  | { status: 'error'; error: unknown; last: T | null };

type Settled<T> = { key: string; data: T } | { key: string; error: unknown };

/**
 * Recalcul « en direct » : `run(body)` est appelé après `delay` ms sans nouvelle saisie (la gateway limite
 * l'estimation et l'essai à 20 appels par minute). Un corps `null` (saisie incomplète) n'appelle rien. Une
 * réponse arrivée après une saisie plus récente est ignorée ; le dernier prix reste affiché pendant le calcul.
 */
export function useLivePrice<B, T>(run: (body: B) => Promise<T>, body: B | null, delay = 600): LivePrice<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [last, setLast] = useState<T | null>(null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const key = body === null ? null : JSON.stringify(body);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    const timer = setTimeout(() => {
      runRef.current(JSON.parse(key) as B).then(
        (data) => {
          if (!active) return;
          setSettled({ key, data });
          setLast(data);
        },
        (error: unknown) => {
          if (active) setSettled({ key, error });
        },
      );
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, delay]);

  if (key === null) return { status: 'idle', last };
  if (settled?.key !== key) return { status: 'loading', last };
  return 'data' in settled
    ? { status: 'ready', data: settled.data, last: settled.data }
    : { status: 'error', error: settled.error, last };
}
