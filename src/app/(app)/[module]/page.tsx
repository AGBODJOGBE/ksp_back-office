import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { MODULES, SUPER_ADMIN } from '@/config/modules';
import { visibleModules } from '@/lib/auth/access';

type Params = Promise<{ module: string }>;

const available = () => visibleModules([SUPER_ADMIN]).filter((module) => module.slug !== 'tableau-de-bord');

export function generateStaticParams() {
  return available().map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { module: slug } = await params;
  return { title: MODULES.find((module) => module.slug === slug)?.label };
}

/** Page provisoire d'un module : remplacée par ses écrans lors du lot qui le livre. */
export default async function ModulePage({ params }: { params: Params }) {
  const { module: slug } = await params;
  const current = available().find((item) => item.slug === slug);
  if (!current) notFound();
  return (
    <AppShell current={current.slug}>
      <h1 className="text-2xl font-bold">{current.label}</h1>
      <p className="text-ink-muted mt-2 max-w-3xl">{current.description}</p>
      <p className="border-line bg-surface rounded-card mt-6 border p-5 text-sm">
        Rôles :{' '}
        {current.roles.map((role) => (
          <code key={role} className="mr-2">
            {role}
          </code>
        ))}
      </p>
    </AppShell>
  );
}
