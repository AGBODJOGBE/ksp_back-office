import type { ComponentProps, ReactNode } from 'react';
import { FieldError, fieldIds, inputClasses } from '@/components/ui/field';
import { cn } from '@/lib/cn';

type Common = { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; className?: string };

function describedBy(id: string, hint: ReactNode, error?: string | null): string | undefined {
  const ids = fieldIds(id);
  return cn(hint ? ids.hint : null, error ? ids.error : null) || undefined;
}

function Frame({ id, label, hint, error, className, children }: Common & { children: ReactNode }) {
  const ids = fieldIds(id);
  return (
    <div className={className}>
      <label htmlFor={id} className="text-ink block font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={ids.hint} className="text-small text-ink-muted mt-1">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
    </div>
  );
}

/** Liste déroulante native de la charte : libellé, aide et erreur reliés (comme `TextField`). */
export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...select
}: Common & Omit<ComponentProps<'select'>, 'id'>) {
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        {...select}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClasses({ invalid: !!error, className: 'mt-2 pr-10' })}
      >
        {children}
      </select>
    </Frame>
  );
}

/** Zone de texte de la charte (motif, compte rendu, note d'incident). */
export function TextAreaField({
  id,
  label,
  hint,
  error,
  className,
  ...textarea
}: Common & Omit<ComponentProps<'textarea'>, 'id'>) {
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={3}
        {...textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClasses({ invalid: !!error, className: 'mt-2 py-3' })}
      />
    </Frame>
  );
}
