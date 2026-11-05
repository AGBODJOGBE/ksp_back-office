import Link from 'next/link';
import { cn } from '@/lib/cn';

/*
 * Logo du Groupe KSP, redessiné en SVG d'après l'image de référence : « KSP » en lettres très grasses,
 * barre bleu nuit, barre verte et flèche or, puis « GROUP » en capitales espacées. Toutes les lettres sont
 * des tracés vectoriels (aucune police). Les couleurs viennent des jetons de la signature : sur un fond
 * bleu nuit (`data-tone="inverse"`), le bleu nuit devient blanc et le logo s'inverse de lui-même.
 *
 * Tout le logo tient dans ce fichier : le fichier officiel du groupe le remplacera ici, sans toucher
 * aux pages (le favicon, `src/app/icon.svg`, en est la seule copie).
 */

/* Lettres « KSP » (repère de l'image de référence : 1200 × 800). */
const K = 'M273 215H335V325L430 215H491L396 340L495 468H420L335 357V468H273Z';
/* « S » tracé par sa ligne médiane, en trait épais (58). */
const S =
  'M680 291C680 263.4 650 241 613 241C576 241 546 263.4 546 291C546 324 580 333 613 341C646 349 680 358 680 391C680 418.6 650 441 613 441C576 441 546 418.6 546 391';
const P =
  'M742 215H845C905 215 940 252 940 296.5C940 341 905 378 845 378H806V468H742ZM806 265H842C865 265 878 279 878 296.5C878 314 865 328 842 328H806Z';
/* « GROUP » : lignes médianes en trait de 13. */
const GROUP =
  'M437 557.6A19 21 0 1 0 441 570.5H424M499.5 598V549.5H514A13 13 0 0 1 514 575.5H499.5M512 575.5L531.5 598M581.5 570.5A22 21 0 1 0 625.5 570.5A22 21 0 1 0 581.5 570.5ZM680.5 543V576.5A15 15 0 0 0 710.5 576.5V543M768.5 598V549.5H786A14 14 0 0 1 786 577.5H768.5';

/** Barre bleu nuit, barre verte, flèche or : la signature du logo. */
function SignatureShapes() {
  return (
    <>
      <rect x="365" y="493" width="176" height="26" className="fill-signature-1" />
      <rect x="549" y="493" width="217" height="26" className="fill-signature-2" />
      <path d="M772 485L835 506L772 527Z" className="fill-signature-3" />
    </>
  );
}

function Letters() {
  return (
    <>
      <path d={K} className="fill-brand" />
      <path d={S} fill="none" strokeWidth="58" className="stroke-brand" />
      <path d={P} fillRule="evenodd" className="fill-brand" />
    </>
  );
}

function Group({ transform }: { transform?: string }) {
  return (
    <path
      d={GROUP}
      transform={transform}
      fill="none"
      strokeWidth="13"
      strokeLinejoin="miter"
      className="stroke-signature-2"
    />
  );
}

export type LogoVariant = 'stacked' | 'horizontal';

/**
 * Le logo seul, décoratif ou nommé (`title`). `stacked` : la composition de l'image (KSP, signature,
 * GROUP) ; `horizontal` : version compacte de l'en-tête, « GROUP » à droite de « KSP ».
 */
export function LogoMark({
  variant = 'stacked',
  title,
  className,
}: {
  variant?: LogoVariant;
  /** Nom accessible ; sans titre, le logo est décoratif (masqué aux lecteurs d'écran). */
  title?: string;
  className?: string;
}) {
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  return (
    <svg
      viewBox={variant === 'stacked' ? '268 206 676 398' : '268 206 1342 326'}
      focusable="false"
      className={cn('block shrink-0', className)}
      {...a11y}
    >
      <Letters />
      <SignatureShapes />
      {/* Version compacte : « GROUP » agrandi d'une fois et demie, centré sur la hauteur de « KSP ». */}
      <Group transform={variant === 'horizontal' ? 'matrix(1.5 0 0 1.5 394.5 -514.75)' : undefined} />
    </svg>
  );
}

/** Logo cliquable de l'en-tête et du menu (retour à l'accueil). */
export function Logo({ className, variant = 'horizontal' }: { className?: string; variant?: LogoVariant }) {
  return (
    <Link
      href="/"
      aria-label="Groupe KSP, accueil"
      className={cn('group/logo inline-flex min-h-11 items-center rounded-md', className)}
    >
      <LogoMark
        variant={variant}
        className={cn(
          'ease-soft transition-transform duration-(--motion-base) group-active/logo:scale-[0.98]',
          variant === 'horizontal' ? 'h-9 w-auto sm:h-10' : 'h-16 w-auto',
        )}
      />
    </Link>
  );
}
