import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { organizationAccess } from '@/features/identity/organization-texts';
import { OrganizationDetail } from './organization-detail';
import { OrganizationsList } from './organizations-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/clients/entreprises',
  useSearchParams: () => new URLSearchParams(search),
}));

const ADMIN = '/api/v1/admin/identity/organizations';
const ids = {
  organization: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0a01',
  requester: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e60',
};
const ORGANIZATION = `${ADMIN}/${ids.organization}`;

function organization(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.organization,
    legalName: 'SARL Bénin Propre',
    address: 'Lot 1234, Haie Vive, Cotonou',
    ifu: '3201912345678',
    rccm: 'RB/COT/19 B 12345',
    billingEmail: null,
    status: 'pending_review',
    rejectionReason: null,
    suspensionReason: null,
    createdAt: '2026-10-27T10:00:00Z',
    reviewedAt: null,
    createdBy: ids.requester,
    reviewedBy: null,
    suspendedAt: null,
    ...overrides,
  };
}

const members = [
  {
    userId: ids.requester,
    role: 'org_admin',
    firstName: 'Afi',
    lastName: 'Houngbo',
    phone: '+2290197000060',
    joinedAt: '2026-10-27T10:00:00Z',
  },
];

const detail = (overrides: Record<string, unknown> = {}) => ({
  organization: organization(overrides),
  members,
});

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['super_admin']));
});

afterEach(() => vi.unstubAllGlobals());

describe('droits des comptes entreprise', () => {
  it('suit les rôles du contrat', () => {
    expect(organizationAccess(['super_admin'])).toEqual({ read: true, decide: true });
    expect(organizationAccess(['support_agent'])).toEqual({ read: true, decide: false });
    expect(organizationAccess(['cleaning_admin'])).toEqual({ read: false, decide: false });
  });
});

describe('liste des comptes entreprise', () => {
  it('passe l’état à la gateway et lie la fiche', async () => {
    search = 'etat=pending_review';
    const { calls } = stubGateway({
      [`GET ${ADMIN}`]: { status: 200, body: { data: [organization()], nextCursor: null } },
    });
    render(<OrganizationsList />);
    expect(await screen.findByRole('link', { name: 'SARL Bénin Propre' })).toHaveAttribute(
      'href',
      `/clients/entreprises/${ids.organization}`,
    );
    expect(calls[0]?.search).toBe('?limit=20&status=pending_review');
    expect(screen.getByLabelText('État')).toHaveValue('pending_review');
    fireEvent.change(screen.getByLabelText('État'), { target: { value: '' } });
    expect(replace).toHaveBeenCalledWith('/clients/entreprises', { scroll: false });
  });
});

describe('fiche d’un compte entreprise', () => {
  it('affiche l’identité légale et les membres, demandeur signalé', async () => {
    stubGateway({ [`GET ${ORGANIZATION}`]: { status: 200, body: detail() } });
    render(<OrganizationDetail id={ids.organization} />);
    expect(await screen.findByRole('heading', { name: 'SARL Bénin Propre' })).toBeInTheDocument();
    expect(screen.getByText('En attente de validation')).toBeInTheDocument();
    expect(screen.getByText('RB/COT/19 B 12345')).toBeInTheDocument();
    expect(screen.getByText('Aucun e-mail confirmé')).toBeInTheDocument();
    expect(screen.getByText(/Afi Houngbo/)).toBeInTheDocument();
    expect(screen.getByText('(demandeur)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Appeler Afi Houngbo' })).toHaveAttribute(
      'href',
      'tel:+2290197000060',
    );
    expect(screen.getByRole('link', { name: 'Factures de l’entreprise' })).toHaveAttribute(
      'href',
      `/finance/factures?entreprise=${ids.organization}`,
    );
  });

  it('valide une demande après confirmation', async () => {
    const { calls } = stubGateway({
      [`GET ${ORGANIZATION}`]: { status: 200, body: detail() },
      [`POST ${ORGANIZATION}/validate`]: {
        status: 200,
        body: organization({ status: 'active', reviewedAt: '2026-10-31T10:00:00Z' }),
      },
    });
    render(<OrganizationDetail id={ids.organization} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider le compte' }));
    expect(await screen.findByText('Compte entreprise validé.')).toBeInTheDocument();
    expect(screen.getByText('Validée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeInTheDocument();
    // Les membres restent affichés après la décision.
    expect(screen.getByText(/Afi Houngbo/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toBeUndefined();
  });

  it('refuse une demande avec un motif obligatoire', async () => {
    const { calls } = stubGateway({
      [`GET ${ORGANIZATION}`]: { status: 200, body: detail() },
      [`POST ${ORGANIZATION}/reject`]: {
        status: 200,
        body: organization({ status: 'rejected', rejectionReason: 'IFU introuvable.' }),
      },
    });
    render(<OrganizationDetail id={ids.organization} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refuser' }));
    const dialog = screen.getByRole('dialog');
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));
    send();
    expect(await within(dialog).findByText('Indiquez un motif.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'IFU introuvable.' } });
    send();
    expect(await screen.findByText('Demande refusée.')).toBeInTheDocument();
    expect(screen.getByText(/Motif communiqué au client : IFU introuvable\./)).toBeInTheDocument();
    expect(screen.getByText('Aucune décision possible dans cet état.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ reason: 'IFU introuvable.' });
  });

  it('suspend puis réactive un compte validé', async () => {
    stubGateway({
      [`GET ${ORGANIZATION}`]: { status: 200, body: detail({ status: 'active' }) },
      [`POST ${ORGANIZATION}/suspend`]: {
        status: 200,
        body: organization({
          status: 'suspended',
          suspensionReason: 'Usurpation signalée.',
          suspendedAt: '2026-10-31T10:00:00Z',
        }),
      },
      [`POST ${ORGANIZATION}/reactivate`]: { status: 200, body: organization({ status: 'active' }) },
    });
    render(<OrganizationDetail id={ids.organization} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Usurpation signalée.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));
    expect(
      await screen.findByText(/Compte suspendu depuis le .* Motif : Usurpation signalée\./),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lever la suspension' }));
    dialog = screen.getAllByRole('dialog').find((element) => element.hasAttribute('open')) as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lever la suspension' }));
    expect(await screen.findByText('Suspension levée.')).toBeInTheDocument();
    expect(screen.getByText('Validée')).toBeInTheDocument();
  });

  it('relit la fiche quand l’état a changé entre-temps', async () => {
    const { calls } = stubGateway({
      [`GET ${ORGANIZATION}`]: [
        { status: 200, body: detail() },
        { status: 200, body: detail({ status: 'active' }) },
      ],
      [`POST ${ORGANIZATION}/validate`]: {
        status: 422,
        body: errorBody('IDENTITY_ORGANIZATION_INVALID_TRANSITION', 'Transition impossible.', {
          from: 'active',
        }),
      },
    });
    render(<OrganizationDetail id={ids.organization} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Valider le compte' }));
    expect(await screen.findByText(/a changé d’état entre-temps/)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('réserve les décisions au super administrateur', async () => {
    session.set(sessionBody(['support_agent']));
    stubGateway({ [`GET ${ORGANIZATION}`]: { status: 200, body: detail() } });
    render(<OrganizationDetail id={ids.organization} />);
    expect(await screen.findByText(/réservées au super administrateur/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument();
    // support_agent n'a pas le module Finance : pas de lien vers les factures.
    expect(screen.queryByRole('link', { name: 'Factures de l’entreprise' })).not.toBeInTheDocument();
  });
});
