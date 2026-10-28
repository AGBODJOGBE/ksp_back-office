'use client';

import { contrastRatio, parseColor, wcagLevel } from '@/lib/color/contrast';

/*
 * Lecture des jetons dans le navigateur : la page de charte affiche les valeurs réellement appliquées
 * (une seule source de vérité, `globals.css`), sans recopier aucune couleur dans le code.
 */

function readToken(element: Element, token: string): string {
  return getComputedStyle(element).getPropertyValue(token).trim();
}

/** Affiche la valeur calculée d'une variable CSS à l'endroit où le composant est rendu. */
export function TokenValue({ token, className }: { token: string; className?: string }) {
  return (
    <span
      className={className}
      ref={(element) => {
        if (element) element.textContent = readToken(element, token) || '—';
      }}
    />
  );
}

/** Échantillon texte sur fond, avec le rapport de contraste calculé à partir des jetons. */
export function ContrastPair({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  return (
    <div
      className="rounded-control border-line flex items-center justify-between gap-4 border p-4"
      style={{ color: `var(${fg})`, backgroundColor: `var(${bg})` }}
      ref={(element) => {
        if (!element) return;
        const output = element.querySelector('[data-ratio]');
        const a = parseColor(readToken(element, fg));
        const b = parseColor(readToken(element, bg));
        if (!output) return;
        if (!a || !b) {
          output.textContent = 'non mesurable';
          return;
        }
        const ratio = contrastRatio(a, b);
        output.textContent = `${ratio.toFixed(2).replace('.', ',')}:1 · ${wcagLevel(ratio)}`;
      }}
    >
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block font-mono text-xs opacity-90">
          {fg} / {bg}
        </span>
      </span>
      <span data-ratio className="shrink-0 text-right text-sm font-semibold tabular-nums" />
    </div>
  );
}
