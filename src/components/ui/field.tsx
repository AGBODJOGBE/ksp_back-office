import type { ComponentProps, ReactNode, Ref } from 'react';
import { IconAlert } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/** Identifiants de l'aide et de l'erreur d'un champ, repris par `aria-describedby`. */
export function fieldIds(id: string) {
  return { hint: `${id}-aide`, error: `${id}-erreur` };
}

/** Zone de saisie de la charte : 48 px de haut, bordure contrastée, anneau de focus, rouge si invalide. */
export function inputClasses({ invalid = false, className }: { invalid?: boolean; className?: string } = {}) {
  return cn(
    'rounded-control bg-surface text-ink min-h-12 w-full min-w-0 border px-4 text-base',
    'placeholder:text-ink-subtle focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
    'read-only:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
    invalid ? 'border-danger' : 'border-line-control',
    className,
  );
}

/**
 * Champ de formulaire : libellé, aide et message d'erreur reliés au champ (`aria-describedby`,
 * `aria-invalid`). L'erreur n'est pas annoncée d'elle-même : le formulaire place le focus sur le champ
 * en cause, ce qui fait lire le libellé puis l'erreur.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  inputClassName,
  inputRef,
  ...input
}: Omit<ComponentProps<'input'>, 'id' | 'ref'> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  inputClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const ids = fieldIds(id);
  const describedBy =
    cn(hint ? ids.hint : null, error ? ids.error : null, input['aria-describedby']) || undefined;
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
      <input
        id={id}
        ref={inputRef}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClasses({ invalid: !!error, className: cn('mt-2', inputClassName) })}
      />
      {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
    </div>
  );
}

/** Message d'erreur d'un champ ou d'un groupe de champs. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-small text-danger mt-2 flex items-start gap-2 font-medium">
      <IconAlert className="mt-0.5 size-4" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Message de formulaire annoncé aux lecteurs d'écran : `alert` pour une erreur, `status` pour une
 * information. La zone reste dans la page (vide) pour que l'annonce soit fiable à son remplissage.
 */
export function FormMessage({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'info';
  children?: ReactNode;
  className?: string;
}) {
  const filled = children !== null && children !== undefined && children !== false && children !== '';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn(!filled && 'sr-only', className)}>
      {filled ? (
        <p
          className={cn(
            'rounded-control text-small flex items-start gap-2 border p-4 font-medium',
            tone === 'error'
              ? 'border-danger bg-danger-soft text-danger'
              : 'border-line bg-surface-muted text-ink',
          )}
        >
          {tone === 'error' ? <IconAlert className="mt-0.5 size-4" /> : null}
          <span>{children}</span>
        </p>
      ) : null}
    </div>
  );
}
