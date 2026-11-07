import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { AccountDetailView } from './account-detail';
import { AccountsSearch } from './accounts-search';

const ACCOUNTS = '/api/v1/admin/identity/accounts';
const ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0002';
const ACCOUNT = `${ACCOUNTS}/${ID}`;
const ASSIGNMENT = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0b01';

function account(overrides: Record<string, unknown> = {}) {
  return {
    userId: ID,
    status: 'active',
    firstName: 'Awa',
    lastName: 'Dossou',
    phone: '+2290197000045',
    phoneMasked: '+229********45',
    createdAt: '2026-10-19T12:00:00Z',
    suspendedAt: null,
    suspensionReason: null,
    roles: ['cleaning_agent'],
    ...overrides,
  };
}

const agentRole = {
  id: ASSIGNMENT,
  roleCode: 'cleaning_agent',
  roleDescription: 'Agent de terrain du nettoyage',
  service: 'cleaning',
  scopeType: 'domain',
  scopeId: 'cleaning',
  grantedAt: '2026-10-20T07:00:00Z',
  grantedBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dad01',
  grantedByName: 'Afi Kpodar',
  grantReason: 'Recrutée comme agent de terrain.',
  revokedAt: null,
  revokedBy: null,
  revokedByName: null,
  revokeReason: null,
  revocable: true,
};

function detail(overrides: Record<string, unknown> = {}) {
  return {
    account: account(),
    mfa: { configured: true, configuredAt: '2026-10-20T08:00:00Z', recoveryCodesRemaining: 9 },
    roles: [agentRole],
    history: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0c01',
        action: 'user.role_granted',
        at: '2026-10-20T07:00:00Z',
        actorId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dad01',
        actorName: 'Afi Kpodar',
        roleCode: 'cleaning_agent',
        reason: 'Recrutée comme agent de terrain.',
      },
    ],
    actions: { grantRole: true, suspend: true, reactivate: false, resetMfa: true },
    ...overrides,
  };
}

const catalog = {
  data: [
    {
      code: 'cleaning_agent',
      service: 'cleaning',
      scopeType: 'domain',
      description: 'Agent de terrain du nettoyage',
      backofficeAccess: true,
      grantable: true,
    },
    {
      code: 'cleaning_supervisor',
      service: 'cleaning',
      scopeType: 'domain',
      description: 'Superviseur des missions de nettoyage',
      backofficeAccess: true,
      grantable: true,
    },
    {
      code: 'super_admin',
      service: 'identity',
      scopeType: 'global',
      description: 'Direction KSP',
      backofficeAccess: true,
      grantable: false,
    },
  ],
};

const openDialog = () =>
  screen.getAllByRole('dialog').find((element) => element.hasAttribute('open')) as HTMLElement;

