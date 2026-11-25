import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, errorBody, ok, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { cleaningSession, programIds } from '@/features/cleaning/programs-fixtures.test-utils';
import { SessionDetail } from './session-detail';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

const SESSION = `${ADMIN}/sessions/${programIds.session}`;
const SLOW = 15_000;

const posts = (calls: { method: string; body: unknown; headers: Record<string, string> }[]) =>
  calls.filter((call) => call.method === 'POST');

function renderSession(body: unknown, extra: Record<string, unknown> = {}) {
  const gateway = stubGateway({ [`GET ${SESSION}`]: ok(body), ...(extra as Record<string, never>) });
  render(<SessionDetail programId={programIds.program} sessionId={programIds.session} />);
  return gateway;
}

/** Ouvre la boîte d'un geste et la renvoie. */
async function openDialog(button: string, title: string) {
  fireEvent.click(await screen.findByRole('button', { name: button }));
  return screen.getByRole('dialog', { name: title });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('séance : détail', () => {
  it('créneau, paiement, équipe et lien vers le planning du jour, photos, liste de contrôle', async () => {
    renderSession(cleaningSession());
    expect(await screen.findByRole('heading', { name: 'Séance 4 / 24', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PN-000057' })).toHaveAttribute(
      'href',
      `/nettoyage/programmes/${programIds.program}`,
    );
    expect(screen.getByText('À payer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Koffi TEST' })).toHaveAttribute(
      'href',
      `/nettoyage/equipe/agents/${programIds.koffi}`,
    );
    expect(screen.getByRole('link', { name: 'Ouvrir le planning de ce jour' })).toHaveAttribute(
      'href',
      '/nettoyage/planning?vue=jour&date=2026-11-26',
    );
    expect(screen.getByRole('link', { name: 'Avant 1' })).toHaveAttribute(
      'href',
      'https://files.test/avant-1.jpg',
    );
    expect(screen.getByText('Sols lavés')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déplacer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprendre la séance' })).toBeNull();
  });

  it('séance réalisée : aucun geste ; support : lecture seule, pas de retrait de photo', async () => {
    renderSession(cleaningSession({ status: 'completed', paymentStatus: 'paid' }));
    expect(await screen.findByText('Séance close : plus aucun geste possible.')).toBeInTheDocument();
    cleanup();
    vi.unstubAllGlobals();
    session.set(sessionBody(['support_agent']));
    renderSession(cleaningSession());
    expect(await screen.findByText(/Lecture seule : les gestes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retirer la photo/ })).toBeNull();
  });
});

describe('séance : gestes', () => {
  it(
    'déplacer : contrôles, conflit refusé par la gateway, envoi',
    async () => {
      const { calls } = renderSession(cleaningSession(), {
        [`POST ${SESSION}/reschedule`]: [
          {
            status: 409,
            body: errorBody('CLEANING_RESCHEDULE_OVERLAP', 'Ce créneau chevauche une autre séance.'),
          },
          ok(
            cleaningSession({ scheduledStart: '2026-11-28T09:00:00Z', scheduledEnd: '2026-11-28T12:00:00Z' }),
          ),
        ],
      });
      const dialog = await openDialog('Déplacer', 'Déplacer la séance');
      fireEvent.change(within(dialog).getByLabelText('Nouveau début'), {
        target: { value: '2026-11-20T10:00' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Déplacer la séance' }));
      expect(
        await within(dialog).findByText('Le nouveau début doit être dans le futur.'),
      ).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Nouveau début'), {
        target: { value: '2026-11-28T10:00' },
      });
      fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Demande du client' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Déplacer la séance' }));
      expect(await within(dialog).findByText('Ce créneau chevauche une autre séance.')).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText(/Durée/), { target: { value: '120' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Déplacer la séance' }));
      expect(await screen.findByText('Séance mise à jour.')).toBeInTheDocument();
      expect(posts(calls).at(-1)?.body).toEqual({
        newStart: '2026-11-28T09:00:00.000Z',
        reason: 'Demande du client',
        durationMinutes: 120,
      });
    },
    SLOW,
  );

  it('annuler : origine « client, moins de 24 h avant »', async () => {
    const { calls } = renderSession(cleaningSession(), {
      [`POST ${SESSION}/cancel`]: ok(cleaningSession({ status: 'cancelled' })),
    });
    const dialog = await openDialog('Annuler la séance', 'Annuler la séance');
    fireEvent.change(within(dialog).getByLabelText('Origine'), { target: { value: 'customer_late' } });
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Appel du client à 7 h' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler la séance' }));
    expect(await screen.findByText('Séance close : plus aucun geste possible.')).toBeInTheDocument();
    expect(posts(calls)[0]?.body).toEqual({ initiatedBy: 'customer_late', reason: 'Appel du client à 7 h' });
    expect(posts(calls)[0]?.headers['Idempotency-Key']).toBeTruthy();
  });

  it(
    'clôturer pour l’équipe : agents présents obligatoires, fin dans le passé',
    async () => {
      const { calls } = renderSession(cleaningSession(), {
        [`POST ${SESSION}/complete`]: ok(cleaningSession({ status: 'completed' })),
      });
      const dialog = await openDialog('Clôturer pour l’équipe', 'Clôturer la séance pour l’équipe');
      fireEvent.click(within(dialog).getByLabelText('Koffi TEST'));
      fireEvent.click(within(dialog).getByLabelText('Awa TEST'));
      fireEvent.change(within(dialog).getByLabelText('Motif'), {
        target: { value: 'Téléphone de l’agent en panne' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer la séance' }));
      expect(await within(dialog).findByText('Cochez au moins un agent présent.')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByLabelText('Koffi TEST'));
      fireEvent.change(within(dialog).getByLabelText('Fin réelle'), {
        target: { value: '2026-11-27T12:00' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer la séance' }));
      expect(await within(dialog).findByText('La fin ne peut pas être dans le futur.')).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Fin réelle'), {
        target: { value: '2026-11-26T12:00' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer la séance' }));
      expect(await screen.findByText('Séance mise à jour.')).toBeInTheDocument();
      expect(posts(calls)[0]?.body).toEqual({
        reason: 'Téléphone de l’agent en panne',
        startedAt: '2026-11-26T08:00:00.000Z',
        completedAt: '2026-11-26T11:00:00.000Z',
        presentAgentIds: [programIds.koffi],
      });
    },
    SLOW,
  );

  it('client absent : cause, heure du constat, agents présents', async () => {
    const { calls } = renderSession(cleaningSession(), {
      [`POST ${SESSION}/missed`]: ok(cleaningSession({ status: 'missed' })),
    });
    const dialog = await openDialog('Client absent', 'Client absent ou accès impossible');
    fireEvent.change(within(dialog).getByLabelText('Cause'), { target: { value: 'access_impossible' } });
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Portail fermé' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’absence' }));
    expect(await screen.findByText('Séance close : plus aucun geste possible.')).toBeInTheDocument();
    expect(posts(calls)[0]?.body).toEqual({
      reason: 'Portail fermé',
      cause: 'access_impossible',
      missedAt: '2026-11-26T12:00:00.000Z',
      presentAgentIds: [programIds.koffi, programIds.awa],
    });
  });

  it('reprendre une séance interrompue, motif facultatif', async () => {
    const { calls } = renderSession(cleaningSession({ status: 'interrupted' }), {
      [`POST ${SESSION}/resume`]: ok(cleaningSession({ status: 'in_progress' })),
    });
    expect(await screen.findByRole('button', { name: 'Clôturer pour l’équipe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Client absent' })).toBeNull();
    const dialog = await openDialog('Reprendre la séance', 'Reprendre la séance interrompue');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reprendre' }));
    expect(await screen.findByText('Séance mise à jour.')).toBeInTheDocument();
    expect(posts(calls)[0]?.body).toEqual({});
    expect(screen.queryByRole('button', { name: 'Reprendre la séance' })).toBeNull();
  });

  it('retrait d’une photo confirmé ; dernière photo « avant » refusée sans remplacement', async () => {
    renderSession(cleaningSession(), {
      [`POST ${SESSION}/photos/${programIds.photo}/remove`]: [
        { status: 422, body: errorBody('CLEANING_PHOTOS_MISSING', 'Ajoutez une photo de remplacement.') },
        ok(cleaningSession({ photos: [] })),
      ],
    });
    const dialog = await openDialog('Retirer la photo Avant 1', 'Retirer la photo');
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Photo confidentielle' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer la photo' }));
    expect(await within(dialog).findByText('Ajoutez une photo de remplacement.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer la photo' }));
    expect(await screen.findByText('Aucune photo.')).toBeInTheDocument();
  });
});
