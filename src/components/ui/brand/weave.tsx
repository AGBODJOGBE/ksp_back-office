import { useId } from 'react';
import { cn } from '@/lib/cn';

/*
 * Signature KSP : motif géométrique inspiré des pagnes tissés du Bénin (bandes, chevrons, losanges).
 * Purement décoratif (masqué aux lecteurs d'écran), quelques centaines d'octets de SVG, aucune image.
 */

/**
 * Trame répétée en fond. La couleur vient du texte (`text-…`) et l'intensité de l'opacité (`opacity-…`) :
 * rester discret (10 à 20 %).
 */
export function WeavePattern({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" focusable="false" className={cn('pointer-events-none', className)}>
      <defs>
        <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M0 8 8 2l8 6 8-6 8 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="M16 15.5 20.5 20 16 24.5 11.5 20Z" fill="currentColor" />
          <path
            d="M0 16.5 3.5 20 0 23.5M32 16.5 28.5 20 32 23.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <rect x="7.25" y="19.25" width="1.5" height="1.5" fill="currentColor" />
          <rect x="23.25" y="19.25" width="1.5" height="1.5" fill="currentColor" />
          <path d="M0 29.5h32" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Bande tissée : liseré horizontal (haut de pied de page, séparation éditoriale). */
export function WeaveBand({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" focusable="false" className={cn('block h-3 w-full', className)}>
      <defs>
        <pattern id={id} width="28" height="12" patternUnits="userSpaceOnUse">
          <rect width="28" height="12" className="fill-accent" />
          <path d="M14 1 19 6l-5 5-5-5Z" className="fill-brand-900" />
          <path d="M14 4 16 6l-2 2-2-2Z" className="fill-accent-bright" />
          <rect x="0" y="5" width="3.5" height="2" className="fill-brand-900" />
          <rect x="24.5" y="5" width="3.5" height="2" className="fill-brand-900" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Losange de la signature, utilisé comme emblème du logo et marqueur. */
export function WeaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-brand-900" />
      <path d="M16 6 26 16 16 26 6 16Z" className="fill-accent" />
      <path d="M16 11.5 20.5 16 16 20.5 11.5 16Z" className="fill-brand-900" />
      <path d="M16 14.25 17.75 16 16 17.75 14.25 16Z" className="fill-accent-bright" />
    </svg>
  );
}

/** Composition de losanges concentriques : visuel d'accueil, en attendant de vraies photos. */
export function WeaveEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false" className={cn('shrink-0', className)}>
      <path
        d="M120 6 234 120 120 234 6 120Z"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        className="stroke-accent-bright opacity-60"
      />
      <path d="M120 34 206 120 120 206 34 120Z" className="fill-accent" />
      <path
        d="M120 56 184 120 120 184 56 120Z"
        fill="none"
        strokeWidth="2"
        className="stroke-brand-900 opacity-40"
      />
      <path d="M120 76 164 120 120 164 76 120Z" className="fill-brand-900" />
      <path d="M120 100 140 120 120 140 100 120Z" className="fill-accent-bright" />
      <rect
        x="116"
        y="18"
        width="8"
        height="8"
        transform="rotate(45 120 22)"
        className="fill-accent-bright"
      />
      <rect
        x="116"
        y="214"
        width="8"
        height="8"
        transform="rotate(45 120 218)"
        className="fill-accent-bright"
      />
      <rect
        x="18"
        y="116"
        width="8"
        height="8"
        transform="rotate(45 22 120)"
        className="fill-accent-bright"
      />
      <rect
        x="214"
        y="116"
        width="8"
        height="8"
        transform="rotate(45 218 120)"
        className="fill-accent-bright"
      />
    </svg>
  );
}
