import type { Metadata } from 'next';
import { RoleCreate, roleTexts } from '@/features/identity/accounts';

export const metadata: Metadata = { title: roleTexts.createDialog.heading };

/** Création d'un rôle : coque statique ; le catalogue des permissions est lu par le navigateur. */
export default function NewRolePage() {
  return <RoleCreate />;
}
