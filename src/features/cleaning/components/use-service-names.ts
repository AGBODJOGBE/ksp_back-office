'use client';

import { useEffect, useState } from 'react';
import { getServiceNames } from '@/features/cleaning/api';

/** Nom d'une prestation à partir de son code ; le code tant que les noms ne sont pas lus (ou si la lecture échoue). */
export function useServiceName(): (code: string) => string {
  const [names, setNames] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    getServiceNames().then(
      (map) => {
        if (active) setNames(map);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);
  return (code) => names?.get(code) ?? code;
}
