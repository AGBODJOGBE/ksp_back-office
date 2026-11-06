'use client';

import { useEffect, useState } from 'react';
import { getServiceForms, getServiceNames } from '@/features/cleaning/api';
import type { ServiceForm } from '@/features/cleaning/schemas';

/**
 * Lecture unique d'une table de la route publique des prestations ; `null` tant qu'elle n'est pas lue, table
 * vide en cas d'échec (l'écran retombe sur les codes).
 */
function useLookup<T>(load: () => Promise<Map<string, T>>): Map<string, T> | null {
  const [map, setMap] = useState<Map<string, T> | null>(null);
  useEffect(() => {
    let active = true;
    load().then(
      (value) => {
        if (active) setMap(value);
      },
      () => {
        if (active) setMap(new Map());
      },
    );
    return () => {
      active = false;
    };
  }, [load]);
  return map;
}

/** Nom d'une prestation à partir de son code ; le code tant que les noms ne sont pas lus (ou si la lecture échoue). */
export function useServiceName(): (code: string) => string {
  const names = useLookup(getServiceNames);
  return (code) => names?.get(code) ?? code;
}

/**
 * Formulaire public d'une prestation : `undefined` tant qu'il n'est pas lu, `null` s'il est indisponible
 * (prestation désactivée, lecture en échec).
 */
export function useServiceForm(code: string): ServiceForm | null | undefined {
  const forms = useLookup(getServiceForms);
  return forms ? (forms.get(code) ?? null) : undefined;
}
