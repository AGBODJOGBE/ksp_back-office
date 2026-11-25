import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  adminCase,
  CASE_ID,
  journalEntry,
  journalPage,
  recoveryCase,
} from '@/features/recovery/case-fixtures.test-utils';
import { ADMIN, OTHER, overview, staff } from '@/features/recovery/fixtures.test-utils';
import { CaseDetail } from './case-detail';

beforeEach(() => session.set(sessionBody(['recovery_supervisor'])));
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });
const CASE = `${ADMIN}/cases/${CASE_ID}`;

const confirm = (open: string, title: string, button = open) => {
  fireEvent.click(screen.getByRole('button', { name: open }));
  const dialog = screen.getByRole('dialog', { name: title });
  fireEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
};

describe('fiche dossier', () => {
  it('étapes dans l’ordre du métier, synthèse, montants, débiteur, journal paginé', async () => {
    const { calls } = stubGateway({
      [`GET ${CASE}`]: ok(adminCase()),
      [`GET ${CASE}/journal`]: [
        ok(journalPage([journalEntry('01')], 'j2')),
        ok(journalPage([journalEntry('02', { kind: 'note', internal: true, summary: 'Note TEST' })])),
      ],
    });
    render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Dossier RC-2026-0001');
    const steps = screen.getByRole('navigation', { name: 'Étapes du dossier' });
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '1. Recevabilitéterminée',
      '2. Notificationen cours',
      '3. Échéancierà venir',
      '4. Relance amiableà venir',
      '5. Contentieux (bientôt)à venir',
    ]);
    expect(within(steps).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('10 % à l’amiable')).toBeInTheDocument();
    expect(screen.getByText('+2290197000099')).toBeInTheDocument();
    expect(screen.getByText('Facture impayée')).toBeInTheDocument();
    expect(await screen.findByText('Appel TEST 01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(await screen.findByText('Note TEST')).toBeInTheDocument();
    expect(screen.getByText('Note interne')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === `${CASE}/journal`).map((call) => call.search)).toEqual([
      '?limit=20',
      '?limit=20&cursor=j2',
    ]);
    // Aucune donnée du débiteur dans les adresses appelées.
    expect(calls.every((call) => !`${call.path}${call.search}`.includes('2290197000099'))).toBe(true);
  });

  it('recevabilité : accepter avec un chargé du tableau de bord, clé d’idempotence, fiche relue', async () => {
    const review = adminCase({ status: 'under_review', stage: null, assignedAgent: null, score: null });
    const { calls } = stubGateway({
      [`GET ${CASE}`]: [ok(review), ok(adminCase())],
      [`GET ${CASE}/journal`]: ok(journalPage([])),
      [`GET ${ADMIN}/overview`]: ok(overview),
      [`POST ${CASE}/assessment`]: ok(recoveryCase()),
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('heading', { name: 'Recevabilité' });
    expect(screen.getByText('Calculé à l’examen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer recevable' }));
    const dialog = screen.getByRole('dialog', { name: 'Déclarer le dossier recevable' });
    fireEvent.change(await within(dialog).findByLabelText('Chargé (facultatif)'), {
      target: { value: overview.agents[0]?.agent.userId },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Déclarer recevable' }));
    expect(await screen.findByText('Dossier déclaré recevable.')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({ decision: 'accept', agentUserId: overview.agents[0]?.agent.userId });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    await waitFor(() => expect(calls.filter((call) => call.path === CASE)).toHaveLength(2));
  });

  it('recevabilité : refus motivé, complément demandé ; erreur métier lisible', async () => {
    const review = adminCase({ status: 'under_review', stage: null });
    const { calls } = stubGateway({
      [`GET ${CASE}`]: ok(review),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
      [`POST ${CASE}/assessment`]: [
        { status: 409, body: errorBody('RECOVERY_INVALID_TRANSITION', 'Ce dossier a déjà été examiné.') },
        ok(recoveryCase({ status: 'info_requested' })),
      ],
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Déclarer irrecevable' });
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer irrecevable' }));
    const reject = screen.getByRole('dialog', { name: 'Déclarer le dossier irrecevable' });
    fireEvent.change(within(reject).getByLabelText('Motif du refus'), { target: { value: 'prescribed' } });
    fireEvent.change(within(reject).getByLabelText('Motif transmis au créancier'), {
      target: { value: 'Prescrite.' },
    });
    fireEvent.click(within(reject).getByRole('button', { name: 'Déclarer irrecevable' }));
    expect(await within(reject).findByRole('alert')).toHaveTextContent('Ce dossier a déjà été examiné.');
    expect(calls.at(-1)?.body).toEqual({
      decision: 'reject',
      rejectionReason: 'prescribed',
      note: 'Prescrite.',
    });

    confirm('Demander un complément', 'Demander un complément au créancier');
    expect(await screen.findByText('Complément demandé au créancier.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST').at(-1)?.body).toEqual({ decision: 'request_info' });
  });

  it('affectation : identifiant saisi contrôlé, puis envoyé sans clé d’idempotence', async () => {
    const { calls } = stubGateway({
      [`GET ${CASE}`]: ok(adminCase()),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
      [`GET ${ADMIN}/overview`]: ok({ ...overview, agents: [] }),
      [`POST ${CASE}/assign`]: ok(recoveryCase({ assignedAgent: staff(OTHER, 'Nouveau chargé TEST') })),
    });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('button', { name: 'Changer de chargé' });
    fireEvent.click(screen.getByRole('button', { name: 'Changer de chargé' }));
    const dialog = screen.getByRole('dialog', { name: 'Affecter le dossier à un chargé' });
    const input = await within(dialog).findByLabelText('Identifiant du chargé');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Affecter à un chargé' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('identifiant valide');
    fireEvent.change(input, { target: { value: OTHER } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Affecter à un chargé' }));
    expect(await screen.findByText('Dossier affecté à Nouveau chargé TEST.')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({ agentUserId: OTHER });
    expect(post?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('droits : un chargé ne décide ni la recevabilité ni l’affectation ; la finance ne suit pas le débiteur', async () => {
    session.set(sessionBody(['recovery_agent']));
    stubGateway({
      [`GET ${CASE}`]: ok(adminCase({ status: 'under_review', stage: null })),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
    });
    const { unmount } = render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByText(/La décision de recevabilité revient au superviseur/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Déclarer recevable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chargé/ })).not.toBeInTheDocument();
    unmount();

    session.set(sessionBody(['finance_officer']));
    stubGateway({ [`GET ${CASE}`]: ok(adminCase()), [`GET ${CASE}/journal`]: ok(journalPage([])) });
    render(<CaseDetail id={CASE_ID} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Enregistrer un contact' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saisir un paiement hors ligne' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Factures de commission de ce créancier' })).toHaveAttribute(
      'href',
      `/recouvrement/factures?creancier=${recoveryCase().creditor.id}`,
    );
  });

  it('contentieux : « bientôt », sans aucun bouton du contentieux ; dossier introuvable', async () => {
    stubGateway({
      [`GET ${CASE}`]: ok(adminCase({ stage: 'formal_notice' })),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
    });
    const { unmount } = render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByRole('heading', { name: 'Contentieux : bientôt' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mise en demeure|huissier|Clôturer|Exporter/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Changer d’étape' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Proposer un échéancier' })).not.toBeInTheDocument();
    unmount();

    stubGateway({ [`GET ${CASE}`]: { status: 404, body: errorBody('RECOVERY_NOT_FOUND', 'Introuvable.') } });
    render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
  });
});
