import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Heading } from '@/components/ui/heading';
import { getDictionary } from '@/i18n';

export default function NotFound() {
  const t = getDictionary();
  return (
    <main id="contenu" className="bg-canvas min-h-dvh">
      <Container size="reading" className="py-24 text-center">
        <Heading as="h1" size="h2">
          {t.errors.notFoundTitle}
        </Heading>
        <p className="text-ink-muted mt-3">{t.errors.notFoundText}</p>
        <ButtonLink href="/" className="mt-8">
          {t.common.backHome}
        </ButtonLink>
      </Container>
    </main>
  );
}
