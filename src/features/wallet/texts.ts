import type { HolderType } from './api';

/** Textes des portefeuilles du back-office (module Finance). */

/** Segment d'adresse (en français) de chaque type de titulaire. */
const SLUGS: Record<HolderType, string> = { user: 'particulier', organization: 'entreprise' };

/** Type de titulaire d'un segment d'adresse, ou `null` s'il est inconnu (page introuvable). */
export function holderTypeOf(slug: string): HolderType | null {
  const entry = Object.entries(SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as HolderType) : null;
}

export const walletPaths = {
  overview: '/finance/portefeuilles',
  holder: (type: HolderType, id: string) => `/finance/portefeuilles/${SLUGS[type]}/${encodeURIComponent(id)}`,
} as const;

const kinds: Record<string, string> = {
  top_up: 'Recharge',
  service_payment: 'Paiement d’un service',
  refund: 'Remboursement',
  collection: 'Encaissement',
  payout: 'Reversement',
  payout_release: 'Reversement en échec, montant rendu',
  reversal: 'Annulation d’un encaissement',
};
export const statementKind = (code: string) => kinds[code] ?? code;

const internalAccounts: Record<string, { label: string; hint: string }> = {
  'ksp:prepaid_funds': {
    label: 'Recharges reçues',
    hint: 'Argent versé par les clients sur leur portefeuille prépayé.',
  },
  'ksp:service_revenue': {
    label: 'Services payés par portefeuille',
    hint: 'Missions et factures réglées depuis un portefeuille prépayé.',
  },
  'ksp:collections': {
    label: 'Fonds encaissés pour les créanciers',
    hint: 'Argent reçu pour le compte des créanciers du Recouvrement.',
  },
  'ksp:commission': { label: 'Commissions de KSP', hint: 'Part de KSP sur les encaissements.' },
  'ksp:payouts_in_transit': {
    label: 'Reversements en cours',
    hint: 'Reversements demandés, pas encore terminés.',
  },
};
export const internalAccount = (code: string) => internalAccounts[code] ?? { label: code, hint: '' };

const parts: Record<string, string> = { deposit: 'acompte', balance: 'solde' };

