import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { RoleCreateView } from './role-create';
import { RoleDetailView } from './role-detail';
import { RolesList } from './roles-list';

// Écrans à plusieurs étapes (boîtes, relectures) : jsdom lent sous charge sur cette machine.
vi.setConfig({ testTimeout: 15_000 });

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ROLES = '/api/v1/admin/identity/roles';
const PERMISSIONS = '/api/v1/admin/identity/permissions';
const PLANNER = `${ROLES}/cleaning_planner`;

const permission = (code: string, description: string, retired = false) => ({
  code,
  description,
  service: code.split('.')[0],
  module: code.split('.')[1],
  retired,
});

const catalog = {
  data: [
    permission('cleaning.planning.manage', 'Planifier les visites et les séances'),
    permission('cleaning.request.process', 'Traiter les dossiers'),
    permission('cleaning.request.read', 'Lire les dossiers'),
    permission('cleaning.legacy.read', 'Ancienne lecture', true),
  ],
};

function role(overrides: Record<string, unknown> = {}) {
  return {
    code: 'cleaning_planner',
    name: 'Planificateur Nettoyage',
    description: 'Planifie les visites et les séances.',
    service: 'identity',
    origin: 'custom',
    scopeType: 'global',
    permissions: ['cleaning.request.read', 'cleaning.planning.manage', 'cleaning.legacy.read'],
    sensitive: false,
    backofficeAccess: true,
    requiresMfa: true,
    active: true,
    editable: true,
    activeAssignments: 2,
    createdAt: '2026-11-20T09:00:00Z',
    createdBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dad01',
    updatedAt: null,
    updatedBy: null,
    deactivatedAt: null,
    deactivatedBy: null,
    ...overrides,
  };
}

const openDialog = () =>
  screen.getAllByRole('dialog').find((element) => element.hasAttribute('open')) as HTMLElement;

beforeEach(() => {
  push.mockReset();
  session.set(sessionBody(['super_admin']));
});
afterEach(() => vi.unstubAllGlobals());

describe('liste des rôles', () => {
  it('montre les rôles actifs puis désactivés, leur origine, et le lien de création', async () => {
    stubGateway({
      [`GET ${ROLES}`]: {
        status: 200,
        body: {
          data: [
            {
              code: 'old_role',
              service: 'identity',
              scopeType: 'global',
              description: 'Ancien',
              backofficeAccess: true,
              grantable: true,
              name: 'Ancien rôle',
              active: false,
              origin: 'custom',
            },
            {
              code: 'cleaning_admin',
              service: 'cleaning',
              scopeType: 'global',
              description: 'Admin',
              backofficeAccess: true,
              grantable: true,
              active: true,
              sensitive: true,
              origin: 'default',
            },
          ],
        },
      },
    });
    render(<RolesList />);
    const links = await screen.findAllByRole('link', { name: /Responsable du Nettoyage|Ancien rôle/ });
    expect(links.map((link) => link.textContent)).toEqual(['Responsable du Nettoyage', 'Ancien rôle']);
    expect(links[0]).toHaveAttribute('href', '/administration/roles/cleaning_admin');
    expect(screen.getByText('Livré par défaut')).toBeInTheDocument();
    expect(screen.getByText('Désactivé')).toBeInTheDocument();
    expect(screen.getByText('Sensible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un rôle' })).toHaveAttribute(
      'href',
      '/administration/roles/nouveau-role',
    );
  });
});

