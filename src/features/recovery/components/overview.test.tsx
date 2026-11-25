import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, ME, overview } from '@/features/recovery/fixtures.test-utils';
import { Overview } from './overview';
import { RecoveryTabs } from './recovery-tabs';

let pathname = '/recouvrement';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

afterEach(() => vi.unstubAllGlobals());

const tabs = () => screen.getAllByRole('link').map((link) => link.textContent);

describe('onglets du Recouvrement selon les rôles du contrat', () => {
  it('chargé : tableau de bord, dossiers, jours fériés (seuls réglages lisibles)', () => {
    session.set(sessionBody(['recovery_agent']));
    render(<RecoveryTabs />);
    expect(tabs()).toEqual(['Tableau de bord', 'Dossiers', 'Réglages']);
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute(
      'href',
      '/recouvrement/reglages/jours-feries',
    );
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page');
  });

  it('finance : paiements hors ligne, tarification en lecture, factures de commission', () => {
    session.set(sessionBody(['finance_officer']));
    render(<RecoveryTabs />);
    expect(tabs()).toEqual([
      'Tableau de bord',
      'Dossiers',
      'Paiements hors ligne',
      'Tarification',
      'Factures de commission',
      'Réglages',
    ]);
  });

  it('responsable : réglages complets, pas de paiements hors ligne', () => {
    pathname = '/recouvrement/reglages/jours-feries';
    session.set(sessionBody(['recovery_admin']));
    render(<RecoveryTabs />);
    expect(tabs()).toEqual([
      'Tableau de bord',
      'Dossiers',
      'Tarification',
      'Factures de commission',
      'Réglages',
    ]);
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/recouvrement/reglages');
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('aria-current', 'page');
    pathname = '/recouvrement';
  });
});

describe('tableau de bord', () => {
  it('chiffres du contrat et liens vers les files filtrées', async () => {
    session.set(sessionBody(['finance_officer']));
    const { calls } = stubGateway({ [`GET ${ADMIN}/overview`]: { status: 200, body: overview } });
    render(<Overview />);
    expect(await screen.findByText('24,8 %')).toBeInTheDocument();
    expect(screen.getByText(/12\s500\s000/)).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    const waiting = screen.getByRole('region', { name: 'En attente' });
    expect(within(waiting).getByRole('link', { name: '6 Recevabilité à décider' })).toHaveAttribute(
      'href',
      '/recouvrement/dossiers?statut=under_review',
    );
    expect(within(waiting).getByRole('link', { name: '2 Paiements hors ligne à valider' })).toHaveAttribute(
      'href',
      '/recouvrement/paiements-hors-ligne',
    );
    expect(
      within(waiting).getByRole('link', { name: '5 Dossiers sans action depuis 7 jours' }),
    ).toHaveAttribute('href', '/recouvrement/dossiers?inactifs=7');
    expect(within(waiting).getByRole('link', { name: /Prescriptions proches/ })).toHaveAttribute(
      'href',
      '/recouvrement/dossiers?prescription=true',
    );
    // Échéances et promesses : pas de filtre au contrat, chiffre seul.
    expect(within(waiting).getByText('Échéances du jour')).not.toHaveAttribute('href');
    const stages = screen.getByRole('region', { name: 'Dossiers par étape' });
    expect(within(stages).getByRole('link', { name: 'Relance amiable' })).toHaveAttribute(
      'href',
      '/recouvrement/dossiers?etape=amicable',
    );
    expect(screen.getByRole('link', { name: 'Loyers' })).toHaveAttribute(
      'href',
      '/recouvrement/dossiers?offre=rent',
    );
    expect(screen.getByText('Après mise en demeure')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les dossiers de Chargé TEST' })).toHaveAttribute(
      'href',
      `/recouvrement/dossiers?charge=${ME}`,
    );
  });

  it('sans les paiements hors ligne : le chiffre reste, sans lien', async () => {
    session.set(sessionBody(['recovery_agent']));
    stubGateway({ [`GET ${ADMIN}/overview`]: { status: 200, body: overview } });
    render(<Overview />);
    await screen.findByText('24,8 %');
    expect(screen.queryByRole('link', { name: /Paiements hors ligne/ })).not.toBeInTheDocument();
    expect(screen.getByText('Paiements hors ligne à valider')).toBeInTheDocument();
  });

  it('erreur de la gateway avec référence, puis « Réessayer »', async () => {
    session.set(sessionBody(['recovery_admin']));
    const { calls } = stubGateway({
      [`GET ${ADMIN}/overview`]: [
        { status: 503, body: errorBody('RECOVERY_UNAVAILABLE', 'Service du recouvrement indisponible.') },
        { status: 200, body: overview },
      ],
    });
    render(<Overview />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service du recouvrement indisponible. Référence pour le support : c-test.',
    );
    act(() => screen.getByRole('button', { name: 'Réessayer' }).click());
    expect(await screen.findByText('24,8 %')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('rôle refusé par la gateway : message neutre', async () => {
    session.set(sessionBody(['recovery_agent']));
    stubGateway({
      [`GET ${ADMIN}/overview`]: { status: 403, body: errorBody('GATEWAY_FORBIDDEN', 'Accès refusé.') },
    });
    render(<Overview />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
  });
});
