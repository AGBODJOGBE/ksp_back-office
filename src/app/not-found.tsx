import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getDictionary } from '@/i18n';

export default function NotFound() {
  const t = getDictionary();
  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold">{t.errors.notFoundTitle}</h1>
      <p className="text-ink-muted mt-3">{t.errors.notFoundText}</p>
      <ButtonLink href="/" className="mt-8">
        Retour au tableau de bord
      </ButtonLink>
    </Container>
  );
}
