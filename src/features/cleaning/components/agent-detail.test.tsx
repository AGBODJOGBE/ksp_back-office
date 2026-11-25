import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  agent,
  agentIds,
  applicant,
  availability,
  idDocument,
} from '@/features/cleaning/agents-fixtures.test-utils';
import { ADMIN, errorBody, ok, page, skill, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { AgentDetail } from './agent-detail';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/nettoyage/equipe/agents/x',
  useSearchParams: () => new URLSearchParams(),
}));

const AGENT = `${ADMIN}/agents/${agentIds.agent}`;
const OTHER = `${ADMIN}/agents/${agentIds.other}`;

beforeEach(() => session.set(sessionBody(['cleaning_admin'])));
afterEach(() => vi.unstubAllGlobals());

const base = {
  [`GET ${ADMIN}/communes`]: ok({
    data: [{ communeKey: 'cotonou', name: 'Cotonou', zoneId: null, zoneActive: true }],
  }),
  [`GET ${ADMIN}/skills`]: page([skill()]),
  [`GET ${AGENT}/availability`]: ok(availability()),
  [`GET ${OTHER}/availability`]: ok(availability({ unavailabilities: [] })),
};

const dialog = (name: string) => screen.getByRole('dialog', { name });
/** La fiche complète (sept jours de plages) est longue à monter sous jsdom. */
const SLOW = 15_000;

describe('fiche agent : cycle de vie', () => {
  it(
    'candidature : vérification puis validation avec les compétences cochées',
    async () => {
      const reviewed = applicant({ status: 'under_review' });
      const { calls } = stubGateway({
        ...base,
        [`GET ${OTHER}`]: ok(applicant()),
        [`POST ${OTHER}/review`]: ok(reviewed),
        [`POST ${OTHER}/approve`]: ok(applicant({ status: 'active' })),
      });
      render(<AgentDetail id={agentIds.other} />);
      expect(await screen.findByRole('heading', { name: 'Ama DOSSOU TEST' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Étapes de la candidature' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Suspendre' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Passer en vérification' }));
      fireEvent.click(
        within(dialog('Passer la candidature en vérification')).getByRole('button', {
          name: 'Passer en vérification',
        }),
      );
      expect(await screen.findByText('Candidature passée en vérification.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Valider l’agent' }));
      const approve = dialog('Valider la candidature');
      fireEvent.click(within(approve).getByRole('button', { name: 'Valider l’agent' }));
      expect(await within(approve).findByRole('alert')).toHaveTextContent('Cochez au moins une compétence');
      fireEvent.click(within(approve).getByLabelText('Nettoyage intérieur'));
      fireEvent.click(within(approve).getByRole('button', { name: 'Valider l’agent' }));
      expect(await screen.findByText('Agent validé : il est maintenant actif.')).toBeInTheDocument();
      const posts = calls.filter((call) => call.method === 'POST');
      expect(posts[1]?.body).toEqual({ validatedSkillCodes: ['nettoyage_interieur'] });
      expect(posts[0]?.headers['Idempotency-Key']).not.toBe(posts[1]?.headers['Idempotency-Key']);
    },
    SLOW,
  );

  it(
    'suspension confirmée avec motif obligatoire ; transition périmée : fiche relue',
    async () => {
      const { calls } = stubGateway({
        ...base,
        [`GET ${AGENT}`]: [ok(agent()), ok(agent({ status: 'suspended' }))],
        [`POST ${AGENT}/suspend`]: {
          status: 422,
          body: errorBody('CLEANING_INVALID_TRANSITION', 'Transition impossible.'),
        },
      });
      render(<AgentDetail id={agentIds.agent} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));
      const suspend = dialog('Suspendre l’agent');
      fireEvent.click(within(suspend).getByRole('button', { name: 'Suspendre' }));
      expect(await within(suspend).findByRole('alert')).toHaveTextContent('Motif : Champ obligatoire.');
      expect(calls.some((call) => call.method === 'POST')).toBe(false);
      fireEvent.change(within(suspend).getByLabelText('Motif'), { target: { value: 'Absences répétées' } });
      fireEvent.click(within(suspend).getByRole('button', { name: 'Suspendre' }));
      expect(await within(suspend).findByRole('alert')).toHaveTextContent('la fiche a changé');
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ reason: 'Absences répétées' });
      expect(await screen.findByRole('button', { name: 'Réactiver' }, { timeout: 3000 })).toBeInTheDocument();
    },
    SLOW,
  );

  it(
    'désactivation refusée tant qu’il a des affectations, puis réaffectation cochée',
    async () => {
      const { calls } = stubGateway({
        ...base,
        [`GET ${AGENT}`]: ok(agent()),
        [`POST ${AGENT}/deactivate`]: [
          { status: 409, body: errorBody('CLEANING_AGENT_HAS_ASSIGNMENTS', 'Affectations à venir.') },
          ok(agent({ status: 'deactivated' })),
        ],
      });
      render(<AgentDetail id={agentIds.agent} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));
      const box = dialog('Désactiver l’agent');
      fireEvent.change(within(box).getByLabelText('Motif'), { target: { value: 'Départ' } });
      fireEvent.click(within(box).getByRole('button', { name: 'Désactiver' }));
      expect(await within(box).findByRole('alert')).toHaveTextContent('cochez la réaffectation');
      fireEvent.click(within(box).getByLabelText(/Réaffecter automatiquement/));
      fireEvent.click(within(box).getByRole('button', { name: 'Désactiver' }));
      expect(await screen.findByText('Agent désactivé.')).toBeInTheDocument();
      const bodies = calls.filter((call) => call.method === 'POST').map((call) => call.body);
      expect(bodies).toEqual([
        { reassign: false, reason: 'Départ' },
        { reassign: true, reason: 'Départ' },
      ]);
      expect(screen.queryByRole('button', { name: 'Désactiver' })).toBeNull();
    },
    SLOW,
  );

  it(
    'pièce d’identité lue seulement sur demande, oubliée en la masquant',
    async () => {
      const { calls } = stubGateway({
        ...base,
        [`GET ${AGENT}`]: ok(agent()),
        [`GET ${AGENT}/id-document`]: ok(idDocument()),
      });
      render(<AgentDetail id={agentIds.agent} />);
      const show = await screen.findByRole('button', { name: 'Afficher la pièce d’identité' });
      expect(calls.some((call) => call.path.endsWith('/id-document'))).toBe(false);
      fireEvent.click(show);
      expect(
        await screen.findByRole('img', { name: /Pièce d’identité de Koffi AGBO TEST, recto/ }),
      ).toHaveAttribute('referrerpolicy', 'no-referrer');
      fireEvent.click(screen.getByRole('button', { name: 'Masquer la pièce d’identité' }));
      expect(screen.queryByRole('img', { name: /Pièce d’identité/ })).toBeNull();
    },
    SLOW,
  );

  it(
    'superviseur : fiche et disponibilités, sans actions ni pièce d’identité',
    async () => {
      session.set(sessionBody(['cleaning_supervisor']));
      stubGateway({ ...base, [`GET ${AGENT}`]: ok(agent()) });
      render(<AgentDetail id={agentIds.agent} />);
      expect(await screen.findByText(/Lecture seule : la gestion des agents/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Suspendre' })).toBeNull();
      expect(screen.queryByRole('button', { name: /pièce d’identité/ })).toBeNull();
      expect(
        await screen.findByRole('button', { name: 'Enregistrer les disponibilités' }),
      ).toBeInTheDocument();
    },
    SLOW,
  );
});

