'use client';

import { useCallback, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { getOverview } from '@/features/recovery/api';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import type { Debtor } from '@/features/recovery/case-schemas';
import { actorName, recoveryTexts } from '@/features/recovery/texts';
import type { useIdempotencyKey } from './parts';

const c = recoveryTexts.common;
const a = caseActionTexts.assign;

/** Libellés des boîtes de confirmation. */
export const confirmLabels = { cancel: c.cancel, pending: c.sending };

/** Après l'action : message de réussite, puis relecture de la fiche et du journal. */
export type OnDone = (message: string) => void;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/** Texte saisi (sans espaces autour). */
export const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** Montant entier en F CFA, strictement positif ; `null` sinon. */
export function positiveAmount(data: FormData, name: string): number | null {
  const text = field(data, name).replace(/[\s  ]/g, '');
  if (!/^\d{1,13}$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

/** Appel avec clé d'idempotence : clé gardée tant que l'issue est inconnue (coupure, erreur du serveur). */
export async function idempotent<T>(
  key: ReturnType<typeof useIdempotencyKey>,
  call: (key: string) => Promise<T>,
): Promise<T> {
  try {
    const result = await call(key.key());
    key.settle();
    return result;
  } catch (error) {
    key.settle(error);
    throw error;
  }
}

/**
 * Choix d'un chargé : chargés du tableau de bord (`GET /recovery/overview`, seule liste du contrat),
 * ou identifiant saisi pour un chargé qui n'y figure pas encore (« à valider » : pas de route de liste
 * des chargés). Lu à l'ouverture de la boîte seulement. Le formulaire lit `agentUserId` ou `agentIdManual`.
 */
export function AgentField({ id, optional = false }: { id: string; optional?: boolean }) {
  const load = useCallback(() => getOverview(), []);
  const overview = useResource(load);
  const [choice, setChoice] = useState('');
  const agents = overview.state.status === 'ready' ? overview.state.data.agents : [];
  const listed = agents.filter((row) => row.agent.userId);
  return (
    <div className="grid gap-4">
      {listed.length ? (
        <SelectField
          id={`${id}-liste`}
          name="agentUserId"
          label={optional ? a.optional : a.agent}
          hint={a.agentHint}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">{optional ? a.noAgent : a.choose}</option>
          {listed.map((row) => (
            <option key={row.agent.userId} value={row.agent.userId ?? ''}>
              {actorName(row.agent)}
            </option>
          ))}
        </SelectField>
      ) : null}
      {choice ? null : (
        <TextField
          id={`${id}-identifiant`}
          name="agentIdManual"
          label={a.agentId}
          hint={a.agentIdHint}
          maxLength={36}
        />
      )}
    </div>
  );
}

/** Chargé choisi dans `AgentField` : `undefined` si rien n'est saisi, `null` si la saisie est invalide. */
export function chosenAgent(data: FormData): string | null | undefined {
  const value = field(data, 'agentUserId') || field(data, 'agentIdManual');
  if (!value) return undefined;
  return isUuid(value) ? value : null;
}

/** Choix du débiteur concerné (débiteur principal en premier). */
export function DebtorSelect({
  id,
  debtors,
  label,
}: {
  id: string;
  debtors: readonly Debtor[];
  label: string;
}) {
  const sorted = [...debtors].sort((x, y) => Number(y.role === 'main') - Number(x.role === 'main'));
  return (
    <SelectField id={id} name="debtorId" label={label} defaultValue={sorted[0]?.id}>
      {sorted.map((debtor) => (
        <option key={debtor.id} value={debtor.id}>
          {debtor.displayName}
        </option>
      ))}
    </SelectField>
  );
}
