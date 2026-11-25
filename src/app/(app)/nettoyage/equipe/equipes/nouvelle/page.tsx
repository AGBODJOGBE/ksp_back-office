import type { Metadata } from 'next';
import { NewTeam, teamsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: teamsTexts.form.newTitle };

/** Nouvelle équipe. */
export default function CleaningNewTeamPage() {
  return <NewTeam />;
}
