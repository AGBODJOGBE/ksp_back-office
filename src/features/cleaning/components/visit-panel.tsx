'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { getRequest } from '@/features/cleaning/requests-api';
import type { CleaningRequest, Visit } from '@/features/cleaning/requests-schemas';
import { visitsTexts } from '@/features/cleaning/visits-texts';
import { VisitCard } from './request-visit-card';
import { Note, ResourceView } from './parts';

const t = visitsTexts.panel;

function PanelBody({
  request,
  visitId,
  access,
  onChange,
  onRefresh,
}: {
  request: CleaningRequest;
  visitId: string;
  access: CleaningAccess;
  onChange: (request: CleaningRequest) => void;
  onRefresh: () => void;
}) {
  const visit = request.visits.find((item) => item.id === visitId);
  return (
    <div className="grid gap-3">
      <p className="text-ink">{t.place(request.place.name, request.place.communeName)}</p>
      <Link
        href={cleaningPaths.request(request.id)}
        className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
      >
        {t.open}
      </Link>
      {visit ? (
        <VisitCard
          request={request}
          visit={visit}
          access={access}
          onChange={onChange}
          onRefresh={onRefresh}
        />
      ) : (
        <Note>{t.gone}</Note>
      )}
    </div>
  );
}

/**
 * Visite choisie dans le calendrier : le dossier est relu pour reprendre la carte de visite de la fiche
 * (déplacer, changer d'agent, annuler, clôturer, client absent) avec ses formulaires et confirmations.
 * Après une action, le dossier et le calendrier sont relus.
 */
export function VisitPanel({
  visit,
  access,
  onChanged,
  onClose,
}: {
  visit: Visit;
  access: CleaningAccess;
  onChanged: () => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useResource(useCallback(() => getRequest(visit.requestId), [visit.requestId]));
  const titleId = `visite-${visit.id}-titre`;

  useEffect(() => {
    heading.current?.focus();
  }, [visit.id]);

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border-line bg-surface-muted grid gap-3 border p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="text-ink text-h3 font-semibold">
          {t.title(visit.requestNumber)}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {t.close}
        </Button>
      </div>
      <ResourceView resource={request} lines={4}>
        {(data) => (
          <PanelBody
            request={data}
            visitId={visit.id}
            access={access}
            onChange={(next) => {
              request.set(next);
              onChanged();
            }}
            onRefresh={() => {
              request.refresh();
              onChanged();
            }}
          />
        )}
      </ResourceView>
    </section>
  );
}
