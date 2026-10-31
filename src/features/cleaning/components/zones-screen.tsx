'use client';

import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { deactivateZone, listZones, saveZone } from '@/features/cleaning/api';
import { attempt, errorText } from '@/features/cleaning/errors';
import type { Zone } from '@/features/cleaning/schemas';
import { cleaningTexts, nameOr } from '@/features/cleaning/texts';
import { zonesTexts as t } from '@/features/cleaning/zones-texts';
import { Note, Panel, ResourceView, useCleaningAccess } from './parts';

const common = cleaningTexts.common;

/** Remplace (ou ajoute) une zone dans la liste, triée par commune. */
const merge = (zones: Zone[], zone: Zone) =>
  [...zones.filter((item) => item.code !== zone.code), zone].sort((a, b) =>
    a.commune.localeCompare(b.commune),
  );

function ReactivateButton({ zone, onDone }: { zone: Zone; onDone: (zone: Zone) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="grid justify-items-start gap-2">
      <Button
        variant="secondary"
        aria-busy={pending || undefined}
        disabled={pending}
        aria-label={pending ? undefined : `${t.reactivate} ${zone.commune}`}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            onDone(await saveZone(zone.commune));
          } catch (caught) {
            setError(errorText(caught));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? common.sending : t.reactivate}
      </Button>
      <FormMessage>{error}</FormMessage>
    </span>
  );
}

function columns(onChange: (zone: Zone) => void): TableColumn<Zone>[] {
  return [
    { key: 'commune', header: t.columns.commune, primary: true, cell: (zone) => zone.commune },
    {
      key: 'state',
      header: t.columns.state,
      cell: (zone) => (
        <Badge tone={zone.active ? 'success' : 'neutral'}>{zone.active ? t.active : t.inactive}</Badge>
      ),
    },
    { key: 'code', header: t.columns.code, cell: (zone) => <code className="text-small">{zone.code}</code> },
    {
      key: 'updated',
      header: t.columns.updated,
      cell: (zone) =>
        zone.updatedAt
          ? t.updated(formatDateTime(zone.updatedAt), nameOr(zone.updatedByName, common.someone))
          : t.neverUpdated,
    },
    {
      key: 'action',
      header: common.actions,
      cell: (zone) =>
        zone.active ? (
          <ConfirmAction
            label={t.deactivate.label}
            accessibleLabel={`${t.deactivate.label} ${zone.commune}`}
            title={t.deactivate.title(zone.commune)}
            description={t.deactivate.text}
            confirmLabel={t.deactivate.confirm}
            labels={{ cancel: common.cancel, pending: common.sending }}
            danger
            onConfirm={() => attempt(async () => onChange(await deactivateZone(zone.code)))}
          />
        ) : (
          <ReactivateButton zone={zone} onDone={onChange} />
        ),
    },
  ];
}

function AddZone({ onAdded }: { onAdded: (zone: Zone) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const commune = String(new FormData(form).get('commune') ?? '').trim();
    if (!commune) return setError(common.required);
    setPending(true);
    setError(null);
    try {
      onAdded(await saveZone(commune));
      form.reset();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <form noValidate onSubmit={submit} className="grid max-w-md justify-items-start gap-3">
      <TextField
        id="zone-commune"
        name="commune"
        label={t.commune}
        hint={t.communeHint}
        maxLength={100}
        error={error}
        className="w-full"
        required
      />
      <Button type="submit" aria-busy={pending || undefined} disabled={pending}>
        {pending ? common.sending : t.addConfirm}
      </Button>
    </form>
  );
}

/** Zones desservies : liste, ouverture d'une commune, désactivation et réactivation (admin). */
export function ZonesScreen() {
  const access = useCleaningAccess();
  const zones = useResource(listZones);
  if (access && !access.administer) return <Note>{t.adminOnly}</Note>;
  return (
    <ResourceView resource={zones} lines={4}>
      {(data) => {
        const update = (zone: Zone) => zones.set(merge(data, zone));
        return (
          <div className="grid gap-6">
            <Panel title={t.add} id="zones-ajout">
              <AddZone onAdded={update} />
            </Panel>
            {data.length ? (
              <ResponsiveTable
                caption={t.caption}
                columns={columns(update)}
                rows={data}
                rowKey={(zone) => zone.code}
              />
            ) : (
              <Note>{t.empty}</Note>
            )}
          </div>
        );
      }}
    </ResourceView>
  );
}