/** « Mission du Nettoyage, acompte », « Facture » : objet payé ou remboursé. */
export function objectLabel(object: { objectType: string; part: string | null }): string {
  const base =
    object.objectType === 'cleaning_mission'
      ? 'Mission du Nettoyage'
      : object.objectType === 'billing_invoice'
        ? 'Facture'
        : object.objectType;
  const part = object.part ? parts[object.part] : null;
  return part ? `${base}, ${part}` : base;
}

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export const walletTexts = {
  title: 'Portefeuilles',
  lead: 'Argent que KSP doit à ses clients (portefeuilles prépayés) et à ses créanciers, et comptes internes du grand livre. Ouvrez le portefeuille d’un client pour voir son relevé, le rembourser ou créditer une recharge reçue.',
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement de la suite…',
  overview: {
    title: 'Vue d’ensemble',
    owedToCustomers: 'Dû aux clients',
    owedToCustomersHint: 'Somme des portefeuilles prépayés.',
    customers: 'Clients avec un portefeuille',
    owedToHolders: 'Dû aux créanciers',
    holders: (count: number) => plural(count, 'créancier', 'créanciers'),
    internalTitle: 'Comptes internes de KSP',
    internalCaption: 'Soldes des comptes internes de KSP',
    account: 'Compte',
    balance: 'Solde',
    notAvailable: 'Non communiqué',
  },
  search: {
    title: 'Ouvrir le portefeuille d’un client',
    phone: 'Numéro de téléphone du particulier',
    phoneHint: 'Sans indicatif, +229 est ajouté. Exemple : 01 97 00 00 45.',
    phoneInvalid: 'Numéro invalide : saisissez par exemple 01 97 00 00 45.',
    submit: 'Rechercher',
    searching: 'Recherche…',
    found: 'Compte trouvé',
    noName: 'Nom non renseigné',
    open: 'Ouvrir le portefeuille',
    other: 'Chercher un autre numéro',
    elsewhere:
      'Vous pouvez aussi ouvrir un portefeuille depuis un paiement en ligne (colonne « Payeur »), une facture ou la fiche d’une entreprise.',
  },
  holder: {
    back: 'Portefeuilles',
    user: 'Portefeuille d’un particulier',
    organization: 'Portefeuille d’une entreprise',
    identifier: (id: string) => `Identifiant KSP : ${id}`,
    seeOrganization: 'Voir la fiche de l’entreprise',
    notFound: 'Ce portefeuille est introuvable.',
    prepaidTitle: 'Portefeuille prépayé',
    prepaidHint:
      'Rechargé par le client, il paie ses missions et ses factures. Il n’est jamais négatif et n’est jamais reversé.',
    balance: 'Solde',
    lastEntry: 'Dernière opération',
    noEntry: 'Aucune opération pour le moment',
    collectionsTitle: 'Fonds dus au créancier',
    collectionsHint:
      'Encaissements du Recouvrement pour ce titulaire, reversés par Mobile Money. Séparés du portefeuille prépayé.',
    available: 'Disponible',
    inProgress: 'Reversements en cours',
    collected: 'Total encaissé',
    paidOut: 'Total reversé',
  },
  statement: {
    title: 'Relevé',
    caption: 'Relevé du portefeuille',
    account: 'Compte',
    prepaid: 'Portefeuille prépayé',
    collections: 'Fonds dus au créancier',
    empty: 'Aucune opération sur ce compte.',
    date: 'Date',
    operation: 'Opération',
    amount: 'Montant',
    balanceAfter: 'Solde après',
    credit: (amount: string) => `+ ${amount}`,
    debit: (amount: string) => `− ${amount}`,
  },
  credit: {
    open: 'Créditer ou rembourser',
    title: 'Créditer le portefeuille prépayé',
    lead: 'Le montant est ajouté au portefeuille du client. Le motif apparaît dans son relevé.',
    kind: 'Type de crédit',
    refund: 'Remboursement',
    refundHint: 'Service non rendu, passage manqué, geste commercial.',
    topUp: 'Recharge reçue avec un écart de montant',
    topUpHint:
      'Le client a payé un autre montant que celui de sa recharge : rien n’a été crédité. Créditez le montant réellement reçu.',
    payment: 'Recharge concernée',
    paymentHint: 'Recharges de ce client restées en écart de montant.',
    paymentOption: (date: string, amount: string, reference: string | null) =>
      `${date} · ${amount} attendus${reference ? ` · réf. ${reference}` : ''}`,
    toReview: ' · écart pas encore traité',
    paymentsLoading: 'Lecture des recharges en écart…',
    noPayments:
      'Aucune recharge en écart trouvée pour ce client. Saisissez l’identifiant du paiement s’il vous a été transmis.',
    paymentsUnavailable:
      'La liste des recharges en écart n’a pas pu être lue. Saisissez l’identifiant du paiement (paiements en ligne).',
    paymentId: 'Identifiant du paiement',
    paymentRequired: 'Choisissez la recharge concernée.',
    amount: 'Montant à créditer (FCFA)',
    amountHint: 'Nombre entier, sans espace.',
    amountReceivedHint: 'Montant réellement reçu, en nombre entier.',
    invalidAmount: 'Saisissez un montant en FCFA, nombre entier supérieur à 0.',
    reason: 'Motif',
    reasonHint: 'Obligatoire, 200 caractères au plus. Visible par le client dans son relevé.',
    reasonRequired: 'Indiquez le motif.',
    review: 'Vérifier',
    cancel: 'Annuler',
    reviewTitle: 'Confirmer le crédit',
    reviewLead:
      'Vérifiez avant d’envoyer : une fois enregistré, ce crédit ne peut être ni modifié ni annulé.',
    holder: 'Titulaire',
    back: 'Modifier',
    confirm: (amount: string) => `Créditer ${amount}`,
    pending: 'Envoi…',
    done: (amount: string, balance: string) =>
      `${amount} crédités sur le portefeuille. Nouveau solde : ${balance}.`,
    already: (balance: string) =>
      `Ce crédit avait déjà été enregistré : rien n’a été ajouté. Solde : ${balance}.`,
    reusedTopUp:
      'Cette recharge a déjà été créditée (automatiquement ou par la finance) : rien n’a été ajouté.',
    reused:
      'Un crédit a déjà été enregistré avec cette demande. Fermez la fenêtre et vérifiez le relevé avant de recommencer.',
  },
} as const;
