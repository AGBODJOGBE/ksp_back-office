import type { Metadata } from 'next';
import { PendingScreen, recoveryTexts } from '@/features/recovery';

export const metadata: Metadata = { title: recoveryTexts.tabs.offlinePayments };

/** Paiements hors ligne : écran provisoire, remplacé par la file à valider (sous-lot 4b). */
export default function RecoveryOfflinePaymentsPage() {
  return (
    <PendingScreen title={recoveryTexts.tabs.offlinePayments} text={recoveryTexts.pending.offlinePayments} />
  );
}