describe('fiche d’un rôle', () => {
  it('permissions groupées avec libellés lisibles ; permission retirée signalée', async () => {
    const { calls } = stubGateway({
      [`GET ${PLANNER}`]: { status: 200, body: role() },
      [`GET ${PERMISSIONS}`]: { status: 200, body: catalog },
    });
    render(<RoleDetailView code="cleaning_planner" />);
    expect(await screen.findByRole('heading', { name: 'Planificateur Nettoyage' })).toBeInTheDocument();
    expect(await screen.findByText('Lire les dossiers')).toBeInTheDocument();
    expect(screen.getByText('Planning et affectations')).toBeInTheDocument();
    expect(screen.getByText(/Une permission n’est plus déclarée/)).toBeInTheDocument();
    expect(screen.getByText('2 comptes')).toBeInTheDocument();
    expect(calls.find((call) => call.path === PERMISSIONS)?.search).toBe('?includeRetired=true');
  });

  it('super_admin : ni modification ni désactivation', async () => {
    stubGateway({
      [`GET ${ROLES}/super_admin`]: {
        status: 200,
        body: role({ code: 'super_admin', name: 'Super administrateur', editable: false, origin: 'default' }),
      },
      [`GET ${PERMISSIONS}`]: { status: 200, body: catalog },
    });
    render(<RoleDetailView code="super_admin" />);
    expect(await screen.findByText(/n’est pas modifiable/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier|Désactiver/ })).toBeNull();
  });

  it('modifie les permissions : résumé des ajouts et retraits, motif exigé, liste complète envoyée', async () => {
    const { calls } = stubGateway({
      [`GET ${PLANNER}`]: { status: 200, body: role() },
      [`GET ${PERMISSIONS}`]: { status: 200, body: catalog },
      [`PATCH ${PLANNER}`]: {
        status: 200,
        body: role({ permissions: ['cleaning.planning.manage', 'cleaning.request.process'] }),
      },
    });
    render(<RoleDetailView code="cleaning_planner" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Traiter les dossiers/));
    fireEvent.click(screen.getByLabelText(/Lire les dossiers/));
    fireEvent.click(screen.getByLabelText(/cleaning\.legacy\.read/));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const dialog = openDialog();
    expect(within(dialog).getByText('1 permission ajoutée')).toBeInTheDocument();
    expect(within(dialog).getByText('2 permissions retirées')).toBeInTheDocument();
    expect(within(dialog).getByText('Traiter les dossiers')).toBeInTheDocument();
    const send = () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer les changements' }));
    send();
    expect(await within(dialog).findByText('Indiquez un motif.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), {
      target: { value: 'Traite aussi les demandes.' },
    });
    send();
    expect(await screen.findByText('Rôle modifié.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      permissions: ['cleaning.planning.manage', 'cleaning.request.process'],
      reason: 'Traite aussi les demandes.',
    });
  });

  it('désactivation refusée tant que le rôle est attribué, puis acceptée', async () => {
    stubGateway({
      // Relecture après le refus : un titulaire a été réaffecté entre-temps.
      [`GET ${PLANNER}`]: [
        { status: 200, body: role() },
        { status: 200, body: role({ activeAssignments: 1 }) },
      ],
      [`GET ${PERMISSIONS}`]: { status: 200, body: catalog },
      [`POST ${PLANNER}/deactivate`]: [
        {
          status: 422,
          body: errorBody('IDENTITY_ROLE_IN_USE', 'Rôle encore attribué.', { activeAssignments: 2 }),
        },
        {
          status: 200,
          body: role({ active: false, activeAssignments: 0, deactivatedAt: '2026-11-25T10:00:00Z' }),
        },
      ],
    });
    render(<RoleDetailView code="cleaning_planner" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Désactiver le rôle Planificateur Nettoyage' }),
    );
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Rôle remplacé.' } });
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Désactiver le rôle' }));
    send();
    // Refus : la fiche est relue (1 titulaire), le message d'identity (2 comptes) reste dans la boîte.
    expect(await within(dialog).findByText(/Un compte a encore ce rôle/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 comptes ont encore ce rôle/)).toBeInTheDocument();
    send();
    expect(await screen.findByText('Rôle désactivé.')).toBeInTheDocument();
    expect(screen.getByText(/Ce rôle est désactivé/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
  });
});

describe('création d’un rôle', () => {
  it('contrôle le code, envoie les cases cochées avec le motif, puis ouvre la fiche', async () => {
    const { calls } = stubGateway({
      [`GET ${PERMISSIONS}`]: { status: 200, body: { data: catalog.data.slice(0, 3) } },
      [`POST ${ROLES}`]: [
        { status: 409, body: errorBody('IDENTITY_ROLE_ALREADY_EXISTS', 'Existe déjà.') },
        { status: 201, body: role() },
      ],
    });
    render(<RoleCreateView />);
    fireEvent.change(await screen.findByLabelText(/^Code/), { target: { value: 'Pl' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Planificateur Nettoyage' } });
    fireEvent.click(screen.getByLabelText(/Planifier les visites/));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }));
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Nouvelle organisation.' } });
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Créer le rôle' }));
    send();
    expect(await within(dialog).findByText(/Le code doit commencer par une lettre/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'cleaning_planner' } });
    send();
    expect(await within(dialog).findByText(/Un rôle porte déjà ce code/)).toBeInTheDocument();
    send();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/administration/roles/cleaning_planner'));
    expect(calls.filter((call) => call.method === 'POST')[1]?.body).toEqual({
      code: 'cleaning_planner',
      name: 'Planificateur Nettoyage',
      permissions: ['cleaning.planning.manage'],
      sensitive: false,
      reason: 'Nouvelle organisation.',
    });
  });
});
