import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  category,
  cleaningType,
  errorBody,
  ids,
  offer,
  ok,
  page,
  parameter,
  place,
  roomsParameter,
  skill,
  stateParameter,
  stubGateway,
} from '@/features/cleaning/fake-gateway.test-utils';
import { CatalogOverview } from './catalog-overview';
import { CategoryDetail } from './categories';
import { NewCleaningType } from './cleaning-types';
import { NewOffer } from './offers';
import { NewParameter, ParameterDetail, ParametersList } from './parameters';
import { NewPlace } from './places';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/catalogue',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

const field = (label: string | RegExp) =>
  screen.getByLabelText(label, { selector: 'input, select, textarea' });

describe('accueil du catalogue', () => {
  it('compte chaque étape et met en avant la première étape vide', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/parameters`]: page([parameter()], null, 3),
      [`GET ${ADMIN}/place-categories`]: page([], null, 0),
      [`GET ${ADMIN}/place-types`]: page([], null, 0),
      [`GET ${ADMIN}/skills`]: page([], null, 0),
      [`GET ${ADMIN}/cleaning-types`]: {
        status: 503,
        body: errorBody('GATEWAY_UNAVAILABLE', 'Indisponible.'),
      },
      [`GET ${ADMIN}/offers`]: page([], null, 0),
    });
    render(<CatalogOverview />);
    const steps = await screen.findAllByRole('listitem');
    expect(steps).toHaveLength(7);
    await waitFor(() => expect(within(steps[0] as HTMLElement).getByText('3 éléments')).toBeInTheDocument());
    // Catégories : première étape vide (les compétences sont facultatives).
    expect(within(steps[1] as HTMLElement).getByText('À faire ensuite')).toBeInTheDocument();
    expect(within(steps[4] as HTMLElement).getByText('Nombre indisponible')).toBeInTheDocument();
    expect(screen.getAllByText('À faire ensuite')).toHaveLength(1);
    expect(calls.every((call) => call.search === '?limit=1')).toBe(true);
    expect(screen.getByRole('link', { name: '1. Paramètres' })).toHaveAttribute(
      'href',
      '/nettoyage/catalogue/parametres',
    );
  });
});

describe('paramètres', () => {
  it('liste avec le bouton « Créer » pour l’administrateur', async () => {
    stubGateway({ [`GET ${ADMIN}/parameters`]: page([parameter(), stateParameter()], 'suite', 12) });
    render(<ParametersList />);
    expect(await screen.findByRole('link', { name: 'Superficie' })).toHaveAttribute(
      'href',
      `/nettoyage/catalogue/parametres/${ids.area}`,
    );
    expect(screen.getAllByText('de 0 à 5000 m² · obligatoire').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 valeurs · obligatoire').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Nouveau paramètre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher plus' })).toBeInTheDocument();
  });

  it('support : lecture seule, sans bouton de création', async () => {
    session.set(sessionBody(['support_agent']));
    stubGateway({ [`GET ${ADMIN}/parameters`]: page([parameter()]) });
    render(<ParametersList />);
    await screen.findByRole('link', { name: 'Superficie' });
    expect(screen.queryByRole('link', { name: 'Nouveau paramètre' })).not.toBeInTheDocument();
  });

  it('création : contrôles locaux, puis envoi avec clé d’idempotence et ouverture de la fiche', async () => {
    const { calls } = stubGateway({ [`POST ${ADMIN}/parameters`]: ok(parameter()) });
    render(<NewParameter />);
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau paramètre' }));
    expect(await screen.findByText('Corrigez les champs signalés.')).toBeInTheDocument();
    expect(field('Libellé')).toHaveAttribute('aria-invalid', 'true');
    expect(field(/^Unité/)).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);

    fireEvent.change(field('Libellé'), { target: { value: 'Superficie' } });
    expect(field('Code')).toHaveValue('superficie');
    fireEvent.change(field(/^Unité/), { target: { value: 'm²' } });
    fireEvent.change(field('Maximum'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau paramètre' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/nettoyage/catalogue/parametres/${ids.area}?cree=1`),
    );
    expect(calls[0]?.body).toEqual({
      label: 'Superficie',
      unit: 'm²',
      max: 5000,
      required: true,
      code: 'superficie',
      kind: 'number',
    });
    expect(calls[0]?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  it('refus de la gateway sur un champ : message sous le champ, nouvelle clé au nouvel essai', async () => {
    const { calls } = stubGateway({
      [`POST ${ADMIN}/parameters`]: [
        {
          status: 409,
          body: errorBody('CLEANING_CODE_ALREADY_USED', 'Ce code est déjà utilisé.', { code: 'etat' }),
        },
        {
          status: 400,
          body: errorBody('CLEANING_VALIDATION_FAILED', 'Ce champ est obligatoire.', {
            field: 'choices[0].label',
            reason: 'required',
          }),
        },
      ],
    });
    render(<NewParameter />);
    fireEvent.change(field('Libellé'), { target: { value: 'État' } });
    fireEvent.click(screen.getByRole('radio', { name: /Choix/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une valeur' }));
    fireEvent.change(screen.getByLabelText('Libellé', { selector: '#parametre-valeur-0-libelle' }), {
      target: { value: 'Normal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau paramètre' }));
    expect(await screen.findByText('Ce code est déjà utilisé.')).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({
      kind: 'choice',
      choices: [{ code: 'normal', label: 'Normal', active: true }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau paramètre' }));
    expect(await screen.findByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(screen.getByLabelText('Libellé', { selector: '#parametre-valeur-0-libelle' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(calls[1]?.headers['Idempotency-Key']).not.toBe(calls[0]?.headers['Idempotency-Key']);
  });

  it('fiche : seuls les champs modifiés sont envoyés ; désactivation confirmée et refus « utilisé »', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/parameters/${ids.area}`]: ok(parameter()),
      [`PATCH ${ADMIN}/parameters/${ids.area}`]: [
        ok(parameter({ label: 'Surface habitable' })),
        {
          status: 422,
          body: errorBody(
            'CLEANING_PARAMETER_IN_USE',
            'Ce paramètre est utilisé par un tarif publié ou un lieu actif : il ne peut être ni resserré, ni privé d’une valeur, ni désactivé.',
            { offerIds: [ids.offer], placeTypeIds: [ids.place] },
          ),
        },
      ],
    });
    render(<ParameterDetail id={ids.area} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Superficie' })).toBeInTheDocument();
    fireEvent.change(field('Libellé'), { target: { value: 'Surface habitable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
    expect(calls[1]?.body).toEqual({ label: 'Surface habitable' });

    // L'en-tête suit l'enregistrement : la fiche porte le nouveau libellé.
    expect(screen.getByRole('heading', { level: 1, name: 'Surface habitable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Surface habitable' }));
    const dialog = screen.getByRole('dialog', { name: 'Désactiver « Surface habitable » ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/utilisé par un tarif publié/);
    expect(calls[2]?.body).toEqual({ active: false });
  });

  it('fiche en lecture seule pour le superviseur ; fiche introuvable', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({ [`GET ${ADMIN}/parameters/${ids.area}`]: ok(parameter()) });
    const { unmount } = render(<ParameterDetail id={ids.area} />);
    expect(await screen.findByText(/Lecture seule/)).toBeInTheDocument();
    expect(field('Libellé')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Désactiver/ })).not.toBeInTheDocument();
    unmount();

    stubGateway({
      [`GET ${ADMIN}/parameters/${ids.area}`]: {
        status: 404,
        body: errorBody('CLEANING_PARAMETER_NOT_FOUND', 'Ce paramètre est introuvable.'),
      },
    });
    render(<ParameterDetail id={ids.area} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
  });

  it('accès refusé par la gateway (403) : note neutre', async () => {
    stubGateway({
      [`GET ${ADMIN}/parameters/${ids.area}`]: {
        status: 403,
        body: errorBody('GATEWAY_FORBIDDEN', 'Accès refusé.'),
      },
    });
    render(<ParameterDetail id={ids.area} />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
  });
});

describe('lieux et offres', () => {
  const catalog = {
    [`GET ${ADMIN}/place-categories`]: page([category()]),
    [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), stateParameter()]),
  };

  it('nouveau lieu : catégorie préremplie, superficie exigée, paramètres dans l’ordre choisi', async () => {
    search = `categorie=${ids.category}`;
    const { calls } = stubGateway({ ...catalog, [`POST ${ADMIN}/place-types`]: ok(place()) });
    render(<NewPlace />);
    expect(await screen.findByLabelText('Catégorie')).toHaveValue(ids.category);
    fireEvent.change(field('Nom'), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByLabelText(/^Chambres/));
    fireEvent.click(screen.getByLabelText(/^Superficie/));
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau lieu' }));
    expect(await screen.findByText('Corrigez les champs signalés.')).toBeInTheDocument();
    expect(field('Paramètre « superficie »')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Monter Superficie' }));
    fireEvent.change(field('Paramètre « superficie »'), { target: { value: ids.area } });
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau lieu' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/nettoyage/catalogue/lieux/${ids.place}?cree=1`),
    );
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      categoryId: ids.category,
      name: 'Villa',
      freeDescription: false,
      parameterIds: [ids.area, ids.rooms],
      areaParameterId: ids.area,
      code: 'villa',
    });
  });

  it('nouvelle offre : lieu prérempli, équipe par tranches (la suivante commence après la précédente)', async () => {
    search = `lieu=${ids.place}`;
    const { calls } = stubGateway({
      [`GET ${ADMIN}/place-types`]: page([place()]),
      [`GET ${ADMIN}/cleaning-types`]: page([
        cleaningType(),
        cleaningType({ id: ids.pack, name: 'Pack', isPack: true }),
      ]),
      [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), stateParameter()]),
      [`POST ${ADMIN}/offers`]: [
        {
          status: 409,
          body: errorBody('CLEANING_CODE_ALREADY_USED', 'Ce code est déjà utilisé.'),
        },
        ok(offer()),
      ],
    });
    render(<NewOffer />);
    expect(await screen.findByLabelText(/^Lieu/)).toHaveValue(ids.place);
    fireEvent.change(field(/^Type de nettoyage/), { target: { value: ids.floor } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une tranche' }));
    fireEvent.change(screen.getByLabelText('À (m²)', { selector: '#offre-tranche-0-a' }), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByLabelText('Durée (min)', { selector: '#offre-tranche-0-duree' }), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une tranche' }));
    expect(screen.getByLabelText('De (m²)', { selector: '#offre-tranche-1-de' })).toHaveValue('151');
    fireEvent.change(screen.getByLabelText('Agents', { selector: '#offre-tranche-1-agents' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Durée (min)', { selector: '#offre-tranche-1-duree' }), {
      target: { value: '180' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle offre' }));
    expect(await screen.findByText('Ce code est déjà utilisé.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle offre' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/nettoyage/catalogue/offres/${ids.offer}?cree=1`),
    );
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts[1]?.body).toEqual({
      extraParameterIds: [],
      teamRule: [
        { fromArea: 0, toArea: 150, agents: 1, durationMinutes: 120 },
        { fromArea: 151, toArea: null, agents: 2, durationMinutes: 180 },
      ],
      placeTypeId: ids.place,
      cleaningTypeId: ids.floor,
    });
  });
});

describe('compétences', () => {
  it('ajout puis renommage', async () => {
    const { SkillsScreen } = await import('./skills');
    const { calls } = stubGateway({
      [`GET ${ADMIN}/skills`]: page([]),
      [`POST ${ADMIN}/skills`]: ok(skill()),
      [`PATCH ${ADMIN}/skills/${ids.skill}`]: ok(skill({ name: 'Intérieur' })),
    });
    render(<SkillsScreen />);
    expect(await screen.findByText('Aucune compétence.')).toBeInTheDocument();
    fireEvent.change(field('Nom'), { target: { value: 'Nettoyage intérieur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une compétence' }));
    expect(await screen.findByRole('cell', { name: 'Nettoyage intérieur' })).toBeInTheDocument();
    expect(calls[1]?.body).toEqual({ code: 'nettoyage_interieur', name: 'Nettoyage intérieur' });

    fireEvent.click(screen.getByRole('button', { name: 'Renommer Nettoyage intérieur' }));
    const dialog = screen.getByRole('dialog', { name: 'Renommer « Nettoyage intérieur »' });
    fireEvent.change(within(dialog).getByLabelText('Nouveau nom'), { target: { value: 'Intérieur' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('cell', { name: 'Intérieur' })).toBeInTheDocument();
    expect(calls[2]?.body).toEqual({ name: 'Intérieur' });
  });
});

describe('catégories et types de nettoyage', () => {
  it('catégorie : frais de visite en FCFA entiers, impossibles à remettre « par défaut » une fois fixés', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/place-categories/${ids.category}`]: ok(category()),
      [`GET ${ADMIN}/place-types`]: page([place()]),
      [`PATCH ${ADMIN}/place-categories/${ids.category}`]: ok(
        category({ visitFee: { amount: 6500, currency: 'XOF' } }),
      ),
    });
    render(<CategoryDetail id={ids.category} />);
    const fee = await screen.findByLabelText('Frais de visite (FCFA)');
    expect(fee).toHaveValue('5000');
    expect(await screen.findByRole('link', { name: 'Villa' })).toHaveAttribute(
      'href',
      `/nettoyage/catalogue/lieux/${ids.place}`,
    );
    fireEvent.change(fee, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Corrigez les champs signalés.')).toBeInTheDocument();
    fireEvent.change(fee, { target: { value: '6 500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      visitFee: { amount: 6500, currency: 'XOF' },
    });
  });

  it('nouveau pack : types contenus et liste de contrôle, sans compétence propre', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/skills`]: page([skill()]),
      [`GET ${ADMIN}/cleaning-types`]: page([cleaningType()]),
      [`POST ${ADMIN}/cleaning-types`]: ok(cleaningType({ id: ids.pack, isPack: true })),
    });
    render(<NewCleaningType />);
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Nettoyage complet' } });
    fireEvent.change(field('Durée de référence (minutes)'), { target: { value: '240' } });
    fireEvent.click(screen.getByLabelText(/^C’est un pack/));
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau type de nettoyage' }));
    expect(await screen.findByText('Choisissez au moins un type.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^Sol/));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un point' }));
    fireEvent.change(field('Point 1'), { target: { value: 'Vérifier les finitions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau type de nettoyage' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/nettoyage/catalogue/types/${ids.pack}?cree=1`),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Nettoyage complet',
      referenceDurationMinutes: 240,
      checklist: [{ code: 'verifier_les_finitions', label: 'Vérifier les finitions', order: 0 }],
      isPack: true,
      packItemIds: [ids.floor],
      code: 'nettoyage_complet',
    });
  });
});
