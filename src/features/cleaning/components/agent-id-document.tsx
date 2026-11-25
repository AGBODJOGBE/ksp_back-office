'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { getAgentIdDocument } from '@/features/cleaning/agents-api';
import type { Agent, IdDocument } from '@/features/cleaning/agents-schemas';
import { agentName, agentsTexts } from '@/features/cleaning/agents-texts';
import { errorText } from '@/features/cleaning/errors';
import { cleaningTexts } from '@/features/cleaning/texts';
import { Note } from './parts';

type Photo = IdDocument['front'];

const t = agentsTexts.idDocument;

/**
 * Image servie par un lien temporaire du service de fichiers. Volontairement une `<img>` simple : le
 * chargeur d'images de Next.js passerait par le serveur et garderait une copie en cache, ce qui est
 * exclu pour une pièce d'identité. Aucun référent n'est transmis au stockage.
 */
export function TemporaryImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- lien temporaire, jamais mis en cache par le serveur
  return <img src={url} alt={alt} referrerPolicy="no-referrer" className={className} />;
}

function Side({ label, photo, name }: { label: string; photo: Photo; name: string }) {
  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="text-ink font-semibold">{label}</figcaption>
      {photo.url ? (
        <>
          <TemporaryImage
            url={photo.url}
            alt={t.alt(label, name)}
            className="rounded-control border-line max-h-80 w-full border object-contain"
          />
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
          >
            {t.open}
          </a>
        </>
      ) : (
        <Note>{t.expired}</Note>
      )}
    </figure>
  );
}

/**
 * Pièce d'identité (admin Nettoyage seulement) : lue à la demande explicite, gardée en mémoire le temps
 * de l'affichage, jamais dans l'adresse ; « Masquer » l'oublie. Chaque lecture est tracée par le service.
 */
export function AgentIdDocument({ agent }: { agent: Agent }) {
  const [document, setDocument] = useState<IdDocument | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agent.hasIdDocument) return <Note>{t.missing}</Note>;

  async function show() {
    setPending(true);
    setError(null);
    try {
      setDocument(await getAgentIdDocument(agent.id));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  const name = agentName(agent);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted max-w-reading">{t.hint}</p>
      {document ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Side label={t.front} photo={document.front} name={name} />
            <Side label={t.back} photo={document.back} name={name} />
          </div>
          <Button variant="secondary" className="justify-self-start" onClick={() => setDocument(null)}>
            {t.hide}
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          className="justify-self-start"
          aria-busy={pending || undefined}
          disabled={pending}
          onClick={show}
        >
          {pending ? cleaningTexts.common.loading : t.show}
        </Button>
      )}
      <FormMessage>{error}</FormMessage>
    </div>
  );
}
