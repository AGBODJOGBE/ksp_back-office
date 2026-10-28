'use client';

import { usePathname } from 'next/navigation';
import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react';

function close(panel: HTMLElement | null) {
  if (panel?.matches(':popover-open')) panel.hidePopover();
}

/**
 * Panneau du menu : tiroir (API `popover` native) sur téléphone, colonne fixe sur grand écran.
 * Ouverture par le bouton du bandeau ; fermeture par Échap, clic à l'extérieur, bouton dédié, lien
 * suivi ou changement de page — sans état React.
 */
export function SidebarPanel({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => close(ref.current), [pathname]);

  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest('a')) close(event.currentTarget);
  }

  return (
    <aside
      ref={ref}
      id={id}
      popover="auto"
      aria-label={label}
      data-scroll-lock=""
      className={className}
      onClick={closeOnLink}
    >
      {children}
    </aside>
  );
}
