import type { Metadata } from 'next';
import { PendingScreen, recoveryTexts } from '@/features/recovery';

export const metadata: Metadata = { title: recoveryTexts.tabs.cases };

/** Fiche dossier : écran provisoire (sous-lot 4b), cible des liens de Ma journée et des factures. */
export default function RecoveryCasePage() {
  return <PendingScreen title={recoveryTexts.tabs.cases} text={recoveryTexts.pending.caseDetail} />;
}
