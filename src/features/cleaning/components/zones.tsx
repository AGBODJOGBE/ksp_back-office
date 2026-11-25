'use client';

import { type FormEvent, useCallback, useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import {
  createZone,
  listCommunes,
  listZones,
  setZoneActive,
  updateZone,
  type ZoneBody,
  xof,
} from '@/features/cleaning/api';
import { errorText, loadErrorText } from '@/features/cleaning/errors';
import {
  coefficientInput,
  formatCoefficient,
  parseCoefficient,
  parseInteger,
} from '@/features/cleaning/inputs';
import { PLANNING_MODES, type PlanningMode, type Zone } from '@/features/cleaning/schemas';
import { settingsTexts } from '@/features/cleaning/settings-texts';
import { cleaningTexts, planningMode } from '@/features/cleaning/texts';
import {
  ActionButton,
  ActiveBadge,
  Amount,
  type FieldErrors,
  FormFooter,
  ListState,
  Note,
  Panel,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
} from './parts';

const t = settingsTexts.zones;
const c = cleaningTexts.common;

interface ZoneDraft {
  name: string;
  coefficient: string;
  surcharge: string;
  planningMode: string;
}

/** Saisie d'une zone → corps du contrat ; `null` et messages si un champ est invalide. */
function zoneBody(draft: ZoneDraft, current?: Zone): { body: ZoneBody; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const body: ZoneBody = {};
  const name = draft.name.trim();
  if (name.length > 100) errors.name = c.tooLong(100);
  else if (name && name !== current?.name) body.name = name;
  else if (!name && current) errors.name = c.required;
  if (draft.coefficient.trim()) {
    const bps = parseCoefficient(draft.coefficient);
    if (bps === null || bps < 1 || bps > 100_000) errors.coefficientBps = c.invalidCoefficient;
    else if (bps !== current?.coefficientBps) body.coefficientBps = bps;
  }
  if (draft.surcharge.trim()) {
    const amount = parseInteger(draft.surcharge);
    if (amount === null || amount > 100_000_000) errors.visitFeeSurcharge = c.invalidAmount;
    else if (amount !== current?.visitFeeSurcharge?.amount) body.visitFeeSurcharge = xof(amount);
  } else if (current?.visitFeeSurcharge) errors.visitFeeSurcharge = t.surchargeLocked;
  if (draft.planningMode && draft.planningMode !== current?.planningMode) {
    body.planningMode = draft.planningMode as PlanningMode;
  }
  return { body, errors };
}

function PlanningSelect({
  id,
  value,
  onChange,
  defaultValue,
}: {
  id: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <SelectField
      id={id}
      name="planningMode"
      label={t.planningMode}
      hint={t.planningModeHint}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      <option value="">{t.general}</option>
      {PLANNING_MODES.map((mode) => (
        <option key={mode} value={mode}>
          {planningMode(mode)}
        </option>
      ))}
    </SelectField>
  );
}

/** Ouvrir une commune du référentiel (`GET /communes`, `POST /zones`, clé d'idempotence). */
function OpenZone({ onOpened }: { onOpened: (zone: Zone) => void }) {
  const communes = useResource(listCommunes);
  const [communeKey, setCommuneKey] = useState('');
  const [draft, setDraft] = useState<ZoneDraft>({
    name: '',
    coefficient: '',
    surcharge: '',
    planningMode: '',
  });
  const form = useFormSubmit(['communeKey', 'name', 'coefficientBps', 'visitFeeSurcharge', 'planningMode']);
  const idempotency = useIdempotencyKey();

  if (communes.state.status === 'loading') return <Note>{c.loading}</Note>;
  if (communes.state.status === 'error') {
    return (
      <div className="grid justify-items-start gap-2">
        <FormMessage>{errorText(communes.state.error) || t.communesUnavailable}</FormMessage>
        <ActionButton label={c.retry} onClick={async () => communes.reload()} />
      </div>
    );
  }
  const free = communes.state.data.filter((commune) => commune.zoneId === null);
  if (!free.length) return <Note>{t.noCommuneLeft}</Note>;

  function submit(event: FormEvent) {
    const { body, errors } = zoneBody(draft);
    if (!communeKey) errors.communeKey = c.required;
    void form.submit(event, errors, async () => {
      try {
        const zone = await createZone({ ...body, communeKey }, idempotency.key());
        idempotency.settle();
        onOpened(zone);
        communes.refresh();
        setCommuneKey('');
        setDraft({ name: '', coefficient: '', surcharge: '', planningMode: '' });
        return t.created(zone.name);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="zone-commune"
          label={t.commune}
          hint={t.communeHint}
          value={communeKey}
          error={form.errors.communeKey}
          onChange={(event) => setCommuneKey(event.target.value)}
        >
          <option value="">{t.chooseCommune}</option>
          {free.map((commune) => (
            <option key={commune.communeKey} value={commune.communeKey}>
              {commune.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="zone-nom"
          label={t.name}
          hint={t.nameHint}
          value={draft.name}
          maxLength={100}
          error={form.errors.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <TextField
          id="zone-coefficient"
          label={t.coefficient}
          hint={t.coefficientHint}
          inputMode="decimal"
          value={draft.coefficient}
          error={form.errors.coefficientBps}
          onChange={(event) => setDraft({ ...draft, coefficient: event.target.value })}
        />
        <TextField
          id="zone-majoration"
          label={t.surcharge}
          hint={t.surchargeHint}
          inputMode="numeric"
          value={draft.surcharge}
          error={form.errors.visitFeeSurcharge}
          onChange={(event) => setDraft({ ...draft, surcharge: event.target.value })}
        />
        <PlanningSelect
          id="zone-planification"
          value={draft.planningMode}
          onChange={(planningMode) => setDraft({ ...draft, planningMode })}
        />
      </div>
      <FormFooter pending={form.pending} message={form.message} success={form.success} label={t.open} />
    </form>
  );
}

/** Modifier une zone (`PATCH /zones/{id}`) dans une boîte : nom, coefficient, majoration, planification. */
function EditZone({ zone, onSaved }: { zone: Zone; onSaved: (zone: Zone) => void }) {
  const amountsHidden = zone.visitFeeSurcharge === undefined;
  return (
    <ConfirmAction
      label={t.edit}
      accessibleLabel={`${t.edit} ${zone.name}`}
      title={t.editTitle(zone.name)}
      confirmLabel={c.save}
      labels={{ cancel: c.cancel, pending: c.saving }}
      onConfirm={async (data) => {
        const { body, errors } = zoneBody(
          {
            name: String(data.get('name') ?? ''),
            coefficient: String(data.get('coefficient') ?? ''),
            surcharge: amountsHidden ? '' : String(data.get('surcharge') ?? ''),
            planningMode: String(data.get('planningMode') ?? ''),
          },
          amountsHidden ? { ...zone, visitFeeSurcharge: null } : zone,
        );
        const first = Object.values(errors)[0];
        if (first) return first;
        if (!Object.keys(body).length) return null;
        try {
          onSaved(await updateZone(zone.id, body));
          return null;
        } catch (error) {
          return errorText(error);
        }
      }}
    >
      <TextField
        id={`zone-${zone.id}-nom`}
        name="name"
        label={t.name}
        defaultValue={zone.name}
        maxLength={100}
      />
      <TextField
        id={`zone-${zone.id}-coefficient`}
        name="coefficient"
        label={t.coefficient}
        hint={t.coefficientHint}
        inputMode="decimal"
        defaultValue={coefficientInput(zone.coefficientBps)}
      />
      {amountsHidden ? null : (
        <TextField
          id={`zone-${zone.id}-majoration`}
          name="surcharge"
          label={t.surcharge}
          hint={zone.visitFeeSurcharge ? t.surchargeLocked : t.surchargeHint}
          inputMode="numeric"
          defaultValue={zone.visitFeeSurcharge ? String(zone.visitFeeSurcharge.amount) : ''}
        />
      )}
      <PlanningSelect id={`zone-${zone.id}-planification`} defaultValue={zone.planningMode ?? ''} />
    </ConfirmAction>
  );
}

/**
 * Activer ou désactiver une zone (`POST /zones/{id}/activation`, clé d'idempotence). Désactiver demande
 * une confirmation ; avec des dossiers en cours, la confirmation est envoyée (`confirm: true`). Si la
 * gateway en trouve entre-temps (`CLEANING_ZONE_HAS_ACTIVITY`), les nombres s'affichent et un nouvel
 * essai confirme.
 */
function ZoneActivation({ zone, onChange }: { zone: Zone; onChange: (zone: Zone) => void }) {
  const idempotency = useIdempotencyKey();
  const [activity, setActivity] = useState<{ requests: number; programs: number } | null>(null);
  const counts = activity ?? { requests: zone.openRequests, programs: zone.activePrograms };
  const busy = counts.requests + counts.programs > 0;

  async function send(active: boolean, confirm?: boolean) {
    try {
      const saved = await setZoneActive(
        zone.id,
        confirm ? { active, confirm } : { active },
        idempotency.key(),
      );
      idempotency.settle();
      setActivity(null);
      onChange(saved);
    } catch (error) {
      idempotency.settle(error);
      throw error;
    }
  }

  if (!zone.active) {
    return (
      <ActionButton
        label={c.reactivate}
        accessibleLabel={`${c.reactivate} ${zone.name}`}
        onClick={() => send(true)}
      />
    );
  }
  return (
    <ConfirmAction
      label={c.deactivate}
      accessibleLabel={`${c.deactivate} ${zone.name}`}
      title={t.deactivateTitle(zone.name)}
      description={busy ? t.deactivateActivity(counts.requests, counts.programs) : t.deactivateText}
      confirmLabel={c.deactivate}
      labels={{ cancel: c.cancel, pending: c.sending }}
      danger
      onConfirm={async () => {
        try {
          await send(false, busy || undefined);
          return null;
        } catch (error) {
          if (error instanceof ApiError && error.code === 'CLEANING_ZONE_HAS_ACTIVITY') {
            const { openRequests, activePrograms } = error.details;
            const found = {
              requests: typeof openRequests === 'number' ? openRequests : 0,
              programs: typeof activePrograms === 'number' ? activePrograms : 0,
            };
            setActivity(found);
            return t.deactivateActivity(found.requests, found.programs);
          }
          return errorText(error);
        }
      }}
    />
  );
}

function columns(canManage: boolean, onChange: (zone: Zone) => void): TableColumn<Zone>[] {
  return [
    {
      key: 'zone',
      header: t.columns.zone,
      primary: true,
      cell: (zone) => (
        <span className="grid gap-0.5">
          <span>{zone.name}</span>
          <code className="text-small text-ink-muted font-normal">{zone.communeKey}</code>
        </span>
      ),
    },
    {
      key: 'coefficient',
      header: t.columns.coefficient,
      className: 'tabular-nums',
      cell: (zone) => formatCoefficient(zone.coefficientBps),
    },
    {
      key: 'surcharge',
      header: t.columns.surcharge,
      cell: (zone) => <Amount value={zone.visitFeeSurcharge} />,
    },
    {
      key: 'planning',
      header: t.columns.planning,
      cell: (zone) => (zone.planningMode ? planningMode(zone.planningMode) : t.general),
    },
    {
      key: 'activity',
      header: t.columns.activity,
      cell: (zone) => t.activity(zone.openRequests, zone.activePrograms),
    },
    { key: 'state', header: t.columns.state, cell: (zone) => <ActiveBadge active={zone.active} feminine /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: c.actions,
            cell: (zone: Zone) => (
              <span className="flex flex-wrap gap-2">
                <EditZone zone={zone} onSaved={onChange} />
                <ZoneActivation zone={zone} onChange={onChange} />
              </span>
            ),
          },
        ]
      : []),
  ];
}

/** Zones desservies (`GET /admin/cleaning/zones`) : ouverture, modification, activation (admin). */
export function ZonesScreen() {
  const access = useCleaningAccess();
  const list = usePagedList(listZones, loadErrorText);
  const canManage = !!access?.['cleaning.zone.manage'];
  const [changed, setChanged] = useState<Record<string, Zone>>({});
  const [opened, setOpened] = useState<Zone[]>([]);
  const replace = useCallback(
    (zone: Zone) => setChanged((previous) => ({ ...previous, [zone.id]: zone })),
    [],
  );
  const rows = [...opened, ...list.items.filter((item) => !opened.some((zone) => zone.id === item.id))].map(
    (zone) => changed[zone.id] ?? zone,
  );
  return (
    <div className="grid gap-6">
      {canManage ? (
        <Panel title={t.open} id="zones-ouverture">
          <OpenZone onOpened={(zone) => setOpened((previous) => [zone, ...previous])} />
        </Panel>
      ) : null}
      <ListState list={{ ...list, items: rows }} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns(canManage, replace)}
          rows={rows}
          rowKey={(zone) => zone.id}
        />
      </ListState>
    </div>
  );
}
