import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, type GatewayCall, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  adminCase,
  CASE_ID,
  DEBTOR_ID,
  journalEntry,
  journalPage,
  plan,
  recoveryCase,
} from '@/features/recovery/case-fixtures.test-utils';
import { ADMIN, uuid } from '@/features/recovery/fixtures.test-utils';
import { CaseDetail } from './case-detail';

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });
const CASE = `${ADMIN}/cases/${CASE_ID}`;

/** Ouvre la boîte, remplit les champs (libellé → valeur), confirme ; renvoie la boîte. */
function act(open: string, title: string, values: Record<string, string> = {}, button = open) {
  fireEvent.click(screen.getByRole('button', { name: open }));
  const dialog = screen.getByRole('dialog', { name: title });
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

function gateway(routes: Record<string, unknown>, detail = adminCase()) {
  return stubGateway({
    [`GET ${CASE}`]: ok(detail),
    [`GET ${CASE}/journal`]: ok(journalPage([])),
    ...(routes as Record<string, { status: number; body: unknown }>),
  });
}

const posts = (calls: GatewayCall[], suffix: string) =>
  calls.filter((call) => call.method === 'POST' && call.path.endsWith(suffix));

describe('suivi du débiteur (chargé)', () => {
  beforeEach(() => session.set(sessionBody(['recovery_agent'])));

  it('contact, promesse, message et note : corps du contrat, idempotence quand elle est prévue', async () => {
    const { calls } = gateway({
      [`POST ${CASE}/contacts`]: ok(journalEntry('10')),
      [`POST ${CASE}/promises`]: ok({
        id: uuid('p001'),
        amount: xof(50000),
        dueDate: '2026-12-15',
        status: 'pending',
        recordedBy: { type: 'staff', userId: null, displayName: null },
        createdAt: '2026-11-25T10:00:00Z',
      }),
      [`POST ${CASE}/messages`]: ok(journalEntry('11', { kind: 'message_sent', deliveryStatus: 'sent' })),
      [`POST ${CASE}/notes`]: ok(journalEntry('12', { kind: 'note', internal: true })),
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Enregistrer un contact' });

    act(
      'Enregistrer un contact',
      'Enregistrer un contact avec le débiteur',
      {
        Issue: 'callback_requested',
        'Date et heure du contact': '2026-11-25T09:30',
        'Rappel promis (facultatif)': '2026-11-26T10:00',
      },
      'Enregistrer',
    );
    expect(await screen.findByText('Contact enregistré au journal.')).toBeInTheDocument();
    const contact = posts(calls, '/contacts')[0];
    expect(contact?.body).toEqual({
      debtorId: DEBTOR_ID,
      channel: 'phone',
      direction: 'outbound',
      outcome: 'callback_requested',
      occurredAt: '2026-11-25T08:30:00.000Z',
      callbackAt: '2026-11-26T09:00:00.000Z',
    });
    expect(contact?.headers['Idempotency-Key']).toBeTruthy();

    const promise = act(
      'Enregistrer une promesse',
      'Enregistrer une promesse de paiement',
      {
        'Montant promis (F CFA)': '50 000,5',
        'Pour le': '2026-12-15',
      },
      'Enregistrer',
    );
    expect(await within(promise).findByText(/sans décimales/)).toBeInTheDocument();
    fireEvent.change(within(promise).getByLabelText('Montant promis (F CFA)'), {
      target: { value: '50 000' },
    });
    fireEvent.click(within(promise).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Promesse enregistrée.')).toBeInTheDocument();
    expect(posts(calls, '/promises')[0]?.body).toEqual({ amount: xof(50000), dueDate: '2026-12-15' });

    act('Envoyer un message', 'Envoyer un message au débiteur', { Modèle: 'payment_link', Canal: 'sms' });
    expect(await screen.findByText(/Message envoyé/)).toBeInTheDocument();
    expect(posts(calls, '/messages')[0]?.body).toEqual({
      debtorId: DEBTOR_ID,
      template: 'payment_link',
      channel: 'sms',
    });

    act(
      'Ajouter une note interne',
      'Ajouter une note interne',
      { Note: 'Débiteur joignable le soir.' },
      'Enregistrer',
    );
    expect(await screen.findByText('Note ajoutée au journal.')).toBeInTheDocument();
    const note = posts(calls, '/notes')[0];
    expect(note?.body).toEqual({ text: 'Débiteur joignable le soir.' });
    expect(note?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('contact hors des plages autorisées : refus lisible, clé gardée pour un nouvel essai', async () => {
    const { calls } = gateway({
      [`POST ${CASE}/contacts`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        { status: 422, body: errorBody('RECOVERY_CONTACT_OUTSIDE_HOURS', 'Hors des plages de contact.') },
      ],
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Enregistrer un contact' });
    const dialog = act(
      'Enregistrer un contact',
      'Enregistrer un contact avec le débiteur',
      {},
      'Enregistrer',
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Service indisponible.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /Hors des plages de contact\. Les contacts manuels/,
    );
    const [first, second] = posts(calls, '/contacts');
    expect(first?.headers['Idempotency-Key']).toBe(second?.headers['Idempotency-Key']);
  });

  it('échéancier dans le barème : estimation, envoi, réponse du service', async () => {
    const { calls } = gateway({ [`POST ${CASE}/payment-plans`]: ok(plan()) });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Proposer un échéancier' });
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un échéancier' }));
    const dialog = screen.getByRole('dialog', { name: 'Proposer un échéancier' });
    fireEvent.change(within(dialog).getByLabelText('Premier versement (F CFA)'), {
      target: { value: '100000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Date du premier versement'), {
      target: { value: '2099-01-01' },
    });
    fireEvent.change(within(dialog).getByLabelText('Nombre d’échéances après le premier versement'), {
      target: { value: '2' },
    });
    const estimate = within(dialog).getByRole('region', { name: 'Estimation avant envoi (indicative)' });
    expect(within(estimate).getByText(/Reste à étaler : 300\s000/)).toBeInTheDocument();
    expect(within(estimate).getByText(/Environ 150\s000/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Proposer un échéancier' }));
    expect(await screen.findByText(/dans le barème : envoyé à la signature/)).toBeInTheDocument();
    const post = posts(calls, '/payment-plans')[0];
    expect(post?.body).toEqual({
      terms: {
        firstAmount: xof(100000),
        firstDueDate: '2099-01-01',
        rhythm: 'monthly',
        installmentsCount: 2,
      },
    });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('échéancier hors barème : la validation n’est pas proposée au chargé', async () => {
    gateway({}, adminCase({ currentPlan: plan({ withinScale: false, violations: ['duration'] }) }));
    render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByText('Hors barème')).toBeInTheDocument();
    expect(screen.getByText('Durée au-delà du barème')).toBeInTheDocument();
    expect(screen.getByText(/sa validation revient au superviseur/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Valider l’échéancier hors barème' }),
    ).not.toBeInTheDocument();
  });

  it('remise : sous le reste dû, taux affiché face au barème', async () => {
    const { calls } = gateway({
      [`POST ${CASE}/settlements`]: ok({
        id: uuid('5001'),
        payNow: xof(340000),
        waived: xof(60000),
        discountBps: 1500,
        validUntil: '2026-12-10T22:59:00Z',
        status: 'proposed',
      }),
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Proposer une remise' });
    fireEvent.click(screen.getByRole('button', { name: 'Proposer une remise' }));
    const dialog = screen.getByRole('dialog', { name: 'Proposer une remise au débiteur' });
    fireEvent.change(within(dialog).getByLabelText(/À payer tout de suite/), { target: { value: '400000' } });
    fireEvent.change(within(dialog).getByLabelText('Offre valable jusqu’au'), {
      target: { value: '2026-12-10' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Proposer une remise' }));
    expect(await within(dialog).findByText(/inférieur au reste dû/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/À payer tout de suite/), { target: { value: '340000' } });
    expect(within(dialog).getByText('Remise de 15 % (maximum du barème : 20 %).')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Proposer une remise' }));
    expect(await screen.findByText('Remise enregistrée : proposée au débiteur.')).toBeInTheDocument();
    expect(posts(calls, '/settlements')[0]?.body).toEqual({
      payNow: xof(340000),
      validUntil: '2026-12-10T23:59:00+01:00',
    });
  });
});

describe('décisions (superviseur, juriste)', () => {
  it('superviseur : valide un échéancier hors barème proposé par un autre', async () => {
    session.set(sessionBody(['recovery_supervisor']));
    const outside = plan({ withinScale: false, violations: ['first_payment'] });
    const { calls } = gateway(
      {
        [`POST ${ADMIN}/payment-plans/${uuid('b001')}/approval`]: ok({
          ...outside,
          status: 'pending_creditor',
        }),
      },
      adminCase({ currentPlan: outside }),
    );
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Valider l’échéancier hors barème' });
    act('Valider l’échéancier hors barème', 'Valider l’échéancier hors barème');
    expect(await screen.findByText('Échéancier validé : transmis au créancier.')).toBeInTheDocument();
    expect(posts(calls, '/approval')[0]?.body).toEqual({ decision: 'approve' });
  });

  it('changer d’étape : étapes amiables suivantes seulement, motif exigé, saut refusé lisible', async () => {
    session.set(sessionBody(['recovery_supervisor']));
    const { calls } = gateway({
      [`POST ${CASE}/stage`]: [
        {
          status: 422,
          body: errorBody('RECOVERY_STAGE_SKIP_NOT_ALLOWED', 'Pas de saut d’étape sans accord du créancier.'),
        },
        ok(recoveryCase({ stage: 'payment_plan' })),
      ],
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Changer d’étape' });
    fireEvent.click(screen.getByRole('button', { name: 'Changer d’étape' }));
    const dialog = screen.getByRole('dialog', { name: 'Changer l’étape du dossier' });
    const options = within(dialog)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Échéancier', 'Relance amiable']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Changer d’étape' }));
    expect(await within(dialog).findByText(/motif de 3 à 1 000/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Sans réponse.' } });
    fireEvent.change(within(dialog).getByLabelText('Nouvelle étape'), { target: { value: 'amicable' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Changer d’étape' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Pas de saut d’étape');
    fireEvent.change(within(dialog).getByLabelText('Nouvelle étape'), { target: { value: 'payment_plan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Changer d’étape' }));
    expect(await screen.findByText('Dossier passé à l’étape « Échéancier ».')).toBeInTheDocument();
    expect(posts(calls, '/stage').at(-1)?.body).toEqual({ toStage: 'payment_plan', reason: 'Sans réponse.' });
  });

  it('juriste : tranche une contestation avec un montant corrigé', async () => {
    session.set(sessionBody(['legal_officer']));
    const dispute = {
      id: uuid('d901'),
      reason: 'wrong_amount',
      text: 'Le montant est faux.',
      fileIds: [],
      status: 'creditor_answered',
      openedAt: '2026-11-20T10:00:00Z',
      creditorAnswerDueAt: '2026-11-30T10:00:00Z',
      creditorAnswer: 'Une facture a été réglée.',
      creditorFileIds: [],
      resolutionNote: null,
      resolvedAt: null,
    };
    const { calls } = gateway(
      { [`POST ${CASE}/disputes/${uuid('d901')}/resolution`]: ok(recoveryCase()) },
      adminCase({ status: 'suspended', disputes: [dispute] }),
    );
    render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByText('À trancher')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trancher la contestation' }));
    const dialog = screen.getByRole('dialog', { name: 'Trancher la contestation' });
    fireEvent.change(within(dialog).getByLabelText('Décision'), { target: { value: 'correct_amount' } });
    fireEvent.change(within(dialog).getByLabelText('Motif de la décision'), {
      target: { value: 'Facture réglée.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trancher la contestation' }));
    expect(await within(dialog).findByText(/montant dû corrigé/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Montant dû corrigé (F CFA)'), {
      target: { value: '250000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trancher la contestation' }));
    expect(await screen.findByText('Contestation tranchée.')).toBeInTheDocument();
    expect(posts(calls, '/resolution')[0]?.body).toEqual({
      resolution: 'correct_amount',
      note: 'Facture réglée.',
      correctedDue: xof(250000),
    });
  });
});
