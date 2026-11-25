import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, errorBody, ids, ok, page, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import {
  agentCheck,
  agentOption,
  assignment,
  autoRun,
  batch,
  planning,
  planningIds,
  planningItem,
  proposal,
  team,
  unassignedVisit,
} from '@/features/cleaning/planning-fixtures.test-utils';
import { PlanningScreen } from './planning-screen';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/planning',
  useSearchParams: () => new URLSearchParams(search),
}));

const SLOW = 15_000;
const PLANNING = `${ADMIN}/planning`;
const CHECK = `${ADMIN}/assignments/check`;
const ASSIGN = `${ADMIN}/assignments`;

beforeEach(() => {
  search = 'date=2026-11-25';
  replace.mockReset();
  session.set(sessionBody(['cleaning_supervisor']));
});
afterEach(() => vi.unstubAllGlobals());

/** Listes de choix, jours fériés, colonne « à affecter » et propositions. */
const base = (proposals: unknown[] = []) => ({
  [`GET ${ADMIN}/communes`]: ok({
    data: [{ communeKey: 'cotonou', name: 'Cotonou', zoneId: null, zoneActive: true }],
  }),
  [`GET ${ADMIN}/agents`]: page([
    agentOption(planningIds.koffi, 'Koffi'),
    agentOption(planningIds.awa, 'Awa'),
  ]),
  [`GET ${ADMIN}/teams`]: page([team()]),
  [`GET ${ADMIN}/holidays`]: page([{ id: ids.holiday, date: '2026-11-27', name: 'Fête TEST' }]),
  [`GET ${PLANNING}/unassigned`]: page([unassignedVisit()]),
  [`GET ${PLANNING}/proposals`]: page(proposals),
});

const region = (name: string | RegExp) => screen.getByRole('region', { name });
const dialog = (name: string) => screen.getByRole('dialog', { name });
const SESSION_TITLE = 'Séance n° 3 du programme PN-000310';

async function openSession() {
  fireEvent.click(await screen.findByRole('button', { name: /^Gérer : Séance n° 3/ }));
  return region(SESSION_TITLE);
}

