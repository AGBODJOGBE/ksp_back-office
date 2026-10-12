import Link from 'next/link';
import type { ReactNode } from 'react';
import { SUPER_ADMIN } from '@/config/modules';
import { siteConfig } from '@/config/site';
import { visibleModules } from '@/lib/auth/access';
import { SidebarNav } from './sidebar-nav';

/**
 * Cadre du back-office : menu des modules à gauche (repliable sur téléphone), contenu à droite.
 * Tant que la connexion n'est pas branchée (lot 1), le menu montre les modules de la phase en cours
 * tels qu'un super administrateur les verrait.
 */
export function AppShell({ children, current }: { children: ReactNode; current?: string }) {
  const modules = visibleModules([SUPER_ADMIN]);
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      <aside className="border-line bg-surface border-b lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-brand-700 font-bold tracking-tight">
            {siteConfig.name}
          </Link>
          <span className="bg-accent text-accent-contrast rounded px-2 py-0.5 text-xs font-semibold">
            Interne
          </span>
        </div>
        <details className="group px-3 pb-3 lg:hidden">
          <summary className="border-line flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-medium">
            Menu
          </summary>
          <nav aria-label="Modules" className="mt-2">
            <SidebarNav modules={modules} current={current} />
          </nav>
        </details>
        <nav aria-label="Modules" className="hidden px-3 pb-6 lg:block">
          <SidebarNav modules={modules} current={current} />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div role="status" className="bg-warning/10 text-warning px-4 py-2 text-sm">
          Aperçu : la connexion, la double authentification et les droits par rôle seront branchés au lot 1.
        </div>
        <main id="contenu" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
