import { names } from './texts';

/** Textes des sections du Recouvrement dans la file « À traiter » de Ma journée. */

export const workItemLabel = names({
  promised_callback: 'Rappel promis',
  broken_promise: 'Promesse non tenue',
  missed_installment: 'Échéance manquée',
  reminder_due: 'Relance du jour',
  callback_request: 'Demande de rappel',
  dispute: 'Contestation',
  plan_to_validate: 'Échéancier à valider',
});

export const recoveryQueueTexts = {
  callbacks: {
    title: 'Rappels du recouvrement',
    description: 'Rappels promis aux débiteurs et demandes de rappel reçues.',
  },
  promises: {
    title: 'Promesses et échéances non tenues',
    description: 'Promesses de paiement non tenues et échéances d’échéancier manquées.',
  },
  reminders: {
    title: 'Relances du jour',
    description: 'Relances planifiées pour aujourd’hui sur vos dossiers.',
  },
  decisions: {
    title: 'Contestations et échéanciers à valider',
    description: 'Contestations à trancher et échéanciers hors barème en attente de validation.',
  },
  seeAll: 'Voir les dossiers',
  open: 'Ouvrir le dossier',
  dossier: (number: string, debtor: string) => `Dossier ${number} — ${debtor}`,
  due: (date: string) => `Pour le ${date}`,
  amountDue: (amount: string) => `Dû ${amount}`,
} as const;