describe('planning', () => {
  it('vue semaine : séances par jour, charge des agents et colonne « à affecter »', async () => {
    const { calls } = stubGateway({ ...base(), [`GET ${PLANNING}`]: ok(planning()) });
    render(<PlanningScreen />);
    expect(await screen.findByText('1 intervention sur la période')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: 'Planning de la période' });
    expect(within(grid).getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(within(grid).getByText(SESSION_TITLE)).toBeInTheDocument();
    expect(within(grid).getByText('1 / 2 agents')).toBeInTheDocument();
    expect(within(grid).getByText('Urgent (moins de 48 h)')).toBeInTheDocument();
    expect(await within(grid).findByText('Férié : Fête TEST')).toBeInTheDocument();
    const loads = region('Charge des agents');
    expect(within(loads).getByText(/Prévu : 6 h 30 · Maximum : 48 h · Part : 14 %/)).toBeInTheDocument();

    const column = region('À affecter');
    expect(await within(column).findByText('Visite du dossier DN-000124')).toBeInTheDocument();
    expect(
      within(column).getByRole('button', { name: /^Affecter : Visite du dossier DN-000124/ }),
    ).toBeInTheDocument();

    const query = new URLSearchParams(calls.find((call) => call.path === PLANNING)?.search);
    expect(query.get('from')).toBe('2026-11-22T23:00:00.000Z');
    expect(query.get('to')).toBe('2026-11-29T23:00:00.000Z');
    expect(calls.find((call) => call.path === `${PLANNING}/unassigned`)?.search).toContain('sort=urgency');
  });

  it(
    'contrôle, dérogation motivée, affectation idempotente puis désaffectation confirmée',
    async () => {
      let agents = planningItem().agents;
      const { calls } = stubGateway({
        ...base(),
        [`GET ${PLANNING}`]: () => ok(planning({ items: [planningItem({ agents })] })),
        [`POST ${CHECK}`]: [
          ok({
            passed: false,
            checks: [agentCheck(planningIds.awa, [{ check: 'load', overridable: true }])],
          }),
          ok({
            passed: true,
            checks: [agentCheck(planningIds.awa, [{ check: 'load', overridable: true, overridden: true }])],
          }),
        ],
        [`POST ${ASSIGN}`]: () => {
          agents = [...agents, { ...agents[0]!, agentId: planningIds.awa, firstName: 'Awa', isLead: false }];
          return ok(batch([assignment()]));
        },
        [`POST ${ASSIGN}/${planningIds.assignment}/remove`]: { status: 204 },
      });
      render(<PlanningScreen />);
      const panel = await openSession();
      fireEvent.click(within(panel).getByRole('checkbox', { name: 'Awa TEST' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Contrôler' }));
      expect(
        await within(panel).findByText('Des contrôles échouent : lisez les alertes ci-dessous.'),
      ).toBeInTheDocument();
      expect(within(panel).getByText('Charge de travail')).toBeInTheDocument();
      expect(within(panel).queryByRole('button', { name: /^Confirmer/ })).not.toBeInTheDocument();

      fireEvent.click(within(panel).getByRole('checkbox', { name: 'Contourner : Charge de travail' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Contrôler' }));
      expect(
        await within(panel).findByText('Motif obligatoire pour chaque dérogation cochée.'),
      ).toBeInTheDocument();
      fireEvent.change(within(panel).getByRole('textbox', { name: /Motif de la dérogation/ }), {
        target: { value: 'Renfort exceptionnel' },
      });
      fireEvent.click(within(panel).getByRole('button', { name: 'Contrôler' }));
      fireEvent.click(await within(panel).findByRole('button', { name: 'Confirmer avec les dérogations' }));
      expect(await within(panel).findByText('1 affectation enregistrée.')).toBeInTheDocument();

      const post = calls.find((call) => call.method === 'POST' && call.path === ASSIGN);
      expect(post?.body).toEqual({
        targets: [{ kind: 'session', id: planningIds.session }],
        agentIds: [planningIds.awa],
        overrides: [{ check: 'load', reason: 'Renfort exceptionnel' }],
      });
      expect(post?.headers['Idempotency-Key']).toBeTruthy();

      fireEvent.click(await within(panel).findByRole('button', { name: 'Désaffecter Awa TEST' }));
      const box = dialog('Désaffecter Awa TEST');
      fireEvent.click(within(box).getByRole('button', { name: 'Désaffecter' }));
      expect(await within(box).findByText(/obligatoire/i)).toBeInTheDocument();
      fireEvent.change(within(box).getByRole('textbox'), { target: { value: 'Agent malade' } });
      fireEvent.click(within(box).getByRole('button', { name: 'Désaffecter' }));
      expect(await within(panel).findByText('Agent désaffecté.')).toBeInTheDocument();
      const remove = calls.find((call) => call.path.endsWith('/remove'));
      expect(remove?.body).toEqual({ reason: 'Agent malade' });
      expect(remove?.headers['Idempotency-Key']).toBeTruthy();
    },
    SLOW,
  );

  it(
    'erreurs métier : contrôle bloquant, intervention commencée',
    async () => {
      stubGateway({
        ...base(),
        [`GET ${PLANNING}`]: ok(planning()),
        [`POST ${CHECK}`]: [
          ok({
            passed: false,
            checks: [agentCheck(planningIds.awa, [{ check: 'skills', overridable: false }])],
          }),
          {
            status: 422,
            body: errorBody('CLEANING_INVALID_TRANSITION', 'Transition refusée', {
              reason: 'target_in_past',
            }),
          },
        ],
      });
      render(<PlanningScreen />);
      const panel = await openSession();
      fireEvent.click(within(panel).getByRole('checkbox', { name: 'Awa TEST' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Contrôler' }));
      expect(
        await within(panel).findByText('Un contrôle non contournable échoue : changez d’agent ou d’équipe.'),
      ).toBeInTheDocument();
      expect(within(panel).getByText('Compétences manquantes : vitres')).toBeInTheDocument();
      expect(within(panel).queryByRole('group', { name: 'Dérogations' })).not.toBeInTheDocument();
      fireEvent.click(within(panel).getByRole('button', { name: 'Contrôler' }));
      expect(
        await within(panel).findByText(
          'Cette intervention a déjà commencé : elle ne peut plus être affectée.',
        ),
      ).toBeInTheDocument();
    },
    SLOW,
  );

  it(
    'planification automatique puis validation d’une proposition',
    async () => {
      const { calls } = stubGateway({
        ...base([proposal()]),
        [`GET ${PLANNING}`]: ok(planning()),
        [`POST ${PLANNING}/auto`]: ok(autoRun()),
        [`POST ${PLANNING}/proposals/approve`]: ok(batch([assignment({ id: planningIds.proposal })])),
      });
      render(<PlanningScreen />);
      const auto = await screen.findByRole('region', { name: 'Planification automatique' });
      fireEvent.change(within(auto).getByLabelText('Du'), { target: { value: '2026-11-25' } });
      fireEvent.change(within(auto).getByLabelText(/Au \(inclus\)/), { target: { value: '2026-11-30' } });
      fireEvent.click(within(auto).getByRole('button', { name: 'Lancer la planification' }));
      expect(
        await within(auto).findByText('0 affectation appliquée, 1 proposition à valider.'),
      ).toBeInTheDocument();
      expect(within(auto).getByText(/Visite 0192f1c4 : aucun agent disponible/)).toBeInTheDocument();
      const run = calls.find((call) => call.path === `${PLANNING}/auto`);
      expect(run?.body).toEqual({ from: '2026-11-24T23:00:00.000Z', to: '2026-11-30T23:00:00.000Z' });
      expect(run?.headers['Idempotency-Key']).toBeTruthy();

      const proposals = region('Propositions à valider');
      fireEvent.click(
        await within(proposals).findByRole('checkbox', {
          name: /^Choisir la proposition : Awa TEST, Séance n° 3/,
        }),
      );
      fireEvent.click(within(proposals).getByRole('button', { name: 'Valider 1 proposition' }));
      fireEvent.click(
        within(dialog('Valider 1 proposition ?')).getByRole('button', { name: 'Valider 1 proposition' }),
      );
      expect(await within(proposals).findByText('1 affectation enregistrée.')).toBeInTheDocument();
      const approve = calls.find((call) => call.path.endsWith('/approve'));
      expect(approve?.body).toEqual({ assignmentIds: [planningIds.proposal] });
      await waitFor(() =>
        expect(calls.filter((call) => call.path === `${PLANNING}/proposals`).length).toBeGreaterThan(2),
      );
    },
    SLOW,
  );

  it('droits : sans la permission de planifier, aucun appel et un message neutre', async () => {
    session.set(sessionBody(['support_agent']));
    const { calls } = stubGateway({});
    render(<PlanningScreen />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
