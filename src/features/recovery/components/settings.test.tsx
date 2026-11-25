import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, settings, settingsView } from '@/features/recovery/fixtures.test-utils';
import { HolidaysScreen } from './holidays';
import { SettingsScreen } from './settings-screen';

vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/recouvrement/reglages/jours-feries',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['recovery_admin']));
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });

describe('réglages du recouvrement', () => {
  it('valeurs du service, bornes affichées, contrôle local puis envoi complet', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/settings`]: ok(settingsView),
      [`PUT ${ADMIN}/settings`]: ok({ ...settingsView, settings: { ...settings, formalNoticeDays: 20 } }),
    });
    render(<SettingsScreen />);
    const notice = await screen.findByLabelText('Délai de la mise en demeure (jours)');
    expect(notice).toHaveValue('15');
    expect(screen.getByText('De 8 à 60 jours.')).toBeInTheDocument();
    expect(screen.getByText(/Modifié le .* par Responsable TEST/)).toBeInTheDocument();

    fireEvent.change(notice, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Entre 8 et 60.')).toBeInTheDocument();
    await waitFor(() => expect(notice).toHaveFocus());
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);

    fireEvent.change(notice, { target: { value: '20' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'samedi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(await screen.findByText('Réglages enregistrés.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({
      ...settings,
      formalNoticeDays: 20,
      contactWindow: { ...settings.contactWindow, days: [1, 2, 3, 4, 5, 6] },
    });
  });

  it('refus du service sous le champ nommé', async () => {
    stubGateway({
      [`GET ${ADMIN}/settings`]: ok(settingsView),
      [`PUT ${ADMIN}/settings`]: {
        status: 400,
        body: errorBody(
          'RECOVERY_SETTING_OUT_OF_BOUNDS',
          'Le délai de réponse doit rester entre 3 et 30 jours.',
          {
            field: 'disputeAnswerDays',
          },
        ),
      },
    });
    render(<SettingsScreen />);
    const field = await screen.findByLabelText('Réponse à une contestation (jours)');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }));
    expect(
      await screen.findByText('Le délai de réponse doit rester entre 3 et 30 jours.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
  });

  it('rôle sans les réglages : refus de la gateway affiché sobrement', async () => {
    session.set(sessionBody(['recovery_agent']));
    stubGateway({
      [`GET ${ADMIN}/settings`]: { status: 403, body: errorBody('GATEWAY_FORBIDDEN', 'Accès refusé.') },
    });
    render(<SettingsScreen />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
  });
});

describe('jours fériés', () => {
  const holidays = [
    { date: '2026-08-01', label: 'Fête de l’indépendance' },
    { date: '2026-01-10', label: 'Fête des religions endogènes' },
  ];

  it('année de l’adresse, liste triée, ajout contrôlé, week-end signalé, liste remplacée', async () => {
    search = 'annee=2026';
    const { calls } = stubGateway({
      [`GET ${ADMIN}/holidays/2026`]: ok({ holidays }),
      [`PUT ${ADMIN}/holidays/2026`]: (body) => ok(body),
    });
    render(<HolidaysScreen />);
    const table = await screen.findByRole('table', { name: 'Jours fériés 2026' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Fête des religions endogènes'),
      expect.stringContaining('Fête de l’indépendance'),
    ]);
    // 1er août 2026 : un samedi.
    expect(within(rows[1] as HTMLElement).getByText(/Tombe un week-end/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-01-01' } });
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Jour de l’an' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le jour' }));
    expect(screen.getByText('Choisissez un jour de 2026.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le jour' }));
    expect(screen.getByText('Ce jour est déjà dans la liste.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le jour' }));
    expect(screen.getByText('Modifications non enregistrées.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Fête des religions endogènes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la liste' }));
    expect(await screen.findByText('Jours fériés enregistrés.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({
      holidays: [
        { date: '2026-08-01', label: 'Fête de l’indépendance' },
        { date: '2026-12-25', label: 'Jour de l’an' },
      ],
    });

    fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2027' } });
    expect(replace).toHaveBeenCalledWith('/recouvrement/reglages/jours-feries?annee=2027');
  });

  it('chargé : lecture seule, année vide', async () => {
    session.set(sessionBody(['recovery_agent']));
    search = 'annee=2027';
    stubGateway({ [`GET ${ADMIN}/holidays/2027`]: ok({ holidays: [] }) });
    render(<HolidaysScreen />);
    expect(await screen.findByText('Aucun jour férié enregistré pour 2027.')).toBeInTheDocument();
    expect(screen.getByText(/la liste est fixée par l’administration/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer la liste' })).not.toBeInTheDocument();
  });
});
