'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { getClaim } from '@/features/cleaning/claims-api';
import type { Claim } from '@/features/cleaning/claims-schemas';
import {
  claimActionTexts,
  claimCategory,
  claimCustomer,
  claimOutcome,
  claimStatus,
  claimsTexts,
  FIRST_RESPONSE_HOURS,
} from '@/features/cleaning/claims-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { ClaimActions } from './claim-actions';
import { ClaimMessages } from './claim-messages';
import { LateBadge } from './claims-queue';
import { Amount, BackLink, LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { PhotoLinks } from './request-parts';

const t = claimsTexts.detail;
const d = claimActionTexts.decision;
const linkClass = 'text-accent-ink inline-flex min-h-11 items-center font-semibold underline';

function Header({ claim }: { claim: Claim }) {
  const status = claimStatus(claim.status);
  const [now] = useState(() => Date.now());
  return (
    <div className="grid gap-2">
      <Heading as="h1" size="h2">
        {t.heading(claimCategory(claim.category))}
      </Heading>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <LateBadge claim={claim} now={now} />
        <span className="text-small text-ink-muted">
          {t.opened} {formatDateTime(claim.openedAt)}
        </span>
      </div>
    </div>
  );
}

/** Résumé : client, motif, séance et programme liés (liens existants), délais. */
function Summary({ claim }: { claim: Claim }) {
  const name = claimCustomer(claim);
  return (
    <DescriptionList
      items={[
        { term: t.customer, value: name ?? <span className="text-ink-muted">{t.noName}</span> },
        { term: t.category, value: claimCategory(claim.category) },
        {
          term: t.session,
          value: (
            <Link href={cleaningPaths.session(claim.programId, claim.sessionId)} className={linkClass}>
              {t.openSession}
            </Link>
          ),
        },
        {
          term: t.program,
          value: (
            <Link href={cleaningPaths.program(claim.programId)} className={linkClass}>
              {t.openProgram}
            </Link>
          ),
        },
        {
          term: t.firstResponse,
          value: claim.firstResponseAt
            ? formatDateTime(claim.firstResponseAt)
            : t.firstResponseNone(FIRST_RESPONSE_HOURS),
        },
        { term: t.closed, value: claim.closedAt ? formatDateTime(claim.closedAt) : null },
      ]}
    />
  );
}

/** Décision prise : issue, motif, auteur, crédit (masqué sans `cleaning.amounts.read`), repasse. */
function Decision({ claim }: { claim: Claim }) {
  const decision = claim.decision;
  if (!decision) return null;
  return (
    <Panel title={d.title} id="reclamation-decision">
      <DescriptionList
        items={[
          { term: d.outcome, value: claimOutcome(decision.outcome) },
          { term: d.reason, value: <span className="whitespace-pre-line">{decision.reason}</span> },
          {
            term: d.decided,
            value: d.decidedBy(
              formatDateTime(decision.decidedAt),
              decision.decidedByName?.trim() || d.someone,
            ),
          },
          decision.outcome === 'wallet_credit'
            ? { term: d.credit, value: <Amount value={decision.creditAmount} /> }
            : null,
          decision.outcome === 'wallet_credit'
            ? { term: d.approval, value: d.approvals[decision.approvalStatus] ?? decision.approvalStatus }
            : null,
          decision.redoSessionId
            ? {
                term: d.redo,
                value: (
                  <Link
                    href={cleaningPaths.session(claim.programId, decision.redoSessionId)}
                    className={linkClass}
                  >
                    {d.openRedo}
                  </Link>
                ),
              }
            : null,
        ].filter((item) => item !== null)}
      />
    </Panel>
  );
}

function ClaimView({
  claim,
  onChange,
  access,
  userId,
}: {
  claim: Claim;
  onChange: (claim: Claim) => void;
  access: CleaningAccess;
  userId: string | null;
}) {
  const [notice, setNotice] = useState<ReactNode>(null);
  const canManage = access['cleaning.claim.manage'];
  const change = (next: Claim, message: string) => {
    onChange(next);
    setNotice(message);
  };
  return (
    <div className="grid gap-4">
      <Header claim={claim} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={t.summary} id="reclamation-resume">
          <Summary claim={claim} />
        </Panel>
        <Panel title={claimActionTexts.title} id="reclamation-gestes">
          <ClaimActions claim={claim} onChange={change} userId={userId} canManage={canManage} />
        </Panel>
      </div>
      <FormMessage tone="success">{notice}</FormMessage>
      <Decision claim={claim} />
      <Panel title={t.text} id="reclamation-recit">
        <div className="grid gap-3">
          <p className="max-w-reading break-words whitespace-pre-line">{claim.text}</p>
          {claim.photos.length ? <PhotoLinks photos={claim.photos} label={t.photo} /> : null}
        </div>
      </Panel>
      <Panel title={claimActionTexts.messages.title} id="reclamation-echanges">
        <ClaimMessages claim={claim} onChange={change} canManage={canManage} />
      </Panel>
    </div>
  );
}

/** Fiche d'une réclamation (`/nettoyage/reclamations/[id]`), lue par le navigateur une fois la session reprise. */
export function ClaimDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const userId = useSession()?.user.id ?? null;
  const claim = useResource(useCallback(() => getClaim(id), [id]));
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.claims}>{t.back}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.claim.manage'] ? (
        <ResourceView resource={claim} lines={10}>
          {(data) => <ClaimView claim={data} onChange={claim.set} access={access} userId={userId} />}
        </ResourceView>
      ) : (
        <Note>{cleaningTexts.common.forbidden}</Note>
      )}
    </div>
  );
}
