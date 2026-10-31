import { OrganizationDetail } from '@/features/identity/organizations';

/** Fiche d'un compte entreprise (rendue à la demande ; les données sont lues par le navigateur). */
export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetail id={id} />;
}
