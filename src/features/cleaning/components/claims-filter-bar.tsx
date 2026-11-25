'use client';

import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { activeAgents } from '@/features/cleaning/agents-api';
import type { ClaimFilterValues } from '@/features/cleaning/claims-filters';
import { CLAIM_SORTS, CLAIM_STATUSES } from '@/features/cleaning/claims-schemas';
import { claimSortName, claimStatus, claimsTexts } from '@/features/cleaning/claims-texts';
import { Choice } from './requests-filter-bar';

const t = claimsTexts.list;

/**
 * Agents de la liste déroulante ; vide si la lecture échoue (le support n'a pas la lecture des agents :
 * le filtre reste utilisable par l'adresse).
 */
async function loadAgents() {
  try {
    return (await activeAgents()).map((agent) => ({
      value: agent.id,
      label: `${agent.firstName} ${agent.lastName}`.trim(),
    }));
  } catch {
    return [];
  }
}

/** Filtres du contrat (`GET /claims`) : statut, agent de la séance, tri. */
export function ClaimsFilterBar({
  values,
  onChange,
}: {
  values: ClaimFilterValues;
  onChange: (changes: Partial<ClaimFilterValues>) => void;
}) {
  const agents = useResource(loadAgents);
  const options = agents.state.status === 'ready' ? agents.state.data : [];

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="sr-only">{t.filters}</legend>
      <Choice
        id="reclamations-statut"
        label={t.status}
        value={values.status}
        all={t.allFeminine}
        options={CLAIM_STATUSES.map((code) => ({ value: code, label: claimStatus(code).label }))}
        onChange={(status) => onChange({ status })}
      />
      <Choice
        id="reclamations-agent"
        label={t.agent}
        value={values.agentId}
        all={t.all}
        options={options}
        onChange={(agentId) => onChange({ agentId })}
      />
      <SelectField
        id="reclamations-tri"
        label={t.sort}
        value={values.sort || 'openedAt'}
        onChange={(event) => onChange({ sort: event.target.value === 'openedAt' ? '' : event.target.value })}
      >
        {CLAIM_SORTS.map((code) => (
          <option key={code} value={code}>
            {claimSortName(code)}
          </option>
        ))}
      </SelectField>
    </fieldset>
  );
}
