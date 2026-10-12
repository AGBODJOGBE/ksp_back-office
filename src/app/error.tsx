'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getDictionary } from '@/i18n';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getDictionary();
  useEffect(() => {
    // Remonté vers l'outil de suivi des erreurs (Sentry) quand il sera branché.
    console.error(error);
  }, [error]);
  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold">{t.errors.genericTitle}</h1>
      <p className="text-ink-muted mt-3">{t.errors.genericText}</p>
      <Button onClick={reset} className="mt-8">
        {t.common.retry}
      </Button>
    </Container>
  );
}
