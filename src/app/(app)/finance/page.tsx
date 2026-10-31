import { redirect } from 'next/navigation';
import { billingPaths } from '@/features/billing';

/** `/finance` (entrée du menu) ouvre les factures, premier onglet ouvert à tous les rôles du module. */
export default function FinancePage() {
  redirect(billingPaths.invoices);
}
