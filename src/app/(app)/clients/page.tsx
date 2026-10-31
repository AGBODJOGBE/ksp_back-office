import { redirect } from 'next/navigation';
import { organizationPaths } from '@/features/identity/organizations';

/** `/clients` (entrée du menu) ouvre les comptes entreprise, seul écran du module aujourd'hui. */
export default function ClientsPage() {
  redirect(organizationPaths.list);
}
