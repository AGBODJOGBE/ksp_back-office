'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Case à cocher de la charte (cible de 44 px), avec une aide facultative. */
export function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: ReactNode;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          id={id}
          type="checkbox"
          className="accent-brand size-5"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-aide` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-aide`} className="text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Boutons « monter », « descendre » et (élément nouveau seulement) « retirer » d'un élément de liste. */
export function ItemTools({
  index,
  count,
  name,
  labels,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  name: string;
  labels: {
    moveUp: (name: string) => string;
    moveDown: (name: string) => string;
    remove: (name: string) => string;
  };
  onMove: (step: -1 | 1) => void;
  onRemove?: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.moveUp(name)}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.moveDown(name)}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">↓</span>
      </Button>
      {onRemove ? (
        <Button variant="danger" size="icon" aria-label={labels.remove(name)} onClick={onRemove}>
          <span aria-hidden="true">✕</span>
        </Button>
      ) : null}
    </span>
  );
}