beforeEach(() => session.set(sessionBody(['super_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('recherche de comptes', () => {
  it('montre d’abord l’équipe, puis cherche dans le corps de la requête, jamais dans l’adresse', async () => {
    const { calls } = stubGateway({
      [`POST ${ACCOUNTS}/search`]: [
        { status: 200, body: { data: [account()], nextCursor: null } },
        { status: 200, body: { data: [], nextCursor: null } },
      ],
    });
    render(<AccountsSearch />);
    expect(await screen.findByRole('link', { name: 'Awa Dossou' })).toHaveAttribute(
      'href',
      `/administration/comptes/${ID}`,
    );
    expect(screen.getByText('Agent du Nettoyage')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ search: '', body: { limit: 20 } });

    fireEvent.change(screen.getByLabelText('Nom ou numéro'), { target: { value: ' +229 0197000099 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText(/Aucun compte trouvé/)).toBeInTheDocument();
    expect(calls[1]).toMatchObject({ search: '', body: { limit: 20, query: '+229 0197000099' } });
    expect(screen.getByRole('heading', { name: 'Résultats pour « +229 0197000099 »' })).toBeInTheDocument();
  });

  it('affiche le message de la gateway pour une recherche refusée', async () => {
    stubGateway({
      [`POST ${ACCOUNTS}/search`]: {
        status: 400,
        body: errorBody('IDENTITY_ACCOUNT_ADMIN_INVALID', 'Saisissez au moins 2 lettres du nom.'),
      },
    });
    render(<AccountsSearch />);
    expect(await screen.findByText('Saisissez au moins 2 lettres du nom.')).toBeInTheDocument();
  });
});

describe('fiche d’un compte', () => {
  it('montre les rôles avec périmètre, auteur et motif, la double authentification et l’historique', async () => {
    stubGateway({
      [`GET ${ACCOUNT}`]: { status: 200, body: detail() },
      'GET /api/v1/admin/identity/roles': { status: 200, body: catalog },
    });
    render(<AccountDetailView id={ID} />);
    expect(await screen.findByRole('heading', { name: 'Awa Dossou' })).toBeInTheDocument();
    const roles = screen.getByRole('table', { name: 'Rôles actifs du compte' });
    expect(within(roles).getByText('Agent du Nettoyage')).toBeInTheDocument();
    expect(within(roles).getByText('Métier : Nettoyage')).toBeInTheDocument();
    expect(within(roles).getByText(/par Afi Kpodar/)).toBeInTheDocument();
    expect(screen.getByText(/9 codes de récupération restants/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Actions du back-office sur ce compte' })).toHaveTextContent(
      'Rôle attribué',
    );
    expect(screen.getByRole('link', { name: '+2290197000045' })).toHaveAttribute(
      'href',
      'tel:+2290197000045',
    );
  });

  it('attribue un rôle du périmètre, avec motif obligatoire, et affiche la fiche renvoyée', async () => {
    const { calls } = stubGateway({
      [`GET ${ACCOUNT}`]: {
        status: 200,
        body: detail({ mfa: { configured: false, configuredAt: null, recoveryCodesRemaining: 0 } }),
      },
      'GET /api/v1/admin/identity/roles': { status: 200, body: catalog },
      [`POST ${ACCOUNT}/roles`]: {
        status: 200,
        body: detail({
          roles: [
            { ...agentRole, id: 'b2', roleCode: 'cleaning_supervisor', roleDescription: 'Superviseur' },
            agentRole,
          ],
        }),
      },
    });
    render(<AccountDetailView id={ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attribuer un rôle' }));
    const dialog = openDialog();
    expect(within(dialog).getByText(/double authentification : elle lui sera demandée/)).toBeInTheDocument();
    const select = await within(dialog).findByLabelText('Rôle');
    // Ni le rôle déjà actif, ni un rôle hors du périmètre.
    expect(within(select).queryByRole('option', { name: /Agent du Nettoyage/ })).toBeNull();
    expect(within(select).queryByRole('option', { name: /Super administrateur/ })).toBeNull();
    fireEvent.change(select, { target: { value: 'cleaning_supervisor' } });
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Attribuer le rôle' }));
    send();
    expect(await within(dialog).findByText('Indiquez un motif.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Chef d’équipe à Calavi' } });
    send();
    expect(await screen.findByText('Rôle « Superviseur du Nettoyage » attribué.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      roleCode: 'cleaning_supervisor',
      reason: 'Chef d’équipe à Calavi',
    });
  });

  it('retire un rôle ; relit la fiche si le rôle a déjà été retiré par un autre agent', async () => {
    const { calls } = stubGateway({
      [`GET ${ACCOUNT}`]: [
        { status: 200, body: detail() },
        {
          status: 200,
          body: detail({ roles: [{ ...agentRole, revokedAt: '2026-11-07T09:00:00Z', revocable: false }] }),
        },
      ],
      'GET /api/v1/admin/identity/roles': { status: 200, body: catalog },
      [`POST ${ACCOUNT}/roles/revoke`]: {
        status: 422,
        body: errorBody('IDENTITY_ROLE_ALREADY_REVOKED', 'Ce rôle a déjà été retiré.'),
      },
    });
    render(<AccountDetailView id={ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer le rôle Agent du Nettoyage' }));
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Départ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer le rôle' }));
    expect(await within(dialog).findByText(/a changé entre-temps/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      assignmentId: ASSIGNMENT,
      reason: 'Départ',
    });
    expect(await screen.findByRole('table', { name: 'Rôles retirés du compte' })).toBeInTheDocument();
  });

  it('suspend le compte avec un motif ; le dernier super administrateur est refusé avec le message d’identity', async () => {
    stubGateway({
      [`GET ${ACCOUNT}`]: { status: 200, body: detail() },
      'GET /api/v1/admin/identity/roles': { status: 200, body: catalog },
      [`POST ${ACCOUNT}/suspend`]: [
        {
          status: 422,
          body: errorBody('IDENTITY_LAST_SUPER_ADMIN', 'C’est le dernier super administrateur actif.'),
        },
        {
          status: 200,
          body: detail({
            account: account({
              status: 'suspended',
              suspendedAt: '2026-11-07T10:00:00Z',
              suspensionReason: 'Fraude',
            }),
            actions: { grantRole: false, suspend: false, reactivate: true, resetMfa: true },
          }),
        },
      ],
    });
    render(<AccountDetailView id={ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre le compte' }));
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Fraude' } });
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));
    send();
    expect(
      await within(dialog).findByText('C’est le dernier super administrateur actif.'),
    ).toBeInTheDocument();
    send();
    expect(await screen.findByText('Compte suspendu.')).toBeInTheDocument();
    expect(screen.getByText(/Motif : Fraude\. La personne ne peut plus se connecter\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réactiver le compte' })).toBeInTheDocument();
  });

  it('sans droit sur le compte : aucune action, numéro masqué', async () => {
    stubGateway({
      [`GET ${ACCOUNT}`]: {
        status: 200,
        body: detail({
          account: account({ phone: null }),
          roles: [{ ...agentRole, revocable: false }],
          actions: { grantRole: false, suspend: false, reactivate: false, resetMfa: false },
        }),
      },
    });
    render(<AccountDetailView id={ID} />);
    expect(await screen.findByText('+229********45')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retirer|Attribuer|Suspendre|Réinitialiser/ })).toBeNull();
    expect(screen.getByText(/Aucune action possible ici/)).toBeInTheDocument();
  });

  it('compte introuvable : message, sans « Réessayer »', async () => {
    stubGateway({
      [`GET ${ACCOUNT}`]: { status: 404, body: errorBody('IDENTITY_USER_NOT_FOUND', 'Compte introuvable.') },
    });
    render(<AccountDetailView id={ID} />);
    expect(await screen.findByText('Ce compte est introuvable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });
});
