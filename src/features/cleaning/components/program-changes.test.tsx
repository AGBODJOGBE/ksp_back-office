import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  cleaningType,
  ids,
  offer,
  ok,
  page,
  parameter,
  place,
  roomsParameter,
  stubGateway,
} from '@/features/cleaning/fake-gateway.test-utils';
import {
  cleaningSession,
  program,
  programIds,
  suspendedProgram,
} from '@/features/cleaning/programs-fixtures.test-utils';
import { quote, requestIds } from '@/features/cleaning/requests-fixtures.test-utils';
import { ProgramDetail } from './program-detail';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

const PROGRAM = `${ADMIN}/programs/${programIds.program}`;
const SLOW = 15_000;
const windows = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8de003';
const panes = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da005';
const panesParameter = () =>
  parameter({ id: panes, code: 'fenetres', label: 'Fenêtres', unit: null, max: 100, required: true });

beforeEach(() => session.set(sessionBody(['cleaning_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('programme : avenant et reprise', () => {
  it(
    'avenant : type ajouté et ses paramètres, brouillon créé, lien vers le dossier',
    async () => {
      const { calls } = stubGateway({
        [`GET ${PROGRAM}`]: ok(program()),
        [`GET ${PROGRAM}/sessions`]: page([cleaningSession()]),
        [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), panesParameter()]),
        [`GET ${ADMIN}/place-types/${ids.place}`]: ok(place()),
        [`GET ${ADMIN}/offers`]: page([
          offer(),
          offer({
            id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8df002',
            cleaningTypeId: windows,
            extraParameters: [{ parameterId: panes, code: 'fenetres', order: 0 }],
          }),
        ]),
        [`GET ${ADMIN}/cleaning-types`]: page([
          cleaningType(),
          cleaningType({ id: windows, code: 'vitres', name: 'Vitres' }),
        ]),
        [`POST ${PROGRAM}/amendments`]: ok(quote({ kind: 'amendment', programId: programIds.program })),
      });
      render(<ProgramDetail id={programIds.program} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Préparer un avenant' }));
      const form = await screen.findByRole('region', { name: 'Préparer un avenant' });
      const types = await within(form).findByRole('group', { name: /Types de nettoyage à ajouter/ });
      expect(within(types).queryByLabelText('Sol')).toBeNull();
      fireEvent.click(within(form).getByRole('button', { name: 'Créer le brouillon d’avenant' }));
      expect(
        await within(form).findByText('Choisissez un type à ajouter ou des séances à ajouter.'),
      ).toBeInTheDocument();
      fireEvent.click(within(types).getByLabelText('Vitres'));
      expect(within(form).getByLabelText(/Fenêtres/)).toBeInTheDocument();
      fireEvent.change(within(form).getByLabelText(/Fenêtres/), { target: { value: '4' } });
      fireEvent.change(within(form).getByLabelText('Validité en jours (facultatif)'), {
        target: { value: '10' },
      });
      fireEvent.click(within(form).getByRole('button', { name: 'Créer le brouillon d’avenant' }));
      expect(
        await screen.findByText(/Brouillon d’avenant créé sur le dossier DN-000124/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Ouvrir le dossier pour le vérifier et l’envoyer' }),
      ).toHaveAttribute('href', `/nettoyage/dossiers/${requestIds.request}`);
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.body).toEqual({
        addCleaningTypeIds: [windows],
        values: { fenetres: 4 },
        validityDays: 10,
      });
      expect(post?.headers['Idempotency-Key']).toBeTruthy();
    },
    SLOW,
  );

  it('lever la suspension de KSP : séances à rattraper proposées', async () => {
    const catchUp = [
      {
        sessionId: programIds.session,
        rank: 4,
        previousStart: '2026-11-23T08:00:00Z',
        suggestedStart: '2026-11-30T08:00:00Z',
      },
      { sessionId: programIds.next, rank: 5, previousStart: '2026-11-26T08:00:00Z', suggestedStart: null },
    ];
    const { calls } = stubGateway({
      [`GET ${PROGRAM}`]: ok(suspendedProgram()),
      [`GET ${PROGRAM}/sessions`]: page([cleaningSession({ status: 'suspended' })]),
      [`POST ${PROGRAM}/resume`]: ok({
        program: suspendedProgram({
          suspensionCauses: [{ cause: 'overdue_sessions', since: '2026-11-19T09:00:00Z', reason: null }],
        }),
        catchUp,
      }),
    });
    render(<ProgramDetail id={programIds.program} />);
    expect(await screen.findByText(/Programme suspendu : l’horaire ne peut pas changer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Préparer un avenant' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lever la suspension de KSP' }));
    const dialog = screen.getByRole('dialog', { name: 'Lever la suspension décidée par KSP' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lever la suspension' }));
    expect(await screen.findByText(/le programme reste suspendu pour une autre cause/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({});
    expect(screen.getByText(/Séance 5 prévue le .* aucune date libre trouvée/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir la séance 4' })).toHaveAttribute(
      'href',
      `/nettoyage/programmes/${programIds.program}/seances/${programIds.session}`,
    );
    expect(screen.queryByRole('button', { name: 'Lever la suspension de KSP' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeInTheDocument();
  });
});
