import { AccountDetail } from '@/features/identity/accounts';

/** Fiche d'un compte (rendue à la demande ; les données sont lues par le navigateur). */
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetail id={id} />;
}
