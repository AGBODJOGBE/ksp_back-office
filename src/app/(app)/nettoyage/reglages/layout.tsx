import type { ReactNode } from 'react';
import { SettingsNav } from '@/features/cleaning';

/** Réglages du module : réglages généraux, zones desservies, jours fériés. */
export default function CleaningSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <SettingsNav />
      {children}
    </div>
  );
}
