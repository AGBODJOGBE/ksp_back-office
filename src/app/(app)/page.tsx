import { AppShell } from '@/components/layout/app-shell';
import { DashboardOverview } from '@/features/dashboard';

export default function DashboardPage() {
  return (
    <AppShell current="tableau-de-bord">
      <DashboardOverview />
    </AppShell>
  );
}
