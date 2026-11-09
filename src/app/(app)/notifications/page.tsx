import { redirect } from 'next/navigation';
import { notificationPaths } from '@/features/notification';

/** `/notifications` (entrée du menu) ouvre l'historique des envois. */
export default function NotificationsPage() {
  redirect(notificationPaths.deliveries);
}
