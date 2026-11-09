import { redirect } from 'next/navigation';
import { accountPaths } from '@/features/identity/accounts';

/** `/administration` (entrée du menu) ouvre les comptes et rôles, seul écran du module aujourd'hui. */
export default function AdministrationPage() {
  redirect(accountPaths.list);
}
