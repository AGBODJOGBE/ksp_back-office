'use client';

import { type FormEvent, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { useResource } from '@/lib/use-resource';
import { getSettings, updateSettings } from '@/features/recovery/settings-api';
import {
  settingsInput,
  type SettingsValues,
  settingsValues,
  validateSettings,
} from '@/features/recovery/settings-form';
import type { SettingsView } from '@/features/recovery/settings-schemas';
import { settingsTexts as t } from '@/features/recovery/settings-texts';
import { recoveryTexts } from '@/features/recovery/texts';
import { FormFooter, Note, ResourceView, UpdatedLine, useFormSubmit, useRecoveryAccess } from './parts';
import { ContactWindow, DelaySettings, PlanScales, ScoreWeights } from './settings-sections';

/** Champs que le service peut nommer (`details.field` de `RECOVERY_SETTING_OUT_OF_BOUNDS`). */
const FIELDS = [
  'minimumCaseAmount',
  'feePaymentDays',
  'reviewBusinessDays',
  'infoCompletionDays',
  'noticeResponseDays',
  'installmentGraceDays',
  'missedInstallmentsBeforeAmicable',
  'amicableDurationDays',
  'formalNoticeDays',
  'creditorApprovalDays',
  'planCreditorApprovalDays',
  'disputeAnswerDays',
  'prescriptionAlertDays',
  'debtorLinkDays',
  'debtorSessionMinutes',
  'remittanceBusinessDays',
  'partnerSilenceAlertDays',
  'unrecoverableAfterMonths',
  'closedCaseRetentionYears',
  'contactWindow',
  'defaultB2bScale',
  'defaultB2cScale',
  'defaultRentScale',
  'scoreWeights',
];

function SettingsForm({
  view,
  readOnly,
  onSaved,
}: {
  view: SettingsView;
  readOnly: boolean;
  onSaved: (view: SettingsView) => void;
}) {
  const [values, setValues] = useState<SettingsValues>(() => settingsValues(view.settings));
  const form = useFormSubmit(FIELDS);
  const change = (patch: Partial<SettingsValues>) => setValues((current) => ({ ...current, ...patch }));

  function submit(event: FormEvent) {
    void form.submit(event, validateSettings(values), async () => {
      const saved = await updateSettings(settingsInput(values));
      onSaved(saved);
      setValues(settingsValues(saved.settings));
      return t.saved;
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-8">
      <fieldset disabled={readOnly}>
        <TextField
          id="reglage-minimum"
          label={t.minimumCaseAmount}
          inputMode="numeric"
          value={values.minimumCaseAmount}
          error={form.errors.minimumCaseAmount}
          className="sm:max-w-sm"
          onChange={(event) => change({ minimumCaseAmount: event.target.value })}
        />
      </fieldset>
      <DelaySettings values={values} errors={form.errors} disabled={readOnly} onChange={change} />
      <ContactWindow values={values} errors={form.errors} disabled={readOnly} onChange={change} />
      <PlanScales values={values} errors={form.errors} disabled={readOnly} onChange={change} />
      <ScoreWeights values={values} errors={form.errors} disabled={readOnly} onChange={change} />
      {readOnly ? null : (
        <div className="bg-canvas/95 border-line sticky bottom-0 -mx-1 grid gap-2 border-t px-1 py-4 backdrop-blur">
          <FormFooter pending={form.pending} message={form.message} success={form.success} label={t.save} />
          <Note>{recoveryTexts.common.mfaHint}</Note>
        </div>
      )}
    </form>
  );
}

/** Réglages du recouvrement (`GET`, `PUT /recovery/settings`). */
export function SettingsScreen() {
  const access = useRecoveryAccess();
  const resource = useResource(getSettings);
  const readOnly = !access?.settings;
  return (
    <ResourceView resource={resource} lines={8}>
      {(view) => (
        <div className="grid gap-4">
          <UpdatedLine at={view.updatedAt} by={view.updatedBy} />
          {readOnly ? <Note>{t.readOnly}</Note> : null}
          <SettingsForm view={view} readOnly={readOnly} onSaved={resource.set} />
        </div>
      )}
    </ResourceView>
  );
}
