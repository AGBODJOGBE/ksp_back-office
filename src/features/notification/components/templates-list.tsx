'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { TextField } from '@/components/ui/field';
import { ResourceView } from '@/components/ui/resource-view';
import { apiErrorText } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { listTemplates } from '@/features/notification/api';
import type { MessageTemplate } from '@/features/notification/schemas';
import {
  channelName,
  notificationPaths,
  notificationTexts,
  templateKind,
} from '@/features/notification/texts';

const t = notificationTexts.templates;

function Variables({ label, names }: { label: string; names: readonly string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-small text-ink-muted">{label} :</span>
      {names.map((name) => (
        <code key={name} className="bg-surface-sunken text-ink rounded px-1.5 py-0.5 text-xs">
          {name}
        </code>
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: MessageTemplate }) {
  const kind = templateKind(template.kind);
  const headingId = `modele-${template.code.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <li
      aria-labelledby={headingId}
      className="rounded-card border-line bg-surface grid gap-3 border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-ink font-mono text-sm font-semibold break-all">
          {template.code}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{kind.label}</Badge>
          {template.secret ? <Badge tone="warning">{t.secret}</Badge> : null}
          <Badge tone={template.optional ? 'neutral' : 'action'}>
            {template.optional ? t.optional : t.mandatory}
          </Badge>
        </div>
      </div>
      <p className="text-small text-ink-muted">
        {t.channels} : {template.channels.map(channelName).join(', ')}
        {kind.hint ? ` — ${kind.hint}` : ''}
        {template.secret ? ` ${t.secretHint}` : ''}
      </p>
      {template.text ? (
        <div className="rounded-control bg-surface-muted border-line grid gap-2 border p-3">
          {template.subject ? (
            <p className="text-ink text-sm">
              <span className="text-ink-muted">{t.subject} : </span>
              <span className="font-semibold">{template.subject}</span>
            </p>
          ) : null}
          <p className="text-ink text-sm whitespace-pre-line">{template.text}</p>
        </div>
      ) : (
        <p className="text-small text-ink-muted italic">{t.providerText}</p>
      )}
      <Variables label={t.variables} names={template.variables} />
      <Variables label={t.optionalVariables} names={template.optionalVariables} />
      <Link
        href={`${notificationPaths.deliveries}?modele=${encodeURIComponent(template.code)}`}
        className="text-accent-ink text-small justify-self-start font-semibold underline"
      >
        {t.seeDeliveries}
      </Link>
    </li>
  );
}

function Templates({ templates }: { templates: readonly MessageTemplate[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? templates.filter(
        (template) =>
          template.code.toLowerCase().includes(needle) ||
          (template.subject ?? '').toLowerCase().includes(needle) ||
          (template.text ?? '').toLowerCase().includes(needle),
      )
    : templates;
  return (
    <div className="grid gap-4">
      <TextField
        id="recherche-modele"
        type="search"
        label={t.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-md"
      />
      <p className="text-small text-ink-muted" role="status">
        {shown.length ? t.count(shown.length) : t.none}
      </p>
      <ul className="grid gap-3">
        {shown.map((template) => (
          <TemplateCard key={template.code} template={template} />
        ))}
      </ul>
    </div>
  );
}

/** Modèles de messages et leur texte, en lecture seule (ADR-039). */
export function TemplatesList() {
  const templates = useResource(useCallback(() => listTemplates(), []));
  return (
    <ResourceView resource={templates} lines={6} labels={notificationTexts} describe={apiErrorText}>
      {(data) => <Templates templates={data} />}
    </ResourceView>
  );
}
