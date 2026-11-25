'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { formatXof } from '@/lib/format';
import { xof } from '@/features/cleaning/api';
import { approveClaimCredit, decideClaim, updateClaim } from '@/features/cleaning/claims-api';
import { type Claim, CLAIM_OUTCOMES, type ClaimOutcome } from '@/features/cleaning/claims-schemas';
import {
  claimActionTexts,
  claimOutcome,
  CREDIT_APPROVAL_THRESHOLD,
  MAX_CREDIT,
} from '@/features/cleaning/claims-texts';
import { attempt } from '@/features/cleaning/errors';
import { parseInteger } from '@/features/cleaning/inputs';
import { ActionButton, Note } from './parts';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';

const t = claimActionTexts;

/** Ce que reçoivent les gestes : la réclamation, sa mise à jour, le compte connecté. */
export interface ClaimActionProps {
  claim: Claim;
  onChange: (claim: Claim, message: string) => void;
  userId: string | null;
}

export const isClosedClaim = (claim: Claim) => claim.status === 'resolved' || claim.status === 'rejected';

/** Montant d'un crédit saisi : entier de 0 à 100 000 000 FCFA (contrat), sinon un message. */
function creditOf(raw: string): { amount: number } | { error: string } {
  if (!raw.trim()) return { error: t.decide.amountRequired };
  const amount = parseInteger(raw);
  if (amount === null || amount > MAX_CREDIT) return { error: t.decide.amountInvalid(formatXof(MAX_CREDIT)) };
  return { amount };
}

/** Décision confirmée avec motif : repasse gratuite, crédit (montant) ou rejet (R-RC-03, R-RC-04). */
function Decide({ claim, onChange }: ClaimActionProps) {
  const keyed = useKeyed();
  const d = t.decide;
  return (
    <ConfirmAction
      label={d.open}
      title={d.title}
      description={d.text}
      confirmLabel={d.confirm}
      labels={confirmLabels}
      variant="action"
      onConfirm={async (data) => {
        const outcome = String(data.get('outcome') ?? '') as ClaimOutcome;
        if (!CLAIM_OUTCOMES.includes(outcome)) return d.outcomeRequired;
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        let creditAmount: ReturnType<typeof xof> | undefined;
        if (outcome === 'wallet_credit') {
          const credit = creditOf(String(data.get('amount') ?? ''));
          if ('error' in credit) return credit.error;
          creditAmount = xof(credit.amount);
        }
        return attempt(async () => {
          const next = await keyed((key) =>
            decideClaim(claim.id, { outcome, reason, ...(creditAmount ? { creditAmount } : {}) }, key),
          );
          onChange(next, next.decision?.approvalStatus === 'pending' ? d.donePending : d.done);
        });
      }}
    >
      <SelectField id={`reclamation-${claim.id}-decision`} name="outcome" label={d.outcome} defaultValue="">
        <option value="" disabled>
          {d.choose}
        </option>
        {CLAIM_OUTCOMES.map((code) => (
          <option key={code} value={code}>
            {claimOutcome(code)}
          </option>
        ))}
      </SelectField>
      <TextField
        id={`reclamation-${claim.id}-montant`}
        name="amount"
        label={d.amount}
        hint={d.amountHint(formatXof(CREDIT_APPROVAL_THRESHOLD))}
        inputMode="numeric"
        autoComplete="off"
      />
      <ReasonField id={`reclamation-${claim.id}-motif`} label={d.reason} />
    </ConfirmAction>
  );
}

/** Validation d'un crédit en attente par une deuxième personne (séparation des droits, R-RC-03). */
function Approve({ claim, onChange, userId }: ClaimActionProps) {
  const keyed = useKeyed();
  const a = t.approve;
  if (claim.decision?.decidedBy === userId) return <FormMessage tone="info">{a.mine}</FormMessage>;
  return (
    <ConfirmAction
      label={a.open}
      title={a.title}
      description={a.text}
      confirmLabel={a.confirm}
      labels={confirmLabels}
      variant="action"
      onConfirm={() =>
        attempt(async () => onChange(await keyed((key) => approveClaimCredit(claim.id, key)), a.done))
      }
    />
  );
}

/**
 * Gestes sur une réclamation : prendre en charge (nouvelle), décider (en cours, sans décision), valider
 * le crédit (deuxième personne). La réponse au client se fait dans les échanges. La gateway reste
 * seule juge (droits, double authentification de moins de 10 minutes pour décider et valider).
 */
export function ClaimActions(props: ClaimActionProps & { canManage: boolean }) {
  const { claim, onChange, canManage } = props;
  const take = useKeyed();
  if (!canManage) return <Note>{t.readOnly}</Note>;
  if (isClosedClaim(claim)) return <Note>{t.closed}</Note>;
  const pending = claim.decision?.approvalStatus === 'pending';
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start gap-3">
        {claim.status === 'open' ? (
          <ActionButton
            label={t.take.open}
            variant="action"
            onClick={async () =>
              onChange(
                await take((key) => updateClaim(claim.id, { status: 'in_progress' }, key)),
                t.take.done,
              )
            }
          />
        ) : null}
        {!claim.decision ? <Decide {...props} /> : null}
        {pending ? <Approve {...props} /> : null}
      </div>
      {!claim.decision || pending ? <Note>{t.mfaHint}</Note> : null}
    </div>
  );
}
