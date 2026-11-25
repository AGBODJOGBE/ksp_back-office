'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Heading } from '@/components/ui/heading';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import { isClosed } from '@/features/cleaning/request-steps';
import { getRequest } from '@/features/cleaning/requests-api';
import type { CleaningRequest } from '@/features/cleaning/requests-schemas';
import { requestStatus } from '@/features/cleaning/requests-texts';
import { followTexts } from '@/features/cleaning/request-work-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { NextAction, RequestProgress } from './request-progress';
import { RequestQuote } from './request-quote';
import { RequestRetained } from './request-retained';
import { RequestSummary } from './request-summary';
import { RequestVisits } from './request-visits';
import { StatusBadge, type StepProps, StepSection } from './request-parts';
import { BackLink, LoadingBlock, Note, ResourceView, useCleaningAccess } from './parts';

const t = requestDetailTexts;

/** Étape 5 « Suite » : le programme de séances né de l'acceptation du devis. */
function RequestFollow({ request }: { request: CleaningRequest }) {
  return (
    <StepSection step="follow" title={followTexts.title}>
      {request.programId ? (
        <Link
          href={cleaningPaths.program(request.programId)}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {followTexts.program}
        </Link>
      ) : (
        <Note>{isClosed(request) ? followTexts.closed : followTexts.none}</Note>
      )}
    </StepSection>
  );
}

function Header({ request }: { request: CleaningRequest }) {
  return (
    <div className="grid gap-2">
      <Heading as="h1" size="h2">
        {t.title(request.number)}
      </Heading>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={requestStatus(request.status)} />
        <span className="text-small text-ink-muted">{t.created(formatDateTime(request.createdAt))}</span>
      </div>
      {request.warnings.map((warning) => (
        <p key={warning} className="text-small text-warning font-semibold">
          {t.warnings[warning] ?? warning}
        </p>
      ))}
    </div>
  );
}

/**
 * Fiche dossier (`/nettoyage/dossiers/[id]`) : frise des étapes, action suivante, puis une section par
 * étape (demande, visite, version retenue, devis, suite). Après une action, le dossier est remplacé par
 * la réponse ou relu sans repasser par le chargement.
 */
export function RequestDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.request.read'] ? (
        <RequestScreen id={id} access={access} />
      ) : (
        <Note>{cleaningTexts.common.forbidden}</Note>
      )}
    </div>
  );
}

function RequestScreen({ id, access }: { id: string; access: CleaningAccess }) {
  const resource = useResource(useCallback(() => getRequest(id), [id]));
  return (
    <ResourceView resource={resource} lines={10}>
      {(request) => {
        const props: StepProps = { request, onChange: resource.set, onRefresh: resource.refresh, access };
        const writes = access['cleaning.request.process'] || access['cleaning.quote.manage'];
        return (
          <div className="grid gap-6">
            <Header request={request} />
            <RequestProgress request={request} />
            <NextAction request={request} />
            {writes ? null : <Note>{t.readOnly}</Note>}
            <RequestSummary {...props} />
            <RequestVisits {...props} />
            <RequestRetained {...props} />
            <RequestQuote {...props} />
            <RequestFollow request={request} />
          </div>
        );
      }}
    </ResourceView>
  );
}
