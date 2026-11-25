import type { ReactNode } from 'react';
import { TeamNav } from '@/features/cleaning';

/** Onglet « Agents et équipes » : agents (et leurs fiches), équipes. */
export default function CleaningTeamLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <TeamNav />
      {children}
    </div>
  );
}
