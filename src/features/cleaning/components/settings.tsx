'use client';

import { type FormEvent, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { getSettings, type SettingsBody, updateSettings, xof } from '@/features/cleaning/api';
import { parseInteger } from '@/features/cleaning/inputs';
import { type CleaningSettings, PLANNING_MODES, type PlanningMode } from '@/features/cleaning/schemas';
import { type NumberSetting, SETTINGS_GROUPS, settingsTexts } from '@/features/cleaning/settings-texts';
import { cleaningTexts, planningMode } from '@/features/cleaning/texts';
import {
  CheckField,
  checklistBody,
  checklistDraft,
  type ChecklistDraft,
  ChecklistEditor,
  checklistErrors,
  FieldGroup,
} from './editors';
import {
  type FieldErrors,
  FormFooter,
  Note,
  Panel,
  ResourceView,
  UpdatedLine,
  useCleaningAccess,
  useFormSubmit,
} from './parts';

const t = settingsTexts;
const c = cleaningTexts.common;

const WEIGHTS = ['continuity', 'proximity', 'balance', 'rating'] as const;
const NUMBERS = SETTINGS_GROUPS.flatMap((group) => group.numbers);

interface Draft {
  numbers: Record<string, string>;
  flags: { deductVisitFee: boolean; balanceGuarantee: boolean };
  defaultVisitFee: string;
  defaultPlanningMode: PlanningMode;
  weights: Record<(typeof WEIGHTS)[number], string>;
  checklist: ChecklistDraft[];
}

function draftOf(settings: CleaningSettings): Draft {
  return {
    numbers: Object.fromEntries(NUMBERS.map((setting) => [setting.key, String(settings[setting.key])])),
    flags: { deductVisitFee: settings.deductVisitFee, balanceGuarantee: settings.balanceGuarantee },
    defaultVisitFee: settings.defaultVisitFee ? String(settings.defaultVisitFee.amount) : '',
    defaultPlanningMode: settings.defaultPlanningMode,
    weights: {
      continuity: String(settings.scoreWeights.continuity),
      proximity: String(settings.scoreWeights.proximity),
      balance: String(settings.scoreWeights.balance),
      rating: String(settings.scoreWeights.rating),
    },
    checklist: checklistDraft(settings.commonChecklist),
  };
}

const inRange = (setting: Pick<NumberSetting, 'min' | 'max'>, raw: string) => {
  const value = parseInteger(raw);
  return value !== null && value >= setting.min && value <= setting.max;
};

/** Bornes de chaque réglage (contrat) ; les règles croisées (avertissement < suspension…) restent au serveur. */
function validate(draft: Draft, feeVisible: boolean): FieldErrors {
  const errors: FieldErrors = { ...checklistErrors(draft.checklist, 'commonChecklist') };
  for (const setting of NUMBERS) {
    if (!inRange(setting, draft.numbers[setting.key] ?? ''))
      errors[setting.key] = c.between(setting.min, setting.max);
  }
  for (const weight of WEIGHTS) {
    if (!inRange({ min: 0, max: 100 }, draft.weights[weight]))
      errors[`scoreWeights.${weight}`] = c.between(0, 100);
  }
  if (feeVisible) {
    const fee = parseInteger(draft.defaultVisitFee);
    if (fee === null || fee > 100_000_000) errors.defaultVisitFee = c.invalidAmount;
  }
  return errors;
}

/** Corps du `PATCH` : seulement les réglages modifiés (« champs absents inchangés »). */
function bodyOf(draft: Draft, settings: CleaningSettings): SettingsBody {
  const body: Record<string, unknown> = {};
  for (const setting of NUMBERS) {
    const value = parseInteger(draft.numbers[setting.key] ?? '');
    if (value !== null && value !== settings[setting.key]) body[setting.key] = value;
  }
  if (draft.flags.deductVisitFee !== settings.deductVisitFee)
    body.deductVisitFee = draft.flags.deductVisitFee;
  if (draft.flags.balanceGuarantee !== settings.balanceGuarantee)
    body.balanceGuarantee = draft.flags.balanceGuarantee;
  if (draft.defaultPlanningMode !== settings.defaultPlanningMode)
    body.defaultPlanningMode = draft.defaultPlanningMode;
  const fee = parseInteger(draft.defaultVisitFee);
  if (settings.defaultVisitFee && fee !== null && fee !== settings.defaultVisitFee.amount)
    body.defaultVisitFee = xof(fee);
  const weights = Object.fromEntries(
    WEIGHTS.map((weight) => [weight, parseInteger(draft.weights[weight]) ?? 0]),
  );
  if (WEIGHTS.some((weight) => weights[weight] !== settings.scoreWeights[weight]))
    body.scoreWeights = weights;
  const checklist = checklistBody(draft.checklist);
  if (JSON.stringify(checklist) !== JSON.stringify(settings.commonChecklist))
    body.commonChecklist = checklist;
  return body as SettingsBody;
}

const FIELDS = [
  ...NUMBERS.map((setting) => setting.key),
  'deductVisitFee',
  'balanceGuarantee',
  'defaultVisitFee',
  'defaultPlanningMode',
  'scoreWeights',
  'commonChecklist',
];

function SettingsForm({
  settings,
  readOnly,
  onSaved,
}: {
  settings: CleaningSettings;
  readOnly: boolean;
  onSaved: (settings: CleaningSettings) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(settings));
  const form = useFormSubmit(FIELDS);
  const feeVisible = settings.defaultVisitFee !== undefined;
  const total = WEIGHTS.reduce((sum, weight) => sum + (parseInteger(draft.weights[weight]) ?? 0), 0);

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, feeVisible), async () => {
      const body = bodyOf(draft, settings);
      if (!Object.keys(body).length) return t.nothingChanged;
      const saved = await updateSettings(body);
      setDraft(draftOf(saved));
      onSaved(saved);
      return c.saved;
    });
  }

  const numberField = (setting: NumberSetting) => (
    <TextField
      key={setting.key}
      id={`reglage-${setting.key}`}
      label={setting.unit ? `${setting.label} (${setting.unit})` : setting.label}
      hint={`${setting.hint} ${c.between(setting.min, setting.max)}`}
      inputMode="numeric"
      value={draft.numbers[setting.key] ?? ''}
      readOnly={readOnly}
      error={form.errors[setting.key]}
      onChange={(event) =>
        setDraft({ ...draft, numbers: { ...draft.numbers, [setting.key]: event.target.value } })
      }
    />
  );

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      {SETTINGS_GROUPS.map((group) => (
        <Panel key={group.id} title={group.title} id={`reglages-${group.id}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.numbers.map(numberField)}
            {group.id === 'demandes' ? (
              feeVisible ? (
                <TextField
                  id="reglage-defaultVisitFee"
                  label={t.defaultVisitFee}
                  hint={t.defaultVisitFeeHint}
                  inputMode="numeric"
                  value={draft.defaultVisitFee}
                  readOnly={readOnly}
                  error={form.errors.defaultVisitFee}
                  onChange={(event) => setDraft({ ...draft, defaultVisitFee: event.target.value })}
                />
              ) : (
                <Note>{c.amountHiddenHint}</Note>
              )
            ) : null}
            {group.id === 'planification' ? (
              <SelectField
                id="reglage-defaultPlanningMode"
                label={t.planningMode}
                hint={t.planningModeHint}
                value={draft.defaultPlanningMode}
                disabled={readOnly}
                error={form.errors.defaultPlanningMode}
                onChange={(event) =>
                  setDraft({ ...draft, defaultPlanningMode: event.target.value as PlanningMode })
                }
              >
                {PLANNING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {planningMode(mode)}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </div>
          {group.flags?.map((flag) => (
            <CheckField
              key={flag.key}
              id={`reglage-${flag.key}`}
              label={flag.label}
              hint={flag.hint}
              checked={draft.flags[flag.key]}
              disabled={readOnly}
              onChange={(checked) => setDraft({ ...draft, flags: { ...draft.flags, [flag.key]: checked } })}
            />
          ))}
          {group.id === 'planification' ? (
            <FieldGroup
              id="reglage-poids"
              legend={t.weights}
              hint={t.weightsHint}
              error={form.errors.scoreWeights}
            >
              <div className="grid gap-4 sm:grid-cols-4">
                {WEIGHTS.map((weight) => (
                  <TextField
                    key={weight}
                    id={`reglage-poids-${weight}`}
                    label={t.weightNames[weight]}
                    inputMode="numeric"
                    value={draft.weights[weight]}
                    readOnly={readOnly}
                    error={form.errors[`scoreWeights.${weight}`]}
                    onChange={(event) =>
                      setDraft({ ...draft, weights: { ...draft.weights, [weight]: event.target.value } })
                    }
                  />
                ))}
              </div>
              <p className="text-small text-ink-muted" aria-live="polite">
                {t.weightsTotal(total)}
              </p>
            </FieldGroup>
          ) : null}
          {group.id === 'execution' ? (
            <ChecklistEditor
              id="reglage-controle"
              field="commonChecklist"
              legend={t.checklist}
              hint={t.checklistHint}
              items={draft.checklist}
              onChange={(checklist) => setDraft({ ...draft, checklist })}
              errors={form.errors}
              readOnly={readOnly}
            />
          ) : null}
        </Panel>
      ))}
      {readOnly ? null : (
        <div className="bg-canvas/95 border-line sticky bottom-0 -mx-1 border-t px-1 py-4 backdrop-blur">
          <FormFooter pending={form.pending} message={form.message} success={form.success} label={t.save} />
        </div>
      )}
    </form>
  );
}

/** Réglages du module (`GET`, `PATCH /admin/cleaning/settings`) ; lecture seule sans `cleaning.settings.manage`. */
export function SettingsScreen() {
  const access = useCleaningAccess();
  const resource = useResource(getSettings);
  const canManage = !!access?.['cleaning.settings.manage'];
  return (
    <ResourceView resource={resource} lines={8}>
      {(settings) => (
        <div className="grid gap-4">
          <UpdatedLine at={settings.updatedAt} name={settings.updatedByName} />
          {canManage ? null : <Note>{c.readOnly}</Note>}
          <SettingsForm settings={settings} readOnly={!canManage} onSaved={resource.set} />
        </div>
      )}
    </ResourceView>
  );
}
