import { MODULES } from '@/config/modules';
import { DashboardOverview } from '@/features/dashboard';

export default function DashboardPage() {
  return <DashboardOverview modules={MODULES} />;
}
