'use client';

import { useEffect, useState } from 'react';
import { type QrMatrix, qrMatrix } from '@/features/identity/qr';

type State = { status: 'loading' } | { status: 'ready'; matrix: QrMatrix } | { status: 'failed' };

/**
 * QR code calculé dans le navigateur (aucun appel extérieur : le secret ne quitte pas la page).
 * Toujours noir sur blanc, quelle que soit la charte : les applications d'authentification le lisent mieux.
 */
export function QrCode({ value, label, fallback }: { value: string; label: string; fallback: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    qrMatrix(value).then(
      (matrix) => active && setState({ status: 'ready', matrix }),
      () => active && setState({ status: 'failed' }),
    );
    return () => {
      active = false;
    };
  }, [value]);

  if (state.status === 'failed') {
    return <p className="text-small text-ink-muted p-4 text-center">{fallback}</p>;
  }
  if (state.status === 'loading') {
    return <div aria-hidden="true" className="bg-surface-sunken size-full animate-pulse rounded-md" />;
  }
  const { size, path } = state.matrix;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="block size-full"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
