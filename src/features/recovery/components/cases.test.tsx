import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { casePage } from '@/features/recovery/case-fixtures.test-utils';
import { ADMIN, caseSummary, uuid } from '@/features/recovery/fixtures.test-utils';
import { CasesList } from './cases-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/recouvrement/dossiers',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['recovery_supervisor']));
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });

describe('file des dossiers', () => {
  it('filtres du tableau de bord lus dans l’adresse, total, mise en avant de ce qui attend', async () => {
    search = 'statut=under_review&inactifs=7&prescription=true';
    const review = caseSummary('01', {
      status: 'under_review',
      stage: null,
      nextDeadline: { kind: 'review', dueAt: '2020-01-02T09:00:00Z' },
      assignedAgent: null,
    });
    const { calls } = stubGateway({ [`GET ${ADMIN}/cases`]: ok(casePage([review], 23, 'c2')) });
    render(<CasesList />);
    expect(await screen.findByRole('link', { name: 'Ouvrir le dossier RC-2026-0001' })).toHaveAttribute(
      'href',
      `/recouvrement/dossiers/${uuid('ca01')}`,
    );
    expect(calls[0]?.search).toBe('?limit=20&status=under_review&idleDays=7&prescriptionNear=true');
    expect(screen.getByText('23 dossiers')).toBeInTheDocument();
    expect(screen.getByText('À étudier')).toBeInTheDocument();
    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.getByText('Non affecté')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher plus' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recevabilité à décider' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Mes dossiers' })).toHaveAttribute(
      'href',
      `/recouvrement/dossiers?charge=${TEST_USER.id}`,
    );
  });

  it('changer un filtre réécrit l’adresse ; la recherche n’y entre jamais', async () => {
    search = `etape=notice&creancier=${uuid('0a01')}`;
    const { calls } = stubGateway({ [`GET ${ADMIN}/cases`]: ok(casePage([caseSummary('02')])) });
    render(<CasesList />);
    await screen.findByText('1 dossier');
    fireEvent.change(screen.getByLabelText('Offre'), { target: { value: 'rent' } });
    expect(replace).toHaveBeenLastCalledWith(
      `/recouvrement/dossiers?etape=notice&creancier=${uuid('0a01')}&offre=rent`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « Créancier choisi »' }));
    expect(replace).toHaveBeenLastCalledWith('/recouvrement/dossiers?etape=notice');

    const field = screen.getByRole('searchbox', { name: 'Rechercher' });
    fireEvent.change(field, { target: { value: 'ab' } });
    fireEvent.click(within(screen.getByRole('search')).getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Saisissez 3 caractères au moins.')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'Débiteur TEST' } });
    fireEvent.click(within(screen.getByRole('search')).getByRole('button', { name: 'Rechercher' }));
    await screen.findAllByText('1 dossier');
    expect(new URLSearchParams(calls.at(-1)?.search).get('search')).toBe('Débiteur TEST');
    const replaced = replace.mock.calls.map(([url]) => String(url));
    expect(replaced.some((url) => url.includes('recherche'))).toBe(false);
  });

  it('inactivité hors bornes refusée avant l’envoi ; commune appliquée', async () => {
    stubGateway({ [`GET ${ADMIN}/cases`]: ok(casePage([])) });
    render(<CasesList />);
    expect(await screen.findByText('Aucun dossier pour ces critères.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Sans action depuis/), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(screen.getByText('Saisissez un nombre de jours de 1 à 365.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Sans action depuis/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/^Commune/), { target: { value: 'porto-novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(replace).toHaveBeenCalledWith('/recouvrement/dossiers?commune=porto-novo');
  });

  it('refus de la gateway : message lisible', async () => {
    stubGateway({
      [`GET ${ADMIN}/cases`]: { status: 403, body: errorBody('GATEWAY_FORBIDDEN', 'Accès refusé.') },
    });
    render(<CasesList />);
    expect(await screen.findByText(/Accès refusé\./)).toBeInTheDocument();
  });
});
