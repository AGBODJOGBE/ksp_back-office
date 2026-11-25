import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { ADMIN, draftRule, rule, simulation, staff, uuid } from '@/features/recovery/fixtures.test-utils';
import { NewRule, RuleDetail } from './rule-detail';
import { RulesList } from './rules-list';

vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/recouvrement/tarification',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  push.mockReset();
  session.set(sessionBody(['recovery_admin']));
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });
const DRAFT = uuid('a002');
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const confirm = (open: string, title: string, button = open) => {
  fireEvent.click(screen.getByRole('button', { name: open }));
  const dialog = screen.getByRole('dialog', { name: title });
  fireEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
};

describe('liste des règles', () => {
  it('filtres lus dans l’adresse, fiches liées, création réservée à l’administration', async () => {
    search = 'objet=recovery_commission&etat=inconnu';
    const { calls } = stubGateway({
      [`GET ${ADMIN}/pricing-rules`]: ok({ rules: [rule()], nextCursor: null }),
    });
    render(<RulesList />);
    expect(await screen.findByRole('link', { name: 'Commission B2B par tranches' })).toHaveAttribute(
      'href',
      `/recouvrement/tarification/${uuid('a001')}`,
    );
    expect(calls[0]?.search).toBe('?limit=20&object=recovery_commission');
    expect(screen.getByRole('link', { name: 'Nouvelle règle' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'draft' } });
    expect(replace).toHaveBeenCalledWith('/recouvrement/tarification?objet=recovery_commission&etat=draft');
  });

  it('finance : lecture seule', async () => {
    session.set(sessionBody(['finance_officer']));
    stubGateway({ [`GET ${ADMIN}/pricing-rules`]: ok({ rules: [], nextCursor: null }) });
    render(<RulesList />);
    expect(await screen.findByText('Aucune règle pour ces critères.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nouvelle règle' })).not.toBeInTheDocument();
  });
});

