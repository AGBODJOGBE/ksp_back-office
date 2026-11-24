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
  tariff,
  xof,
  zone,
} from '@/features/cleaning/fake-gateway.test-utils';
import { OfferDetail } from './offers';
import { Simulator } from './simulator';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/catalogue/offres',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

const TARIFFS = `${ADMIN}/offers/${ids.offer}/tariffs`;
const catalog = {
  [`GET ${ADMIN}/place-types`]: page([place()]),
  [`GET ${ADMIN}/cleaning-types`]: page([cleaningType()]),
  [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), stateParameter()]),
};
const draft = tariff({
  id: ids.tariffDraft,
  version: 2,
  status: 'draft',
  minimum: xof(16000),
  publishedAt: null,
  publishedBy: null,
  publishedByName: null,
});

describe('tarif d’une offre', () => {
  it('préparer un brouillon depuis la version en vigueur, l’essayer, puis le publier après confirmation', async () => {
    const { calls } = stubGateway({
      ...catalog,
      [`GET ${ADMIN}/offers/${ids.offer}`]: [
        ok(offer()),
        ok(offer({ draftTariffVersion: 2 })),
        ok(offer({ currentTariffVersion: 2 })),
      ],
      [`GET ${TARIFFS}`]: [
        page([tariff()]),
        page([tariff({ id: ids.tariffDraft, version: 2 }), tariff({ status: 'archived' })]),
      ],
      [`POST ${TARIFFS}`]: ok(draft),
      [`POST ${TARIFFS}/2/publish`]: [
        {
          status: 422,
          body: errorBody('CLEANING_TARIFF_INCOMPLETE', 'Ce tarif est incomplet ou incohérent.', {
            reason: 'brackets_gap',
            index: 1,
          }),
        },
        ok(tariff({ id: ids.tariffDraft, version: 2 })),
      ],
    });
    render(<OfferDetail id={ids.offer} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sol · Villa' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Version 1 en vigueur' })).toBeInTheDocument();
    expect(screen.getByText('De 0 à 50 m²')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Préparer un nouveau tarif' }));
    const minimum = screen.getByLabelText('Prix minimum d’une séance (FCFA)');
    expect(minimum).toHaveValue('15000');
    fireEvent.change(minimum, { target: { value: '16000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon enregistré.')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST' && call.path === TARIFFS);
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    expect(post?.body).toEqual({
      baseParameterCode: 'superficie',
      brackets: [
        { from: 0, to: 50, mode: 'flat', amount: xof(10000) },
        { from: 51, to: 150, mode: 'per_unit', amount: xof(180) },
      ],
      supplements: [{ parameterCode: 'chambres', mode: 'per_unit', amount: xof(1500), includedUnits: 3 }],
      minimum: xof(16000),
      frequencyCoefficients: [{ key: 'weekly', coefficientBps: 9000 }],
    });

    expect(screen.getByRole('link', { name: 'Essayer ce brouillon au simulateur' })).toHaveAttribute(
      'href',
      `/nettoyage/catalogue/simulateur?lieu=${ids.place}&types=${ids.floor}&brouillons=${ids.tariffDraft}`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publier ce tarif' }));
    const dialog = screen.getByRole('dialog', { name: 'Publier la version 2 ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Il manque des valeurs avant la tranche n° 2 : elle doit commencer juste après la précédente.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    expect(await screen.findByText('Version 2 publiée.')).toBeInTheDocument();
    const publishes = calls.filter((call) => call.path === `${TARIFFS}/2/publish`);
    expect(publishes).toHaveLength(2);
    // Refus définitif (422) : la clé est renouvelée pour le nouvel essai.
    expect(publishes[1]?.headers['Idempotency-Key']).not.toBe(publishes[0]?.headers['Idempotency-Key']);
    expect(await screen.findByRole('heading', { name: 'Version 2 en vigueur' })).toBeInTheDocument();
  });

  it('brouillon existant : modifié par PUT ; refus d’un champ placé sous la tranche', async () => {
    const { calls } = stubGateway({
      ...catalog,
      [`GET ${ADMIN}/offers/${ids.offer}`]: ok(offer({ draftTariffVersion: 2 })),
      [`GET ${TARIFFS}`]: page([draft, tariff()]),
      [`PUT ${TARIFFS}/2`]: {
        status: 400,
        body: errorBody('CLEANING_VALIDATION_FAILED', 'Cette valeur est hors des bornes autorisées.', {
          field: 'brackets[1].to',
          reason: 'out_of_range',
        }),
      },
    });
    render(<OfferDetail id={ids.offer} />);
    expect(await screen.findByRole('heading', { name: 'Brouillon v2' })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Enregistrer le brouillon' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('À (inclus)', { selector: '#tarif-tranche-1-a' }), {
      target: { value: '1500000' },
    });
    fireEvent.click(save);
    // Contrôle local : bornes entières de 0 à 1 000 000.
    expect(await screen.findByText('Entre 0 et 1000000.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);

    fireEvent.change(screen.getByLabelText('À (inclus)', { selector: '#tarif-tranche-1-a' }), {
      target: { value: '300' },
    });
    fireEvent.click(save);
    expect(await screen.findByText('Cette valeur est hors des bornes autorisées.')).toBeInTheDocument();
    expect(screen.getByLabelText('À (inclus)', { selector: '#tarif-tranche-1-a' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.headers['Idempotency-Key']).toBeUndefined();
    expect((put?.body as { brackets: { to: number }[] }).brackets[1]?.to).toBe(300);
  });

  it('superviseur : tarif en lecture, ni préparation ni publication', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({
      ...catalog,
      [`GET ${ADMIN}/offers/${ids.offer}`]: ok(offer({ draftTariffVersion: 2 })),
      [`GET ${TARIFFS}`]: page([draft, tariff()]),
    });
    render(<OfferDetail id={ids.offer} />);
    expect(await screen.findByRole('heading', { name: 'Brouillon v2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publier ce tarif' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Essayer ce brouillon au simulateur' })).toBeInTheDocument();
  });
});

describe('simulateur', () => {
  it('prérempli par l’adresse : brouillon coché, calcul du serveur affiché ligne par ligne', async () => {
    search = `lieu=${ids.place}&types=${ids.floor}&brouillons=${ids.tariffDraft}`;
    const { calls } = stubGateway({
      ...catalog,
      [`GET ${ADMIN}/zones`]: page([zone()]),
      [`GET ${ADMIN}/offers`]: page([offer({ draftTariffVersion: 2 })]),
      [`GET ${TARIFFS}`]: page([draft, tariff()]),
      [`POST ${ADMIN}/simulations`]: ok(simulation()),
    });
    render(<Simulator />);
    expect(await screen.findByLabelText('Utiliser le brouillon v2')).toBeChecked();
    expect(screen.getByLabelText(/^Sol/)).toBeChecked();
    fireEvent.change(screen.getByLabelText(/^Superficie/), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(/^Commune/), { target: { value: 'cotonou' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculer' }));

    expect(await screen.findByText('Calculé avec un brouillon')).toBeInTheDocument();
    expect(screen.getByText('Tarif v2 (brouillon)')).toBeInTheDocument();
    expect(screen.getAllByText('Sol, tranche 51 à 150 m²').length).toBeGreaterThan(0);
    expect(screen.getByText('× 1,1')).toBeInTheDocument();
    expect(calls.find((call) => call.path === `${ADMIN}/simulations`)?.body).toEqual({
      placeTypeId: ids.place,
      cleaningTypeIds: [ids.floor],
      values: { superficie: 150 },
      communeKey: 'cotonou',
      draftTariffIds: [ids.tariffDraft],
    });
  });

  it('contrôles locaux : type de nettoyage et programme hebdomadaire incomplet', async () => {
    search = `lieu=${ids.place}`;
    const { calls } = stubGateway({
      ...catalog,
      [`GET ${ADMIN}/zones`]: page([]),
      [`GET ${ADMIN}/offers`]: page([offer()]),
    });
    render(<Simulator />);
    await screen.findByLabelText(/^Sol/);
    fireEvent.change(screen.getByLabelText('Programme', { selector: 'select' }), {
      target: { value: 'weekly' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Calculer' }));
    expect(await screen.findByText('Cochez au moins un type de nettoyage.')).toBeInTheDocument();
    expect(screen.getByText('Cochez au moins un jour.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('refus du serveur (lieu « Autre ») affiché en tête du formulaire', async () => {
    search = `lieu=${ids.place}&types=${ids.floor}`;
    stubGateway({
      ...catalog,
      [`GET ${ADMIN}/zones`]: page([]),
      [`GET ${ADMIN}/offers`]: page([offer()]),
      [`POST ${ADMIN}/simulations`]: {
        status: 400,
        body: errorBody(
          'CLEANING_OFFER_NOT_AVAILABLE',
          'Ce type de nettoyage n’est pas proposé pour ce lieu.',
        ),
      },
    });
    render(<Simulator />);
    await screen.findByLabelText(/^Sol/);
    fireEvent.click(screen.getByRole('button', { name: 'Calculer' }));
    expect(
      await screen.findByText('Ce type de nettoyage n’est pas proposé pour ce lieu.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculer' })).toBeEnabled());
  });
});
