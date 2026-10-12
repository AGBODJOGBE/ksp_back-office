import { Container } from '@/components/ui/container';
import { siteConfig } from '@/config/site';

export const metadata = { title: 'Connexion' };

/**
 * Connexion des agents : téléphone + code, puis double authentification obligatoire.
 * Écran provisoire, branché sur identity (via la gateway) au lot 1.
 */
export default function LoginPage() {
  return (
    <Container className="flex min-h-dvh max-w-md flex-col justify-center py-12">
      <p className="text-brand-700 font-bold">{siteConfig.name}</p>
      <h1 className="mt-2 text-2xl font-bold">Connexion</h1>
      <p className="text-ink-muted mt-2 text-sm">
        Réservé à l&apos;équipe KSP. La double authentification est obligatoire.
      </p>
      <p role="status" className="border-line bg-surface rounded-card mt-6 border p-4 text-sm">
        La connexion sera disponible au lot 1.
      </p>
    </Container>
  );
}
