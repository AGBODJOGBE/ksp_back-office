'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { formatPhone } from '@/features/cleaning/agents-filters';
import type { Agent } from '@/features/cleaning/agents-schemas';
import { agentsTexts, employmentName, formatHours, formatRating } from '@/features/cleaning/agents-texts';
import { communeName, communeNames, type References, SkillsInline } from './agent-parts';
import { AgentEditForm } from './agent-edit-form';
import type { AgentStepProps } from './agent-lifecycle';
import { Note } from './parts';

const t = agentsTexts.detail;

/** Identité, contact, communes, compétences et charge ; modification pour qui gère les agents. */
export function AgentProfile({
  agent,
  onChange,
  canManage,
  references,
}: AgentStepProps & { references: References }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="grid gap-4">
      <DescriptionList
        items={[
          { term: t.phone, value: <span className="tabular-nums">{formatPhone(agent.phone)}</span> },
          { term: t.employment, value: employmentName(agent.employmentKind) },
          { term: t.residence, value: communeName(references, agent.residenceCommuneKey) },
          {
            term: t.zones,
            value: agent.zoneKeys.length ? communeNames(references, agent.zoneKeys) : t.noZone,
          },
          { term: t.skills, value: <SkillsInline skills={agent.skills} /> },
          {
            term: t.load,
            value: `${t.perDay} : ${agent.maxHoursPerDay} · ${t.perWeek} : ${agent.maxHoursPerWeek}`,
          },
          {
            term: t.emergency,
            value: `${agent.emergencyContact.name} · ${formatPhone(agent.emergencyContact.phone)}`,
          },
          {
            term: t.mobileMoney,
            value: agent.mobileMoneyNumber ? formatPhone(agent.mobileMoneyNumber) : t.noMobileMoney,
          },
        ]}
      />
      {canManage ? (
        editing ? (
          <AgentEditForm
            agent={agent}
            references={references}
            onSaved={(saved) => onChange(saved)}
            onClose={() => setEditing(false)}
          />
        ) : (
          <Button variant="secondary" className="justify-self-start" onClick={() => setEditing(true)}>
            {t.edit}
          </Button>
        )
      ) : (
        <Note>{t.readOnly}</Note>
      )}
    </div>
  );
}

/** Activité de l'agent (R-AG-04), sans montants. */
export function AgentStats({ agent }: { agent: Agent }) {
  const { stats } = agent;
  return (
    <DescriptionList
      items={[
        { term: t.sessions, value: <span className="tabular-nums">{stats.sessionsCompleted}</span> },
        { term: t.visits, value: <span className="tabular-nums">{stats.visitsCompleted}</span> },
        { term: t.hoursWeek, value: formatHours(stats.hoursThisWeek) },
        { term: t.hoursMonth, value: formatHours(stats.hoursThisMonth) },
        {
          term: t.rating,
          value:
            stats.ratingAverage === null
              ? t.noRating
              : `${formatRating(stats.ratingAverage)} (${t.ratings(stats.ratingsCount)})`,
        },
        { term: t.claims, value: <span className="tabular-nums">{stats.openClaims}</span> },
      ]}
    />
  );
}
