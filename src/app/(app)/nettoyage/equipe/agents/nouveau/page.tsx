import type { Metadata } from 'next';
import { AgentInvite, inviteTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: inviteTexts.title };

/** Inviter un agent par SMS (la création directe attend le dépôt des pièces). */
export default function CleaningNewAgentPage() {
  return <AgentInvite />;
}
