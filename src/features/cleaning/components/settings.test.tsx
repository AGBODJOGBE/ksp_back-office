import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  errorBody,
  ids,
  ok,
  page,
  settings,
  stubGateway,
  xof,
  zone,
} from '@/features/cleaning/fake-gateway.test-utils';
import { HolidaysScreen } from './holidays';
import { SettingsScreen } from './settings';
import { ZonesScreen } from './zones';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/reglages',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

describe('réglages du module', () => {
  it('envoie seulement les réglages modifiés ; refus croisé du serveur affiché', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/settings`]: ok(settings()),
      [`PATCH ${ADMIN}/settings`]: [
        {
          status: 400,
          body: errorBody('CLEANING_VALIDATION_FAILED', 'Cette valeur est hors des bornes autorisées.', {
            field: 'unpaidInvoicesSuspension',
            reason: 'out_of_range',
          }),
        },
        ok(settings({ quoteValidityDays: 20, unpaidInvoicesSuspension: 3 })),
      ],
    });
    render(<SettingsScreen />);
    const validity = await screen.findByLabelText('Validité d’un devis (jours)');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Aucune modification à enregistrer.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);

    fireEvent.change(validity, { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Factures impayées avant suspension'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Cette valeur est hors des bornes autorisées.')).toBeInTheDocument();
    expect(screen.getByLabelText('Factures impayées avant suspension')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      quoteValidityDays: 20,
      unpaidInvoicesSuspension: 1,
    });

    fireEvent.change(screen.getByLabelText('Factures impayées avant suspension'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
  });

  it('bornes du contrat contrôlées avant l’envoi ; total des poids affiché', async () => {
    const { calls } = stubGateway({ [`GET ${ADMIN}/settings`]: ok(settings()) });
    render(<SettingsScreen />);
    const lead = await screen.findByLabelText('Délai minimum avant une visite (h)');
    fireEvent.change(lead, { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Continuité'), { target: { value: '50' } });
    expect(screen.getByText('Total : 110 sur 100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Entre 0 et 168.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });

  it('superviseur : lecture seule ; montants masqués sans la permission', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    const { defaultVisitFee: _hidden, ...withoutAmounts } = settings();
    stubGateway({ [`GET ${ADMIN}/settings`]: ok(withoutAmounts) });
    render(<SettingsScreen />);
    expect(await screen.findByText(/Lecture seule/)).toBeInTheDocument();
    expect(screen.getByLabelText('Validité d’un devis (jours)')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Enregistrer les réglages' })).not.toBeInTheDocument();
    expect(screen.getByText('Votre compte ne voit pas les montants du Nettoyage.')).toBeInTheDocument();
  });
});

describe('zones desservies', () => {
  const communes = {
    status: 200,
    body: {
      data: [
        { communeKey: 'cotonou', name: 'Cotonou', zoneId: ids.zone, zoneActive: true },
        { communeKey: 'abomey-calavi', name: 'Abomey-Calavi', zoneId: null, zoneActive: false },
      ],
    },
  };

  it('ouvrir une commune du référentiel (clé d’idempotence) ; coefficient saisi en multiplicateur', async () => {
    const opened = zone({
      id: ids.holiday,
      communeKey: 'abomey-calavi',
      name: 'Abomey-Calavi',
      coefficientBps: 11500,
    });
    const { calls } = stubGateway({
      [`GET ${ADMIN}/zones`]: page([zone()]),
      [`GET ${ADMIN}/communes`]: communes,
      [`POST ${ADMIN}/zones`]: ok(opened),
    });
    render(<ZonesScreen />);
    const commune = await screen.findByLabelText(/^Commune/, { selector: '#zone-commune' });
    expect(
      within(commune)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choisissez une commune', 'Abomey-Calavi']);
    fireEvent.change(commune, { target: { value: 'abomey-calavi' } });
    fireEvent.change(screen.getByLabelText('Coefficient de commune', { selector: '#zone-coefficient' }), {
      target: { value: '1,15' },
    });
    fireEvent.change(
      screen.getByLabelText('Majoration des frais de visite (FCFA)', { selector: '#zone-majoration' }),
      { target: { value: '1 000' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir une commune' }));
    expect(await screen.findByText('Zone Abomey-Calavi ouverte.')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      coefficientBps: 11500,
      visitFeeSurcharge: xof(1000),
      communeKey: 'abomey-calavi',
    });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    expect(screen.getByText('× 1,15')).toBeInTheDocument();
  });

  it('désactiver une zone qui a des dossiers en cours : confirmation envoyée, puis réactivation', async () => {
    const busy = zone({ openRequests: 2, activePrograms: 1 });
    const { calls } = stubGateway({
      [`GET ${ADMIN}/zones`]: page([busy]),
      [`GET ${ADMIN}/communes`]: communes,
      [`POST ${ADMIN}/zones/${ids.zone}/activation`]: [
        ok(zone({ active: false, openRequests: 2, activePrograms: 1 })),
        ok(zone()),
      ],
    });
    render(<ZonesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver Cotonou' }));
    const dialog = screen.getByRole('dialog', { name: 'Désactiver la zone Cotonou ?' });
    expect(dialog).toHaveTextContent('2 demande(s) ouverte(s) et 1 programme(s) actif(s)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }));
    expect(await screen.findByRole('button', { name: 'Réactiver Cotonou' })).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ active: false, confirm: true });

    fireEvent.click(screen.getByRole('button', { name: 'Réactiver Cotonou' }));
    expect(await screen.findByRole('button', { name: 'Désactiver Cotonou' })).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts[1]?.body).toEqual({ active: true });
    expect(posts[1]?.headers['Idempotency-Key']).not.toBe(posts[0]?.headers['Idempotency-Key']);
  });

  it('activité apparue entre-temps (409) : nombres affichés, le nouvel essai confirme', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/zones`]: page([zone()]),
      [`GET ${ADMIN}/communes`]: communes,
      [`POST ${ADMIN}/zones/${ids.zone}/activation`]: [
        {
          status: 409,
          body: errorBody(
            'CLEANING_ZONE_HAS_ACTIVITY',
            'Cette zone a des dossiers en cours : confirmez la désactivation.',
            {
              openRequests: 1,
              activePrograms: 0,
            },
          ),
        },
        ok(zone({ active: false })),
      ],
    });
    render(<ZonesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver Cotonou' }));
    const dialog = screen.getByRole('dialog', { name: 'Désactiver la zone Cotonou ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('1 demande(s) ouverte(s)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2));
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts[0]?.body).toEqual({ active: false });
    expect(posts[1]?.body).toEqual({ active: false, confirm: true });
  });

  it('superviseur : zones en lecture, ni ouverture ni action', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({ [`GET ${ADMIN}/zones`]: page([zone()]) });
    render(<ZonesScreen />);
    expect(await screen.findByText('Cotonou')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ouvrir une commune' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Désactiver/ })).not.toBeInTheDocument();
  });
});

