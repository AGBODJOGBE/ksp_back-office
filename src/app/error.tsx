'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Heading } from '@/components/ui/heading';
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
    <main id="contenu" className="bg-canvas min-h-dvh">
      <Container size="reading" className="py-24 text-center">
        <Heading as="h1" size="h2">
          {t.errors.genericTitle}
        </Heading>
        <p className="text-ink-muted mt-3">{t.errors.genericText}</p>
        <Button onClick={reset} className="mt-8">
          {t.common.retry}
        </Button>
      </Container>
    </main>
  );
}