describe('fiche agent : disponibilités', () => {
  it(
    'plage invalide signalée ; plage occupée : forcer et replanifier',
    async () => {
      const { calls } = stubGateway({
        ...base,
        [`GET ${AGENT}`]: ok(agent()),
        [`PUT ${AGENT}/availability`]: [
          { status: 409, body: errorBody('CLEANING_AVAILABILITY_IN_USE', 'Plage occupée.') },
          ok(availability()),
        ],
      });
      render(<AgentDetail id={agentIds.agent} />);
      const end = await screen.findByLabelText('Lundi, plage 1 : à');
      fireEvent.change(end, { target: { value: '07:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les disponibilités' }));
      expect(await screen.findByText(/l’heure de fin doit suivre/)).toBeInTheDocument();
      expect(calls.some((call) => call.method === 'PUT')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'Retirer la plage 1 du lundi' }));
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les disponibilités' }));
      expect(await screen.findAllByText(/déjà occupée par des affectations/)).not.toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Forcer et replanifier' }));
      const box = dialog('Forcer et replanifier');
      fireEvent.click(within(box).getByRole('button', { name: 'Forcer et replanifier' }));
      expect(await screen.findByText('Disponibilités enregistrées.')).toBeInTheDocument();
      const puts = calls.filter((call) => call.method === 'PUT').map((call) => call.body);
      expect(puts[0]).toEqual({
        weekly: [],
        extraAvailabilities: [],
        maxHoursPerDay: 8,
        maxHoursPerWeek: 48,
      });
      expect(puts[1]).toMatchObject({ weekly: [], force: true });
    },
    SLOW,
  );

  it(
    'indisponibilité : chevauchement refusé puis forcé ; retrait confirmé',
    async () => {
      const { calls } = stubGateway({
        ...base,
        [`GET ${AGENT}`]: ok(agent()),
        [`POST ${AGENT}/unavailabilities`]: [
          { status: 409, body: errorBody('CLEANING_UNAVAILABILITY_CONFLICT', 'Affectations touchées.') },
          ok(availability()),
        ],
        [`DELETE ${AGENT}/unavailabilities/${agentIds.unavailability}`]: ok(
          availability({ unavailabilities: [] }),
        ),
      });
      render(<AgentDetail id={agentIds.agent} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Déclarer une indisponibilité' }));
      const box = dialog('Déclarer une indisponibilité');
      fireEvent.change(within(box).getByLabelText('Début'), { target: { value: '2026-12-10T08:00' } });
      fireEvent.change(within(box).getByLabelText('Fin'), { target: { value: '2026-12-11T18:00' } });
      fireEvent.change(within(box).getByLabelText('Motif'), { target: { value: 'sickness' } });
      fireEvent.click(within(box).getByRole('button', { name: 'Déclarer une indisponibilité' }));
      expect(await within(box).findByRole('alert')).toHaveTextContent('Cochez « Forcer »');
      fireEvent.click(within(box).getByLabelText(/Forcer : désaffecter/));
      fireEvent.click(within(box).getByRole('button', { name: 'Déclarer une indisponibilité' }));
      expect(await screen.findByText('Indisponibilité déclarée.')).toBeInTheDocument();
      const posts = calls.filter((call) => call.method === 'POST');
      expect(posts[0]?.body).toEqual({
        start: '2026-12-10T07:00:00.000Z',
        end: '2026-12-11T17:00:00.000Z',
        kind: 'sickness',
      });
      expect(posts[1]?.body).toMatchObject({ kind: 'sickness', force: true });

      fireEvent.click(screen.getByRole('button', { name: /Retirer l’indisponibilité du/ }));
      fireEvent.click(within(dialog('Retirer l’indisponibilité')).getByRole('button', { name: 'Retirer' }));
      await waitFor(() => expect(screen.getByText('Aucune indisponibilité à venir.')).toBeInTheDocument());
    },
    SLOW,
  );
});
