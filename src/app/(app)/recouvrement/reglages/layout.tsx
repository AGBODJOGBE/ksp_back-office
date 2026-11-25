import type { ReactNode } from 'react';
import { SettingsNav } from '@/features/recovery';

/** Réglages du module : réglages généraux et jours fériés. */
export default function RecoverySettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <SettingsNav />
      {children}
    </div>
  );
}
