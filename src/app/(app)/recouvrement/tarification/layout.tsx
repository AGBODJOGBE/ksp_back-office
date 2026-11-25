import type { ReactNode } from 'react';
import { PricingNav } from '@/features/recovery';

/** Tarification : règles (fiches comprises) et simulateur. */
export default function RecoveryPricingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <PricingNav />
      {children}
    </div>
  );
}
