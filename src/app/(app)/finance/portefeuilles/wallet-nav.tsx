'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { walletPaths } from '@/features/wallet';

/** Vue d'ensemble (entrée de l'onglet), puis ce qui attend une action, puis les reversements (lecture). */
const ITEMS = [
  { href: walletPaths.overview, label: 'Vue d’ensemble' },
  { href: walletPaths.withdrawals, label: 'Retraits' },
  { href: walletPaths.creditRequests, label: 'Demandes de crédit' },
  { href: walletPaths.payouts, label: 'Reversements' },
];

/**
 * Sections de l'onglet Portefeuilles, en pastilles (comme les sections du Nettoyage) : la page courante
 * marquée par `aria-current` ; la vue d'ensemble n'est courante que sur sa propre adresse. Rangée ici,
 * comme les onglets de la Finance, pour ne pas alourdir le premier chargement du module.
 */
export function WalletNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des portefeuilles" className="-mx-gutter overflow-x-auto">
      <ul className="px-gutter flex min-w-max gap-2 pb-1">
        {ITEMS.map((item) => {
          const current =
            item.href === walletPaths.overview
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-control border-line text-ink-muted hover:text-ink hover:border-line-strong flex min-h-11 items-center border px-3 text-[0.9375rem] font-medium whitespace-nowrap',
                  'aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink aria-[current=page]:font-semibold',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
