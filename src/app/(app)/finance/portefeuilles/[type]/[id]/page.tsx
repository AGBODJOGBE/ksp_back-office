import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HolderWallet, holderTypeOf } from '@/features/wallet';

/**
 * Portefeuille d'un titulaire, `/finance/portefeuilles/particulier|entreprise/<id>` (rendue à la demande ;
 * les données sont lues par le navigateur). Le compte du relevé est lu dans l'adresse sous Suspense.
 */
export default async function HolderWalletPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const holderType = holderTypeOf(type);
  if (!holderType) notFound();
  return (
    <Suspense>
      <HolderWallet type={holderType} id={id} />
    </Suspense>
  );
}
