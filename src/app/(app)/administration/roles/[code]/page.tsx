import { RoleDetail } from '@/features/identity/accounts';

/** Fiche d'un rôle (rendue à la demande ; les données sont lues par le navigateur). */
export default async function RolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoleDetail code={code} />;
}
