'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconArrowRight, IconCheck } from '@/components/ui/icons';
import { LoadingBlock } from '@/components/ui/loading-block';
import { apiErrorText, useSession } from '@/lib/api';
import { formatLongDate } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  countLabel,
  sectionsFor,
  type WorkQueuePage,
  type WorkQueueRow,
  type WorkQueueSection,
} from '@/lib/work-queue';
import { billingQueueSections } from '@/features/billing/queue';
import { cleaningQueueSections } from '@/features/cleaning/queue';
import { organizationQueueSections } from '@/features/identity/queue';
import { paymentQueueSections } from '@/features/payment/queue';
import { dashboardTexts as t } from '@/features/dashboard/texts';

/**
 * Ordre de priorité de la file, validé le 5 novembre 2026 : écarts de paiement, incidents, comptes rendus
 * à saisir, demandes à visiter, comptes entreprise à valider, factures impayées.
 */
export const QUEUE_ORDER = [
  'payment-mismatches',
  'cleaning-incidents',
  'cleaning-visit-reports',
  'cleaning-requests-to-visit',
  'organizations-to-validate',
  'invoices-overdue',
] as const;

/** Sections fournies par les fonctionnalités (chacune lit sa route de la gateway). */
export const QUEUE_SECTIONS: readonly WorkQueueSection[] = [
  ...paymentQueueSections,
  ...cleaningQueueSections,
  ...organizationQueueSections,
  ...billingQueueSections,
];

type SectionStatus = 'loading' | 'error' | 'empty' | 'filled';

function RowAction({ row, onDone }: { row: WorkQueueRow; onDone: () => void }) {
  const { action } = row;
  if (action.kind === 'inline') return <>{action.render(onDone)}</>;
  return (
    <ButtonLink
      href={action.href}
      variant="secondary"
      aria-label={t.actionFor(action.label, row.title)}
      className="w-full sm:w-auto"
    >
      {action.label}
    </ButtonLink>
  );
}

function SectionFrame({
  id,
  title,
  page,
  busy,
  children,
}: {
  id: string;
  title: string;
  page?: WorkQueuePage;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      aria-busy={busy || undefined}
      className="rounded-card border-line bg-surface grid gap-4 border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Heading as="h3" size="h3" id={id}>
          {title}
        </Heading>
        {page ? (
          <Badge tone="brand">
            <span aria-hidden="true">{countLabel(page)}</span>
            <span className="sr-only">
              {page.more ? t.countMore(page.count) : t.count(String(page.count))}
            </span>
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Une section de la file : lecture de sa route, états chargement, erreur, vide (repliée), contenu. */
function QueueSectionView({
  section,
  roles,
  onStatus,
}: {
  section: WorkQueueSection;
  roles: readonly string[];
  onStatus: (id: string, status: SectionStatus) => void;
}) {
  const headingId = useId();
  const load = useCallback(() => section.load(roles), [section, roles]);
  const resource = useResource(load);
  const { state } = resource;
  const status: SectionStatus =
    state.status === 'ready' ? (state.data.count ? 'filled' : 'empty') : state.status;

  useEffect(() => onStatus(section.id, status), [onStatus, section.id, status]);

  if (state.status === 'loading') {
    return (
      <SectionFrame id={headingId} title={section.title} busy>
        <LoadingBlock lines={2} label={t.sectionLoading(section.title)} />
      </SectionFrame>
    );
  }

  if (state.status === 'error') {
    return (
      <SectionFrame id={headingId} title={section.title}>
        <div className="grid justify-items-start gap-3">
          <FormMessage>{apiErrorText(state.error)}</FormMessage>
          <Button variant="secondary" onClick={resource.reload}>
            {t.retry}
          </Button>
        </div>
      </SectionFrame>
    );
  }

  const page = state.data;
  if (!page.count) {
    // Section repliée : une ligne, sans liste.
    return (
      <section
        aria-labelledby={headingId}
        className="rounded-card border-line bg-surface-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border px-4 py-3"
      >
        <h3 id={headingId} className="text-ink font-semibold">
          {section.title}
        </h3>
        <p className="text-small text-ink-muted ml-auto flex items-center gap-1.5">
          <IconCheck className="text-success size-4" />
          {t.nothing}
        </p>
      </section>
    );
  }

  return (
    <SectionFrame id={headingId} title={section.title} page={page}>
      <p className="text-small text-ink-muted -mt-2">{section.description}</p>
      <ul className="grid">
        {page.rows.map((row) => (
          <li
            key={row.id}
            className="border-line flex flex-col gap-3 border-t py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-ink font-semibold break-words">{row.title}</p>
              {row.details.length ? (
                <p className="text-small text-ink-muted break-words">{row.details.join(' · ')}</p>
              ) : null}
            </div>
            <div className="shrink-0">
              <RowAction row={row} onDone={resource.refresh} />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {page.count > page.rows.length ? (
          <p className="text-small text-ink-muted">{t.moreRows(page.rows.length)}</p>
        ) : (
          <span />
        )}
        <Link
          href={section.seeAll.href}
          className="text-accent-ink inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
        >
          {section.seeAll.label}
          <IconArrowRight className="size-4" />
        </Link>
      </div>
    </SectionFrame>
  );
}

/**
 * File « À traiter » : les sections ouvertes aux rôles de la session (affichage seulement : la gateway
 * reste seule juge), dans l'ordre de priorité, lues en parallèle. « Tout est à jour » quand toutes sont
 * vides ; une erreur reste limitée à sa section.
 */
export function DayQueue({
  sections = QUEUE_SECTIONS,
  order = QUEUE_ORDER,
}: {
  sections?: readonly WorkQueueSection[];
  order?: readonly string[];
}) {
  const current = useSession();
  const rolesKey = current?.roles.join(' ') ?? '';
  // Rôles stables tant que la session ne change pas : chaque section ne relit qu'à un vrai changement.
  const roles = useMemo(() => (rolesKey ? rolesKey.split(' ') : []), [rolesKey]);
  const visible = useMemo(() => sectionsFor(roles, sections, order), [roles, sections, order]);
  const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({});
  const onStatus = useCallback(
    (id: string, status: SectionStatus) =>
      setStatuses((previous) => (previous[id] === status ? previous : { ...previous, [id]: status })),
    [],
  );
  const [today] = useState(() => formatLongDate(new Date()));

  if (!current) return null;

  const allClear = visible.length > 0 && visible.every((section) => statuses[section.id] === 'empty');

  return (
    <section aria-labelledby="file-a-traiter" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading as="h2" size="h3" id="file-a-traiter">
          {t.queueTitle}
        </Heading>
        <p className="text-small text-ink-muted">{t.today(today)}</p>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border p-6">{t.noQueue}</p>
      ) : (
        <>
          <FormMessage tone="success">{allClear ? t.allClear : null}</FormMessage>
          <div className="grid gap-3">
            {visible.map((section) => (
              <QueueSectionView key={section.id} section={section} roles={roles} onStatus={onStatus} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
