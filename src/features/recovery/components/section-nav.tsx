'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
// Magasin de session seul : la navigation ne charge ni zod ni le client de la gateway.
import { useSession } from '@/lib/api/session';
import { recoveryAccess } from '@/features/recovery/access';
import { recoveryPaths } from '@/features/recovery/paths';
import { pricingTexts } from '@/features/recovery/pricing-texts';
import { settingsTexts } from '@/features/recovery/settings-texts';

interface Item {
  href: string;
  label: string;
  /** L'entrée est-elle celle de la page affichée ? */
  current: (pathname: string) => boolean;
}

/** Navigation d'une section du module, en pastilles ; la page courante marquée par `aria-current`. */
function SectionNav({ label, items }: { label: string; items: readonly Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-gutter overflow-x-auto">
      <ul className="px-gutter flex min-w-max gap-2 pb-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current(pathname) ? 'page' : undefined}
              className={cn(
                'rounded-control border-line text-ink-muted hover:text-ink hover:border-line-strong flex min-h-11 items-center border px-3 text-[0.9375rem] font-medium whitespace-nowrap',
                'aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink aria-[current=page]:font-semibold',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Sous-sections de la tarification : règles (fiches comprises) et simulateur. */
export function PricingNav() {
  return (
    <SectionNav
      label={pricingTexts.nav.label}
      items={[
        {
          href: recoveryPaths.pricing,
          label: pricingTexts.nav.rules,
          current: (pathname) =>
            under(pathname, recoveryPaths.pricing) && !under(pathname, recoveryPaths.simulator),
        },
        {
          href: recoveryPaths.simulator,
          label: pricingTexts.nav.simulator,
          current: (pathname) => under(pathname, recoveryPaths.simulator),
        },
      ]}
    />
  );
}

/** Sous-sections des réglages : réglages généraux (administration) et jours fériés. */
export function SettingsNav() {
  const current = useSession();
  const access = current ? recoveryAccess(current) : null;
  const items: Item[] = [
    ...(access?.settings
      ? [
          {
            href: recoveryPaths.settings,
            label: settingsTexts.nav.general,
            current: (path: string) => path === recoveryPaths.settings,
          },
        ]
      : []),
    {
      href: recoveryPaths.holidays,
      label: settingsTexts.nav.holidays,
      current: (path) => under(path, recoveryPaths.holidays),
    },
  ];
  return <SectionNav label={settingsTexts.nav.label} items={items} />;
}
