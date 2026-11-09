'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import {
  CHANNELS,
  DELIVERY_STATUSES,
  type DeliveryFilters,
  listDeliveries,
  listTemplates,
} from '@/features/notification/api';
import type { Delivery } from '@/features/notification/schemas';
import {
  channelName,
  deliveryStatus,
  notificationPaths,
  notificationTexts,
} from '@/features/notification/texts';

const t = notificationTexts.deliveries;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Paramètres de l'adresse (en français) → filtres de la gateway. */
const PARAMS = {
  templateCode: 'modele',
  channel: 'canal',
  status: 'etat',
  from: 'du',
  to: 'au',
  recipientUserId: 'destinataire',
} as const;
type FilterKey = keyof typeof PARAMS;

const columns: TableColumn<Delivery>[] = [
  {
    key: 'template',
    header: t.columns.template,
    primary: true,
    cell: (delivery) => (
      <Link
        href={notificationPaths.delivery(delivery.id)}
        className="stretched-link font-mono text-sm hover:underline"
      >
        {delivery.templateCode}
      </Link>
    ),
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (delivery) => {
      const status = deliveryStatus(delivery.status);
      return (
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      );
    },
  },
  {
    key: 'channels',
    header: t.columns.channels,
    cell: (delivery) =>
      delivery.channelUsed ? (
        channelName(delivery.channelUsed)
      ) : (
        <span className="text-small text-ink-muted">
          {t.tried(
            delivery.channelsTried.map(channelName).join(', ') || channelName(delivery.requestedChannel),
          )}
        </span>
      ),
  },
  {
    key: 'target',
    header: t.columns.target,
    cell: (delivery) =>
      delivery.erased ? (
        <Badge tone="neutral">{t.erased}</Badge>
      ) : (
        <span className="tabular-nums">{delivery.targetMasked ?? t.noTarget}</span>
      ),
  },
  { key: 'created', header: t.columns.created, cell: (delivery) => formatDateTime(delivery.createdAt) },
];

function Deliveries({ filters, filtered }: { filters: DeliveryFilters; filtered: boolean }) {
  const { templateCode, channel, status, from, to, recipientUserId } = filters;
  const load = useCallback(
    (cursor?: string) => listDeliveries({ templateCode, channel, status, from, to, recipientUserId }, cursor),
    [templateCode, channel, status, from, to, recipientUserId],
  );
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      labels={notificationTexts}
      empty={<p className="text-small text-ink-muted">{filtered ? t.emptyFiltered : t.empty}</p>}
    >
      <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(row) => row.id} />
    </PagedListState>
  );
}

/** Codes des modèles pour le filtre ; une panne laisse la liste vide (le filtre reste utilisable). */
function useTemplateCodes(): string[] {
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    listTemplates().then(
      (templates) => {
        if (active) setCodes(templates.map((template) => template.code));
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);
  return codes;
}

/**
 * Historique des envois, filtré dans l'adresse : `?modele=`, `?canal=`, `?etat=`, `?du=`, `?au=`,
 * `?destinataire=` (identifiant de compte). Aucune donnée personnelle en clair : destinataire masqué.
 */
export function DeliveriesList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const codes = useTemplateCodes();
  const read = (key: FilterKey) => params.get(PARAMS[key]) || undefined;
  const filters: DeliveryFilters = {
    templateCode: read('templateCode'),
    channel: read('channel'),
    status: read('status'),
    from: DATE.test(read('from') ?? '') ? read('from') : undefined,
    to: DATE.test(read('to') ?? '') ? read('to') : undefined,
    recipientUserId: UUID.test(read('recipientUserId') ?? '') ? read('recipientUserId') : undefined,
  };
  const [recipient, setRecipient] = useState(filters.recipientUserId ?? '');
  const [recipientError, setRecipientError] = useState<string | null>(null);

  function update(changes: Partial<Record<FilterKey, string>>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes) as Array<[FilterKey, string]>) {
      if (value) next.set(PARAMS[key], value);
      else next.delete(PARAMS[key]);
    }
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function searchRecipient(event: FormEvent) {
    event.preventDefault();
    const value = recipient.trim();
    if (value && !UUID.test(value)) {
      setRecipientError(t.recipientInvalid);
      return;
    }
    setRecipientError(null);
    update({ recipientUserId: value.toLowerCase() });
  }

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="filtre-modele"
          label={t.template}
          value={filters.templateCode ?? ''}
          onChange={(event) => update({ templateCode: event.target.value })}
        >
          <option value="">{notificationTexts.all}</option>
          {filters.templateCode && !codes.includes(filters.templateCode) ? (
            <option value={filters.templateCode}>{filters.templateCode}</option>
          ) : null}
          {codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-canal"
          label={t.channel}
          value={filters.channel ?? ''}
          onChange={(event) => update({ channel: event.target.value })}
        >
          <option value="">{notificationTexts.all}</option>
          {CHANNELS.map((code) => (
            <option key={code} value={code}>
              {channelName(code)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-etat"
          label={t.status}
          value={filters.status ?? ''}
          onChange={(event) => update({ status: event.target.value })}
        >
          <option value="">{notificationTexts.all}</option>
          {DELIVERY_STATUSES.map((code) => (
            <option key={code} value={code}>
              {deliveryStatus(code).label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="filtre-du"
          type="date"
          label={t.from}
          value={filters.from ?? ''}
          max={filters.to}
          onChange={(event) => update({ from: event.target.value })}
        />
        <TextField
          id="filtre-au"
          type="date"
          label={t.to}
          value={filters.to ?? ''}
          min={filters.from}
          onChange={(event) => update({ to: event.target.value })}
        />
        <form onSubmit={searchRecipient} className="flex items-end gap-2">
          <TextField
            id="filtre-destinataire"
            label={t.recipient}
            hint={t.recipientHint}
            error={recipientError}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="min-w-0 flex-1"
            inputClassName="font-mono text-sm"
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" variant="secondary">
            {t.apply}
          </Button>
        </form>
      </div>
      {filtered ? (
        <Button
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            setRecipient('');
            replace(pathname, { scroll: false });
          }}
        >
          {t.reset}
        </Button>
      ) : null}
      <Deliveries key={JSON.stringify(filters)} filters={filters} filtered={filtered} />
    </div>
  );
}
