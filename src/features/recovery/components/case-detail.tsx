'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { useResource } from '@/lib/use-resource';
import type { RecoveryAccess } from '@/features/recovery/access';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import { isLitigation } from '@/features/recovery/case-logic';
import type { AdminCase } from '@/features/recovery/case-schemas';
import { caseStatusTone } from '@/features/recovery/case-texts';
import { getCase } from '@/features/recovery/cases-api';
import { recoveryPaths } from '@/features/recovery/paths';
import { caseStatusLabel, kindLabel, stageLabel } from '@/features/recovery/texts';
import type { OnDone } from './case-action-parts';
import { Disputes, StageChange, StageHistory } from './case-decisions';
import { CaseFollowUp } from './case-followup';
import { CaseJournal } from './case-journal';
import { CaseMoney } from './case-money';
import { CaseNegotiation } from './case-negotiation';
import { CurrentPlan, Promises, ScaleSummary } from './case-plan';
import { CaseAssignment, CaseReview } from './case-review';
import { CaseSteps } from './case-steps';
import { CaseAmounts, CaseParties, CaseSynthesis } from './case-summary';
import { BackLink, Note, Panel, ResourceView, useRecoveryAccess } from './parts';

const t = caseDetailTexts;
const a = caseActionTexts;
const OPEN = ['under_review', 'info_requested', 'active', 'suspended'];

/** Corps de la fiche : les étapes dans l'ordre du métier, puis l'argent, les parties et le journal. */
function CaseContent({
  detail,
  access,
  onDone,
}: {
  detail: AdminCase;
  access: RecoveryAccess;
  onDone: OnDone;
}) {
  const item = detail.case;
  const litigation = isLitigation(item.stage);
  const working = access.work && OPEN.includes(item.status);
  const negotiable = access.work && item.status === 'active' && !litigation;
  return (
    <div className="grid gap-6">
      <CaseSteps item={item} litigationShown={litigation} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CaseSynthesis detail={detail} />
        <CaseAmounts item={item} />
      </div>
      <CaseReview item={item} access={access} onDone={onDone} />
      <CaseAssignment item={item} access={access} onDone={onDone} />
      <Panel title={t.procedure.title} id="dossier-amiable">
        <p>{item.stage ? t.procedure.current(stageLabel(item.stage)) : t.procedure.none}</p>
        {access.stage ? <StageChange item={item} onDone={onDone} /> : null}
        <StageHistory item={item} />
      </Panel>
      <Panel title={a.negotiation.title} id="dossier-echeancier">
        <ScaleSummary scale={item.planScale} />
        <CurrentPlan item={item} access={access} onDone={onDone} />
        {negotiable ? <CaseNegotiation item={item} onDone={onDone} /> : null}
      </Panel>
      <Panel title={a.followUp.title} id="dossier-suivi">
        <p className="text-ink-muted">{a.followUp.lead}</p>
        <Promises item={item} />
        {working ? <CaseFollowUp item={item} onDone={onDone} /> : null}
      </Panel>
      <Panel title={t.disputes.title} id="dossier-contestations">
        <Disputes item={item} access={access} onDone={onDone} />
      </Panel>
      {litigation ? (
        <Panel title={t.litigation.title} id="dossier-contentieux">
          <Note>{t.litigation.text}</Note>
        </Panel>
      ) : null}
      <CaseMoney item={item} access={access} onDone={onDone} />
      <CaseParties item={item} />
    </div>
  );
}

/**
 * Fiche d'un dossier (`GET /recovery/cases/{id}`) et son journal. Chaque action est confirmée ; après
 * une réussite, la fiche est relue (sans écran de chargement) et le journal repart de sa première page.
 */
export function CaseDetail({ id }: { id: string }) {
  const access = useRecoveryAccess();
  const load = useCallback(() => getCase(id), [id]);
  const resource = useResource(load);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const onDone: OnDone = (message) => {
    setNotice(message);
    setVersion((value) => value + 1);
    resource.refresh();
  };

  return (
    <div className="grid gap-6">
      <BackLink href={recoveryPaths.cases}>{t.back}</BackLink>
      <ResourceView resource={resource} lines={8}>
        {(detail) => (
          <div className="grid gap-6">
            <header className="grid gap-3">
              <Heading as="h1" size="h2">
                {t.title(detail.case.number)}
              </Heading>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={caseStatusTone(detail.case.status)} dot>
                  {caseStatusLabel(detail.case.status)}
                </Badge>
                {detail.case.stage ? <Badge tone="brand">{stageLabel(detail.case.stage)}</Badge> : null}
                <Badge>{kindLabel(detail.case.kind)}</Badge>
              </div>
              <p className="text-ink-muted">{t.creditor(detail.case.creditor.displayName)}</p>
            </header>
            <FormMessage tone="success">{notice}</FormMessage>
            {access ? <CaseContent detail={detail} access={access} onDone={onDone} /> : null}
            <CaseJournal key={version} caseId={id} />
          </div>
        )}
      </ResourceView>
    </div>
  );
}
