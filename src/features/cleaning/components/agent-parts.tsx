'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { useResource } from '@/lib/use-resource';
import { allSkills, listCommunes } from '@/features/cleaning/api';
import type { AgentSkill, AgentStatus } from '@/features/cleaning/agents-schemas';
import { agentStatus, agentsTexts } from '@/features/cleaning/agents-texts';
import type { Skill } from '@/features/cleaning/schemas';
import { FieldGroup } from './editors';

const t = agentsTexts;

/** Référentiels d'affichage des agents : communes (nom par clé) et compétences du catalogue. */
export interface References {
  communes: ReadonlyMap<string, string>;
  /** Compétences du catalogue (actives et désactivées), pour les noms et les choix. */
  skills: readonly Skill[];
}

const EMPTY: References = { communes: new Map(), skills: [] };

/** Communes et compétences ; une liste illisible reste vide (les clés s'affichent alors telles quelles). */
async function loadReferences(): Promise<References> {
  const [communes, skills] = await Promise.allSettled([listCommunes(), allSkills()]);
  return {
    communes: new Map(
      communes.status === 'fulfilled' ? communes.value.map((item) => [item.communeKey, item.name]) : [],
    ),
    skills: skills.status === 'fulfilled' ? skills.value : [],
  };
}

export function useReferences(): References {
  const resource = useResource(loadReferences);
  return resource.state.status === 'ready' ? resource.state.data : EMPTY;
}

/** Nom d'une commune, ou sa clé quand le référentiel ne la connaît pas. */
export const communeName = (references: References, key: string) => references.communes.get(key) ?? key;

/** Communes de travail lisibles, séparées par des virgules. */
export const communeNames = (references: References, keys: readonly string[]) =>
  keys.map((key) => communeName(references, key)).join(', ');

export function AgentStatusBadge({ status }: { status: AgentStatus | string }) {
  const badge = agentStatus(status);
  return (
    <Badge tone={badge.tone} dot>
      {badge.label}
    </Badge>
  );
}

/** Compétences d'un agent : validées, puis déclarées à vérifier (marquées). */
export function SkillsInline({ skills }: { skills: readonly AgentSkill[] }) {
  if (!skills.length) return <span className="text-ink-muted">{t.list.noSkill}</span>;
  const sorted = [...skills].sort((a, b) => Number(b.validated) - Number(a.validated));
  return (
    <span className="flex flex-wrap gap-1">
      {sorted.map((skill) => (
        <Badge key={skill.code} tone={skill.validated ? 'brand' : 'neutral'}>
          {skill.validated ? skill.name : `${skill.name} (${t.list.pending})`}
        </Badge>
      ))}
    </span>
  );
}

export interface CheckOption {
  value: string;
  label: ReactNode;
}

/**
 * Choix multiple en cases à cocher (communes, compétences, membres) dans un groupe titré ; une longue
 * liste défile dans un cadre de hauteur fixe pour garder le bouton d'envoi visible.
 */
export function CheckList({
  id,
  legend,
  hint,
  error,
  options,
  selected,
  onChange,
}: {
  id: string;
  legend: string;
  hint?: ReactNode;
  error?: string;
  options: readonly CheckOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  return (
    <FieldGroup id={id} legend={legend} hint={hint} error={error}>
      <div
        className={cn(
          'grid gap-x-4 sm:grid-cols-2',
          options.length > 12 && 'rounded-control border-line max-h-72 overflow-y-auto border p-2',
        )}
      >
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3">
            <input
              id={`${id}-${option.value}`}
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
              aria-invalid={error ? true : undefined}
              className="accent-action size-5 shrink-0"
            />
            <span className="min-w-0">{option.label}</span>
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}
