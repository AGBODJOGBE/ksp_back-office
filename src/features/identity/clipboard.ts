import { useCallback, useEffect, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/** Copie dans le presse-papiers, avec un état affichable qui revient à `idle` après quelques secondes. */
export function useCopy(resetAfterMs = 4000) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), resetAfterMs);
    return () => clearTimeout(timer);
  }, [state, resetAfterMs]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }, []);

  return { state, copy };
}
