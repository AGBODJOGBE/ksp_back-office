import { billingAccess } from '@/features/billing';
import { paymentAccess } from '@/features/payment';
import { walletAccess } from '@/features/wallet';
import { financeTabs } from './finance-tabs';

const labels = (roles: string[]) =>
  financeTabs(billingAccess(roles), paymentAccess(roles), walletAccess(roles)).map((tab) => tab.label);

describe('onglets de la Finance', () => {
  it('suivent les rôles du contrat', () => {
    const finance = ['Factures', 'Paiements en ligne', 'Portefeuilles', 'Reversements', 'Réglages'];
    expect(labels(['super_admin'])).toEqual(finance);
    expect(labels(['finance_officer'])).toEqual(finance);
    expect(labels(['cleaning_admin'])).toEqual(['Factures', 'Paiements en ligne', 'Réglages']);
    expect(labels(['cleaning_supervisor'])).toEqual(['Factures']);
    expect(labels(['support_agent'])).toEqual([]);
  });
});
