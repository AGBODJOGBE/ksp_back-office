import type { Metadata } from 'next';
import { PendingScreen, recoveryTexts } from '@/features/recovery';

export const metadata: Metadata = { title: recoveryTexts.tabs.cases };

/** Dossiers : écran provisoire, remplacé par la file des dossiers (sous-lot 4b). */
export default function RecoveryCasesPage() {
  return <PendingScreen title={recoveryTexts.tabs.cases} text={recoveryTexts.pending.cases} />;
}
