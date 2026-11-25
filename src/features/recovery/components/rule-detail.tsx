'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Heading } from '@/components/ui/heading';
import { useResource } from '@/lib/use-resource';
import { getRule } from '@/features/recovery/pricing-api';
import { editorTexts } from '@/features/recovery/pricing-editor-texts';
import { emptyRule, ruleValues } from '@/features/recovery/pricing-form';
import type { Rule } from '@/features/recovery/pricing-schemas';
import { objectLabel, pricingTexts } from '@/features/recovery/pricing-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import {
  BackLink,
  LoadingBlock,
  Note,
  Panel,
  ResourceView,
  useRecoveryAccess,
  useSessionUserId,
} from './parts';
import { PricingSimulator } from './pricing-simulator';
import { RuleActions } from './rule-actions';
import { RuleEditor } from './rule-editor';
import { RuleStatusBadge, RuleSummary } from './rule-summary';

const t = pricingTexts.detail;

function RuleContent({ initial }: { initial: Rule }) {
  const access = useRecoveryAccess();
  const userId = useSessionUserId();
  const [rule, setRule] = useState(initial);
  // Après une décision, le simulateur et le formulaire repartent de la règle renvoyée ; un brouillon
  // enregistré garde son formulaire (et son message de réussite).
  const [revision, setRevision] = useState(0);
  const update = (next: Rule) => {
    setRule(next);
    setRevision((value) => value + 1);
  };
  const manage = !!access?.pricingManage;
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={recoveryPaths.pricing}>{t.back}</BackLink>
        <Heading as="h1" size="h2">
          {rule.label}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          <RuleStatusBadge status={rule.status} />
          <span className="text-small text-ink-muted">
            {objectLabel(rule.object)} · {pricingTexts.list.version(rule.version)}
          </span>
        </div>
      </div>
      <Panel title={t.summary} id="regle-fiche">
        <RuleSummary rule={rule} />
      </Panel>
      <Panel title={t.actions} id="regle-decisions">
        {manage ? <RuleActions rule={rule} userId={userId} onChange={update} /> : <Note>{t.readOnly}</Note>}
      </Panel>
      {rule.status !== 'archived' ? (
        <Panel title={rule.status === 'draft' ? t.simulate : t.simulateRule} id="regle-simulation">
          <PricingSimulator key={revision} rule={rule} />
        </Panel>
      ) : null}
      {manage && rule.status === 'draft' ? (
        <Panel title={t.edit} id="regle-modifier">
          <RuleEditor key={revision} initial={ruleValues(rule)} rule={rule} onSaved={setRule} />
        </Panel>
      ) : null}
    </div>
  );
}

/** Fiche d'une règle : lecture, décisions, simulation, modification du brouillon. */
export function RuleDetail({ id }: { id: string }) {
  const load = useCallback(() => getRule(id), [id]);
  const resource = useResource(load);
  return (
    <ResourceView resource={resource} lines={6}>
      {(rule) => <RuleContent key={rule.id} initial={rule} />}
    </ResourceView>
  );
}

function NewRuleForm({ previous }: { previous?: Rule }) {
  const router = useRouter();
  // Nouvelle version : mêmes calcul et cible, validité à saisir (à partir d'aujourd'hui par défaut).
  const initial = previous
    ? { ...ruleValues(previous), validFrom: emptyRule().validFrom, validUntil: '', saved: undefined }
    : emptyRule();
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={previous ? recoveryPaths.rule(previous.id) : recoveryPaths.pricing}>
          {previous ? previous.label : t.back}
        </BackLink>
        <Heading as="h1" size="h2">
          {previous ? editorTexts.newVersionTitle : editorTexts.newTitle}
        </Heading>
        <p className="text-ink-muted max-w-reading">
          {previous ? editorTexts.newVersionLead(previous.label, previous.version) : editorTexts.newLead}
        </p>
      </div>
      <RuleEditor
        initial={initial}
        previous={previous}
        onSaved={(rule) => router.push(recoveryPaths.rule(rule.id))}
      />
    </div>
  );
}

function NewVersion({ id }: { id: string }) {
  const load = useCallback(() => getRule(id), [id]);
  const resource = useResource(load);
  return <ResourceView resource={resource}>{(rule) => <NewRuleForm previous={rule} />}</ResourceView>;
}

/** Nouvelle règle (brouillon), ou nouvelle version d'une règle publiée (`?version-de=`). */
export function NewRule() {
  const access = useRecoveryAccess();
  const previousId = useSearchParams().get('version-de');
  if (!access) return <LoadingBlock />;
  if (!access.pricingManage) return <Note>{t.readOnly}</Note>;
  return previousId ? <NewVersion id={previousId} /> : <NewRuleForm />;
}
