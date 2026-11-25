import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  cleaningType,
  errorBody,
  ids,
  offer,
  ok,
  page,
  parameter,
  place,
  roomsParameter,
  simulation,
  stateParameter,
  stubGateway,
} from '@/features/cleaning/fake-gateway.test-utils';
import { cleaningRequest, quote, requestIds, visit } from '@/features/cleaning/requests-fixtures.test-utils';
import { RequestDetail } from './request-detail';

const REQUEST = `${ADMIN}/requests/${requestIds.request}`;
const QUOTE = `${ADMIN}/quotes/${requestIds.quote}`;

beforeEach(() => session.set(sessionBody(['cleaning_supervisor'])));
afterEach(() => vi.unstubAllGlobals());

const catalog = {
  [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), stateParameter()]),
  [`GET ${ADMIN}/place-types/${ids.place}`]: ok(place()),
  [`GET ${ADMIN}/offers`]: page([offer()]),
  [`GET ${ADMIN}/cleaning-types`]: page([cleaningType()]),
};

const done = visit({
  status: 'completed',
  completedAt: '2026-11-28T09:50:00Z',
  observedValues: { superficie: 170, etat: 'normal' },
});

describe('fiche dossier : version retenue', () => {
  it('estimation après une pause de saisie, motif d’écart, enregistrement', async () => {
    const before = cleaningRequest({ retained: null, quoteHistory: [], visits: [done] });
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: ok(before),
      ...catalog,
      [`POST ${REQUEST}/retained-values/estimate`]: ok(simulation().pricing),
      [`PUT ${REQUEST}/retained-values`]: ok(cleaningRequest({ visits: [done], quoteHistory: [] })),
    });
    render(<RequestDetail id={requestIds.request} />);
    expect(await screen.findByText('Ajuster le constat de l’agent (version retenue).')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster la version retenue' }));
    const form = await screen.findByRole('form', { name: 'Ajuster la version retenue' });
    const area = await within(form).findByLabelText('Superficie (m²)');
    expect(area).toHaveValue('170');

    fireEvent.change(area, { target: { value: '18' } });
    fireEvent.change(area, { target: { value: '180' } });
    expect(await within(form).findByText('Prix complet', {}, { timeout: 3000 })).toBeInTheDocument();
    const estimates = () => calls.filter((call) => call.path.endsWith('/estimate'));
    await waitFor(() => expect(estimates().at(-1)?.body).toMatchObject({ values: { superficie: 180 } }));
    expect(
      estimates().some((call) => (call.body as { values: { superficie: number } }).values.superficie === 18),
    ).toBe(false);

    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer la version retenue' }));
    const reason = within(form).getByLabelText('Motif de l’écart : Superficie');
    await waitFor(() => expect(reason).toHaveAttribute('aria-invalid', 'true'));
    fireEvent.change(reason, { target: { value: 'Mesure sur place' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer la version retenue' }));
    expect(await screen.findByText(/^Révision 1, du/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      values: { superficie: 180, etat: 'normal' },
      cleaningTypeIds: [ids.floor],
      reasons: [{ parameterCode: 'superficie', cleaningTypeId: null, reason: 'Mesure sur place' }],
    });
  });
});

describe('fiche dossier : devis', () => {
  it('brouillon composé puis envoyé après confirmation', async () => {
    const draft = quote({ adjustments: [] });
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: [
        ok(cleaningRequest({ quoteHistory: [] })),
        ok(cleaningRequest({ quoteHistory: [draft] })),
        ok(
          cleaningRequest({
            status: 'quote_sent',
            quoteHistory: [],
            currentQuote: quote({ status: 'sent', sentAt: '2026-11-29T10:00:00Z' }),
          }),
        ),
      ],
      [`POST ${REQUEST}/quotes`]: ok(draft),
      [`POST ${QUOTE}/send`]: ok(quote({ status: 'sent' })),
    });
    render(<RequestDetail id={requestIds.request} />);
    expect(
      await screen.findByText('Vérifier la version retenue puis composer le devis.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Composer le devis' }));
    const form = screen.getByRole('form', { name: 'Composer le devis' });
    expect(within(form).getByText(/réservées à l’administration/)).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Taille d’équipe — facultatif'), { target: { value: '2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le brouillon' }));
    expect(
      await screen.findByText('Relire le brouillon de devis puis l’envoyer au client.'),
    ).toBeInTheDocument();
    const created = calls.find((call) => call.path.endsWith('/quotes'));
    expect(created?.body).toEqual({ teamSize: 2 });
    expect(created?.headers['Idempotency-Key']).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le devis' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer ce devis au client ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Devis envoyé au client.')).toBeInTheDocument();
    expect(await screen.findByText('Devis envoyé : en attente de la réponse du client.')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/send'))?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('envoi refusé : message métier de la gateway dans la boîte', async () => {
    stubGateway({
      [`GET ${REQUEST}`]: ok(cleaningRequest({ quoteHistory: [quote({ adjustments: [] })] })),
      [`POST ${QUOTE}/send`]: {
        status: 422,
        body: errorBody('CLEANING_PRICE_NOT_SET', 'Fixez le prix des offres « sur devis » avant l’envoi.'),
      },
    });
    render(<RequestDetail id={requestIds.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer le devis' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer ce devis au client ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Fixez le prix des offres « sur devis » avant l’envoi.',
    );
  });

  it('remise en attente : envoi bloqué ; validation et modification par un administrateur', async () => {
    stubGateway({ [`GET ${REQUEST}`]: ok(cleaningRequest()) });
    const { unmount: close } = render(<RequestDetail id={requestIds.request} />);
    expect(
      await screen.findByText('La validation est réservée à un administrateur du Nettoyage.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer le devis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider la remise' })).not.toBeInTheDocument();
    close();
    vi.unstubAllGlobals();

    session.set(sessionBody(['cleaning_admin']));
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: ok(cleaningRequest()),
      [`POST ${QUOTE}/approve-adjustment`]: ok(quote()),
      [`PATCH ${QUOTE}`]: ok(quote()),
    });
    render(<RequestDetail id={requestIds.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider la remise' }));
    const dialog = screen.getByRole('dialog', { name: 'Valider la remise de ce devis ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider la remise' }));
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/approve-adjustment'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le brouillon' }));
    const form = screen.getByRole('form', { name: 'Modifier le brouillon' });
    expect(within(form).getByLabelText('Pourcentage (%)')).toHaveValue('25');
    fireEvent.change(within(form).getByLabelText('Pourcentage (%)'), { target: { value: '10' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true));
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toMatchObject({
      teamSize: 1,
      durationMinutes: 120,
      adjustments: [{ kind: 'discount', percentBps: 1000, reason: 'Client fidèle' }],
    });
    expect(patch?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('montants masqués sans le droit de les voir', async () => {
    const hidden = quote({
      adjustments: [],
      lines: [{ ...quote().lines[0], unitPrice: undefined, amount: undefined }],
      sessionPrice: undefined,
      total: undefined,
      visitFeeDeduction: undefined,
    });
    stubGateway({ [`GET ${REQUEST}`]: ok(cleaningRequest({ quoteHistory: [hidden] })) });
    render(<RequestDetail id={requestIds.request} />);
    const draft = await screen.findByRole('article', { name: 'Brouillon' });
    expect(within(draft).getAllByText('Montant masqué').length).toBeGreaterThanOrEqual(3);
  });
});
