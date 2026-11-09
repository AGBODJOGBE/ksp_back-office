import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { TemplatesList, notificationTexts } from '@/features/notification';

const t = notificationTexts.templates;

export const metadata: Metadata = { title: t.title };

/** Modèles de messages, en lecture seule. */
export default function TemplatesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <TemplatesList />
    </div>
  );
}
