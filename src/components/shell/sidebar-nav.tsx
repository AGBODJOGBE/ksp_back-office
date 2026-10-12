import Link from 'next/link';
import type { BackofficeModule } from '@/config/modules';

export function SidebarNav({ modules, current }: { modules: readonly BackofficeModule[]; current?: string }) {
  return (
    <ul className="space-y-1">
      {modules.map((module) => {
        const active = module.slug === current;
        return (
          <li key={module.slug}>
            <Link
              href={module.slug === 'tableau-de-bord' ? '/' : `/${module.slug}`}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                active ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              {module.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
