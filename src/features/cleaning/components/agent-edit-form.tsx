'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { type UpdateAgentBody, updateAgent } from '@/features/cleaning/agents-api';
import { formatPhone, toBeninE164 } from '@/features/cleaning/agents-filters';
import { type Agent, EMPLOYMENT_KINDS, type EmploymentKind } from '@/features/cleaning/agents-schemas';
import { agentsTexts, employmentName } from '@/features/cleaning/agents-texts';
import { inviteTexts } from '@/features/cleaning/agent-actions-texts';
import { hoursValue } from '@/features/cleaning/availability-edit';
import { cleaningTexts } from '@/features/cleaning/texts';
import { CheckList, communeName, type References } from './agent-parts';
import { type FieldErrors, FormFooter, useFormSubmit } from './parts';

const t = agentsTexts.detail;
const c = cleaningTexts.common;

const FIELDS = [
  'zoneKeys',
  'validatedSkillCodes',
  'maxHoursPerDay',
  'maxHoursPerWeek',
  'employmentKind',
  'residenceCommuneKey',
  'emergencyContact',
] as const;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Modification d'un agent (`PATCH /agents/{id}`) : communes de travail, compétences validées, charge,
 * statut d'emploi, commune de résidence, personne à prévenir. Seuls les champs changés sont envoyés.
 */
export function AgentEditForm({
  agent,
  references,
  onSaved,
  onClose,
}: {
  agent: Agent;
  references: References;
  onSaved: (agent: Agent) => void;
  onClose: () => void;
}) {
  const validated = agent.skills.filter((skill) => skill.validated).map((skill) => skill.code);
  const [zones, setZones] = useState<string[]>(agent.zoneKeys);
  const [skills, setSkills] = useState<string[]>(validated);
  const [perDay, setPerDay] = useState(String(agent.maxHoursPerDay));
  const [perWeek, setPerWeek] = useState(String(agent.maxHoursPerWeek));
  const [employment, setEmployment] = useState<EmploymentKind>(agent.employmentKind);
  const [residence, setResidence] = useState(agent.residenceCommuneKey);
  const [contactName, setContactName] = useState(agent.emergencyContact.name);
  const [contactPhone, setContactPhone] = useState(formatPhone(agent.emergencyContact.phone));
  const form = useFormSubmit(FIELDS);

  const communeKeys = new Set([...references.communes.keys(), ...agent.zoneKeys, agent.residenceCommuneKey]);
  const communes = [...communeKeys]
    .map((key) => ({ value: key, label: communeName(references, key) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const skillOptions = [
    ...references.skills
      .filter((skill) => skill.active)
      .map((skill) => ({ value: skill.code, label: skill.name })),
    ...agent.skills
      .filter((skill) => !references.skills.some((item) => item.code === skill.code && item.active))
      .map((skill) => ({ value: skill.code, label: skill.name })),
  ];

  function body(errors: FieldErrors): UpdateAgentBody {
    const result: UpdateAgentBody = {};
    if (!sameSet(zones, agent.zoneKeys)) result.zoneKeys = zones;
    if (!sameSet(skills, validated)) result.validatedSkillCodes = skills;
    const day = hoursValue(perDay, 24);
    const week = hoursValue(perWeek, 168);
    if (day === null) errors.maxHoursPerDay = c.between(1, 24);
    else if (day !== agent.maxHoursPerDay) result.maxHoursPerDay = day;
    if (week === null) errors.maxHoursPerWeek = c.between(1, 168);
    else if (week !== agent.maxHoursPerWeek) result.maxHoursPerWeek = week;
    if (employment !== agent.employmentKind) result.employmentKind = employment;
    if (residence !== agent.residenceCommuneKey) result.residenceCommuneKey = residence;
    const phone = toBeninE164(contactPhone);
    const name = contactName.trim();
    if (!name) errors['emergencyContact.name'] = c.required;
    else if (name.length > 100) errors['emergencyContact.name'] = c.tooLong(100);
    if (!phone) errors['emergencyContact.phone'] = inviteTexts.phoneInvalid;
    if (name && phone && (name !== agent.emergencyContact.name || phone !== agent.emergencyContact.phone)) {
      result.emergencyContact = { name, phone };
    }
    return result;
  }

  return (
    <form
      noValidate
      className="rounded-card border-line grid gap-5 border p-4"
      aria-labelledby="agent-modifier-titre"
      onSubmit={(event) => {
        const errors: FieldErrors = {};
        const changes = body(errors);
        void form.submit(event, errors, async () => {
          if (!Object.keys(changes).length) return c.saved;
          onSaved(await updateAgent(agent.id, changes));
          return t.editSaved;
        });
      }}
    >
      <h3 id="agent-modifier-titre" className="text-ink font-semibold">
        {t.editTitle}
      </h3>
      <p className="text-small text-ink-muted">{t.editHint}</p>
      <CheckList
        id="agent-communes"
        legend={t.zones}
        error={form.errors.zoneKeys}
        options={communes}
        selected={zones}
        onChange={setZones}
      />
      <CheckList
        id="agent-competences"
        legend={t.skills}
        hint={t.skillsHint}
        error={form.errors.validatedSkillCodes}
        options={skillOptions}
        selected={skills}
        onChange={setSkills}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="agent-heures-jour"
          label={t.perDay}
          inputMode="numeric"
          value={perDay}
          error={form.errors.maxHoursPerDay}
          onChange={(event) => setPerDay(event.target.value)}
        />
        <TextField
          id="agent-heures-semaine"
          label={t.perWeek}
          inputMode="numeric"
          value={perWeek}
          error={form.errors.maxHoursPerWeek}
          onChange={(event) => setPerWeek(event.target.value)}
        />
        <SelectField
          id="agent-emploi"
          label={t.employment}
          value={employment}
          error={form.errors.employmentKind}
          onChange={(event) => setEmployment(event.target.value as EmploymentKind)}
        >
          {EMPLOYMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {employmentName(kind)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="agent-residence"
          label={t.residence}
          value={residence}
          error={form.errors.residenceCommuneKey}
          onChange={(event) => setResidence(event.target.value)}
        >
          {communes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="agent-urgence-nom"
          label={t.emergencyName}
          value={contactName}
          maxLength={100}
          error={form.errors['emergencyContact.name']}
          onChange={(event) => setContactName(event.target.value)}
        />
        <TextField
          id="agent-urgence-telephone"
          label={t.emergencyPhone}
          hint={inviteTexts.phoneHint}
          type="tel"
          autoComplete="off"
          value={contactPhone}
          error={form.errors['emergencyContact.phone'] ?? form.errors.emergencyContact}
          onChange={(event) => setContactPhone(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FormFooter pending={form.pending} message={form.message} success={form.success} label={c.save} />
        <Button variant="ghost" onClick={onClose}>
          {c.close}
        </Button>
      </div>
    </form>
  );
}