describe('jours fériés', () => {
  it('année dans l’adresse, ajout puis retrait confirmé', async () => {
    search = 'annee=2026';
    const holiday = { id: ids.holiday, date: '2026-08-01', name: 'Fête de l’indépendance' };
    const { calls } = stubGateway({
      [`GET ${ADMIN}/holidays`]: page([]),
      [`POST ${ADMIN}/holidays`]: ok(holiday),
      [`DELETE ${ADMIN}/holidays/${ids.holiday}`]: { status: 204 },
    });
    render(<HolidaysScreen />);
    expect(await screen.findByText('Aucun jour férié enregistré pour 2026.')).toBeInTheDocument();
    expect(calls[0]?.search).toBe('?limit=20&year=2026');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Fête de l’indépendance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un jour férié' }));
    expect(await screen.findByRole('cell', { name: 'Fête de l’indépendance' })).toBeInTheDocument();
    expect(calls[1]?.body).toEqual({ date: '2026-08-01', name: 'Fête de l’indépendance' });

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Fête de l’indépendance' }));
    const dialog = screen.getByRole('dialog', { name: 'Retirer « Fête de l’indépendance » ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer' }));
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: 'Fête de l’indépendance' })).not.toBeInTheDocument(),
    );
    expect(calls[2]?.method).toBe('DELETE');

    fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2027' } });
    expect(replace).toHaveBeenCalledWith('/nettoyage/reglages?annee=2027');
  });
});