describe('cycle d’une règle', () => {
  it('nouvelle règle par tranches : explication en clair, contrôles, brouillon créé avec une clé', async () => {
    const { calls } = stubGateway({ [`POST ${ADMIN}/pricing-rules`]: ok(draftRule()) });
    render(<NewRule />);
    type('Libellé', 'Commission progressive');
    fireEvent.change(screen.getByLabelText('Calcul'), { target: { value: 'tiered' } });
    expect(
      screen.getByText(/chaque part du cumul encaissé est prise au taux de sa tranche/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une tranche' }));
    fireEvent.change(document.getElementById('tranche-0-borne') as HTMLElement, {
      target: { value: '1000000' },
    });
    fireEvent.change(document.getElementById('tranche-0-valeur') as HTMLElement, { target: { value: '15' } });
    fireEvent.change(document.getElementById('tranche-1-valeur') as HTMLElement, { target: { value: '10' } });
    expect(
      screen.getByText(/Part du cumul de 0\s+F\s?CFA à 1\s000\s000\s+F\s?CFA : 15 %\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Part du cumul au-delà de 1\s000\s000\s+F\s?CFA : 10 %\./)).toBeInTheDocument();
    expect(screen.getByText(/Le minimum vaut pour le cumul du dossier/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le brouillon' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/recouvrement/tarification/${DRAFT}`));
    expect(calls[0]?.headers['Idempotency-Key']).toBeTruthy();
    expect(calls[0]?.body).toMatchObject({
      object: 'recovery_commission',
      mode: 'tiered',
      tiers: [
        { upTo: { amount: 1000000, currency: 'XOF' }, rateBps: 1500 },
        { upTo: null, rateBps: 1000 },
      ],
      label: 'Commission progressive',
    });
  });

  it('brouillon : simulation avant publication, puis publication confirmée', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok(draftRule()),
      [`POST ${ADMIN}/pricing-simulations`]: ok(simulation),
      [`POST ${ADMIN}/pricing-rules/${DRAFT}/publish`]: ok(rule({ id: DRAFT, label: 'Brouillon TEST' })),
    });
    render(<RuleDetail id={DRAFT} />);
    const simulator = await screen.findByRole('region', { name: 'Simuler avant de publier' });
    fireEvent.change(within(simulator).getByLabelText('Montant de base (F CFA)'), {
      target: { value: '1100000' },
    });
    fireEvent.change(within(simulator).getByLabelText('Étape atteinte'), {
      target: { value: 'formal_notice' },
    });
    fireEvent.click(within(simulator).getByRole('button', { name: 'Simuler' }));
    expect(await within(simulator).findByText('Reversé au créancier')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('pricing-simulations'))?.body).toEqual({
      ruleId: DRAFT,
      object: 'recovery_commission',
      target: { offer: 'b2b', communeKey: null, creditor: null },
      baseAmount: { amount: 1100000, currency: 'XOF' },
      stage: 'formal_notice',
    });
    expect(screen.getByRole('region', { name: 'Modifier le brouillon' })).toBeInTheDocument();
    confirm('Publier', 'Publier cette règle ?');
    expect(await screen.findByText('Règle publiée.')).toBeInTheDocument();
    expect(screen.getByText('Publiée')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Modifier le brouillon' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer une nouvelle version' })).toHaveAttribute(
      'href',
      `/recouvrement/tarification/nouvelle?version-de=${DRAFT}`,
    );
  });

  it('brouillon modifié : corps complet du contrat, sans clé, message de réussite', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok(draftRule()),
      [`PUT ${ADMIN}/pricing-rules/${DRAFT}`]: (body) =>
        ok(draftRule({ label: (body as { label: string }).label })),
    });
    render(<RuleDetail id={DRAFT} />);
    const editor = await screen.findByRole('region', { name: 'Modifier le brouillon' });
    fireEvent.change(within(editor).getByLabelText('Libellé'), { target: { value: 'Commission révisée' } });
    fireEvent.change(within(editor).getByLabelText('Maximum (F CFA)'), { target: { value: '1000' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await within(editor).findByText('Corrigez les champs signalés.')).toBeInTheDocument();
    expect(within(editor).getByText('Le minimum dépasse le maximum.')).toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText('Maximum (F CFA)'), { target: { value: '' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await within(editor).findByText('Brouillon enregistré.')).toBeInTheDocument();
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.headers['Idempotency-Key']).toBeUndefined();
    expect(put?.body).toEqual({
      object: 'recovery_commission',
      mode: 'tiered',
      tiers: [
        { upTo: { amount: 1000000, currency: 'XOF' }, rateBps: 1500 },
        { upTo: null, rateBps: 1000 },
      ],
      minimum: { amount: 5000, currency: 'XOF' },
      target: { offer: 'b2b', communeKey: null, creditor: null },
      // Jour inchangé : l'instant enregistré est renvoyé tel quel.
      validFrom: '2026-12-01T00:00:00Z',
      label: 'Commission révisée',
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Commission révisée');
  });

  it('publication refusée : points à corriger lisibles dans la boîte', async () => {
    stubGateway({
      [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok(draftRule()),
      [`POST ${ADMIN}/pricing-rules/${DRAFT}/publish`]: {
        status: 412,
        body: errorBody('RECOVERY_PRICING_RULE_INVALID', 'Cette règle tarifaire est incomplète.', {
          violations: ['la dernière tranche est sans limite'],
        }),
      },
    });
    render(<RuleDetail id={DRAFT} />);
    await screen.findByRole('region', { name: 'Décisions' });
    const dialog = confirm('Publier', 'Publier cette règle ?');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cette règle tarifaire est incomplète. À corriger : la dernière tranche est sans limite.',
    );
  });

  it('tarif négocié : la publication l’envoie à la validation d’une autre personne', async () => {
    const negotiated = {
      target: { offer: 'b2b', communeKey: null, creditor: { type: 'organization', id: uuid('0a01') } },
    };
    stubGateway({
      [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok(draftRule(negotiated)),
      [`POST ${ADMIN}/pricing-rules/${DRAFT}/publish`]: ok(
        draftRule({ ...negotiated, status: 'pending_approval' }),
      ),
    });
    render(<RuleDetail id={DRAFT} />);
    await screen.findByRole('region', { name: 'Décisions' });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    expect(
      screen.getByText(/ne sera publiée qu’après la validation d’une autre personne/),
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publier' }));
    expect(
      await screen.findByText('Règle envoyée à la validation d’une autre personne.'),
    ).toBeInTheDocument();
    expect(screen.getByText('À valider')).toBeInTheDocument();
    // L'auteur (une autre personne ici) n'est pas la session : la validation est proposée.
    expect(screen.getByRole('button', { name: 'Valider et publier' })).toBeInTheDocument();
  });

  it('validation : masquée pour l’auteur, refus de la gateway lisible sinon', async () => {
    const pending = draftRule({ status: 'pending_approval', createdBy: staff(TEST_USER.id, 'Koffi Adjovi') });
    stubGateway({ [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok(pending) });
    const { unmount } = render(<RuleDetail id={DRAFT} />);
    expect(
      await screen.findByText('Vous avez créé cette règle : sa validation revient à une autre personne.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument();
    unmount();

    stubGateway({
      [`GET ${ADMIN}/pricing-rules/${DRAFT}`]: ok({ ...pending, createdBy: staff(uuid('9e77'), 'Autre') }),
      [`POST ${ADMIN}/pricing-rules/${DRAFT}/approve`]: {
        status: 403,
        body: errorBody(
          'RECOVERY_APPROVAL_BY_REQUESTER',
          'Un tarif négocié est validé par une deuxième personne',
        ),
      },
    });
    render(<RuleDetail id={DRAFT} />);
    await screen.findByRole('region', { name: 'Décisions' });
    const dialog = confirm('Valider et publier', 'Valider ce tarif négocié ?');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'sa validation revient à une autre personne',
    );
  });

  it('archivage : motif obligatoire (3 à 500 caractères), puis règle archivée', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/pricing-rules/${uuid('a001')}`]: ok(rule()),
      [`POST ${ADMIN}/pricing-rules/${uuid('a001')}/archive`]: ok(rule({ status: 'archived' })),
    });
    render(<RuleDetail id={uuid('a001')} />);
    await screen.findByRole('region', { name: 'Décisions' });
    fireEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    const dialog = screen.getByRole('dialog', { name: 'Archiver cette règle ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiver' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Entre 3 et 500 caractères.');
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Grille 2027 publiée.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Règle archivée.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ reason: 'Grille 2027 publiée.' });
    expect(screen.getByText('Règle archivée : plus aucune décision possible.')).toBeInTheDocument();
  });

  it('finance : fiche et simulateur en lecture, aucune décision', async () => {
    session.set(sessionBody(['finance_officer']));
    stubGateway({ [`GET ${ADMIN}/pricing-rules/${uuid('a001')}`]: ok(rule()) });
    render(<RuleDetail id={uuid('a001')} />);
    expect(await screen.findByText(/la tarification est réglée par l’administration/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Simuler cette règle' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archiver' })).not.toBeInTheDocument();
    expect(screen.getByText(/Part du cumul au-delà de 1\s000\s000/)).toBeInTheDocument();
  });
});
