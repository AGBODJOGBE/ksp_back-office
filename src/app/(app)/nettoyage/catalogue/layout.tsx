import type { ReactNode } from 'react';
import { CatalogSteps } from '@/features/cleaning';

/** Catalogue : les étapes de construction, dans l'ordre, au-dessus de chaque écran. */
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <CatalogSteps />
      {children}
    </div>
  );
}
