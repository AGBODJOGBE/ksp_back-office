import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import {
  challengeBody,
  ENROLLMENT,
  errorBody,
  mfaRequiredBody,
  NO_SESSION,
  RECOVERY_CODES,
  sessionBody,
  stubGateway,
} from '@/features/identity/fake-gateway.test-utils';
import { LoginFlow } from './login-flow';

const replace = vi.fn();
let search = 'retour=%2Ffinance';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

// QR code : le calcul réel est testé à part (qr.test.ts).
vi.mock('@/features/identity/qr', () => ({
  qrMatrix: async () => ({ size: 29, path: 'M0 0h1v1h-1z' }),
}));

const REQUEST = 'POST /api/v1/identity/otp/request';
const VERIFY = 'POST /api/v1/identity/otp/verify';
const REFRESH = 'POST /api/v1/identity/token/refresh';
const ENROLL = 'POST /api/v1/identity/mfa/totp/enroll';
const CONFIRM = 'POST /api/v1/identity/mfa/totp/confirm';
const MFA = 'POST /api/v1/identity/mfa/verify';

beforeEach(() => {
  search = 'retour=%2Ffinance';
  replace.mockReset();
  session.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function submitPhone(number = '01 97 00 00 01') {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Numéro' }), { target: { value: number } });
  fireEvent.click(screen.getByRole('button', { name: /Recevoir mon code/ }));
}

async function submitOtp(code = '482913') {
  fireEvent.change(await screen.findByRole('textbox', { name: /Code reçu/ }), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
}

async function submitAppCode(code: string, button = 'Valider') {
  fireEvent.change(await screen.findByRole('textbox', { name: /Code de l’application/ }), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole('button', { name: button }));
}

// Parcours complets : plus longs que la limite par défaut quand toute la suite tourne en parallèle.
const LONG = { timeout: 20_000 };

describe('connexion au back-office : première connexion', () => {
  it(
    'téléphone, code, configuration de l’application, codes de récupération, puis la page demandée',
    LONG,
    async () => {
      const { calls } = stubGateway({
        [REFRESH]: NO_SESSION,
        [REQUEST]: { status: 200, body: challengeBody() },
        [VERIFY]: { status: 200, body: mfaRequiredBody(true) },
        [ENROLL]: { status: 200, body: ENROLLMENT },
        [CONFIRM]: [
          {
            status: 400,
            body: errorBody('IDENTITY_MFA_CODE_INVALID', 'Le code est incorrect.', { attemptsRemaining: 4 }),
          },
          { status: 200, body: { ...sessionBody(), recoveryCodes: RECOVERY_CODES } },
        ],
      });
      render(<LoginFlow />);

      await submitPhone();
      expect(calls.find((call) => call.path.endsWith('/otp/request'))?.body).toEqual({
        phone: '+2290197000001',
      });
      await submitOtp();

      // Configuration : QR code calculé dans la page, clé à saisir à la main, un seul appel d'inscription.
      expect(
        await screen.findByRole('heading', { name: 'Configurez votre application d’authentification' }),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('img', { name: /QR code de configuration pour KSP/ }),
      ).toBeInTheDocument();
      expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
      expect(calls.filter((call) => call.path.endsWith('/totp/enroll'))).toHaveLength(1);
      expect(calls.find((call) => call.path.endsWith('/totp/enroll'))?.body).toEqual({
        mfaToken: 'mfa_2b3c4d5e6f',
      });

      // Code faux : message du contrat, essais restants, champ vidé et focalisé.
      await submitAppCode('000000', 'Activer la double authentification');
      expect(await screen.findByText('Le code est incorrect. Il vous reste 4 essais.')).toBeInTheDocument();
      const field = screen.getByRole('textbox', { name: /Code de l’application/ });
      expect(field).toHaveValue('');
      expect(field).toHaveFocus();

      await submitAppCode('287082', 'Activer la double authentification');
      expect(await screen.findByRole('heading', { name: 'Vos codes de récupération' })).toBeInTheDocument();
      expect(calls.filter((call) => call.path.endsWith('/totp/confirm')).at(-1)?.body).toEqual({
        mfaToken: 'mfa_2b3c4d5e6f',
        code: '287082',
      });
      const list = screen.getByRole('list', { name: 'Codes de récupération' });
      expect(list.querySelectorAll('li')).toHaveLength(10);
      expect(screen.getByText('7KQ2M-X9PDA')).toBeInTheDocument();
      // Pas encore de session en mémoire : l'agent doit d'abord confirmer.
      expect(session.get()).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Accéder au back-office' }));
      expect(
        await screen.findByText('Cochez la case pour confirmer que vos codes sont en lieu sûr.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'J’ai mis mes codes en lieu sûr' })).toHaveFocus();
      expect(replace).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('checkbox', { name: 'J’ai mis mes codes en lieu sûr' }));
      fireEvent.click(screen.getByRole('button', { name: 'Accéder au back-office' }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/finance'));
      expect(session.get()).toMatchObject({ roles: ['super_admin'], user: { firstName: 'Koffi' } });
      expect(session.get()).not.toHaveProperty('recoveryCodes');
    },
  );

  it('copie et télécharge les codes de récupération', LONG, async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: { status: 200, body: mfaRequiredBody(true) },
      [ENROLL]: { status: 200, body: ENROLLMENT },
      [CONFIRM]: { status: 200, body: { ...sessionBody(), recoveryCodes: RECOVERY_CODES } },
    });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const createObjectURL = vi.fn(() => 'blob:codes');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();
    await submitAppCode('287082', 'Activer la double authentification');
    await screen.findByRole('heading', { name: 'Vos codes de récupération' });

    fireEvent.click(screen.getByRole('button', { name: 'Copier les codes' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(RECOVERY_CODES.join('\n')));
    expect(await screen.findAllByText('Codes copiés')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger (.txt)' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = await blob.text();
    expect(text).toContain('Compte : +2290197000001');
    expect(text).toContain('Q8JWD-5AXPZ');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('connexion au back-office : compte déjà configuré', () => {
  it('code de l’application, puis la page demandée', async () => {
    const { calls } = stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: { status: 200, body: mfaRequiredBody(false) },
      [MFA]: { status: 200, body: { ...sessionBody(['finance_officer']), recoveryCodesRemaining: 10 } },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();

    expect(await screen.findByRole('heading', { name: 'Double authentification' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Code de l’application/ })).toHaveFocus();
    await submitAppCode('081804');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/finance'));
    expect(calls.find((call) => call.path.endsWith('/mfa/verify'))?.body).toEqual({
      mfaToken: 'mfa_2b3c4d5e6f',
      method: 'totp',
      code: '081804',
    });
    expect(session.get()?.roles).toEqual(['finance_officer']);
  });

  it('code de récupération en lien secondaire, puis le nombre de codes restants', async () => {
    const { calls } = stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: { status: 200, body: mfaRequiredBody(false) },
      [MFA]: { status: 200, body: { ...sessionBody(), recoveryCodesRemaining: 9 } },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();

    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser un code de récupération' }));
    const field = screen.getByRole('textbox', { name: /Code de récupération/ });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'h4tz8 0rwnc' } });
    expect(field).toHaveValue('H4TZ80RWNC');
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(await screen.findByText('Il vous reste 9 codes de récupération.')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/mfa/verify'))?.body).toMatchObject({
      method: 'recovery_code',
      code: 'H4TZ80RWNC',
    });
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/finance'));
  });

  it('prévient quand il reste peu de codes de récupération', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: { status: 200, body: mfaRequiredBody(false) },
      [MFA]: { status: 200, body: { ...sessionBody(), recoveryCodesRemaining: 2 } },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();
    await submitAppCode('081804');
    expect(await screen.findByText('Il vous reste 2 codes de récupération.')).toBeInTheDocument();
  });

  it('code faux puis jeton expiré : retour au numéro avec l’explication', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: { status: 200, body: mfaRequiredBody(false) },
      [MFA]: [
        {
          status: 400,
          body: errorBody('IDENTITY_MFA_CODE_INVALID', 'Le code est incorrect.', { attemptsRemaining: 1 }),
        },
        {
          status: 401,
          body: errorBody(
            'IDENTITY_MFA_TOKEN_INVALID',
            'L’étape de double authentification a expiré, reconnectez-vous.',
          ),
        },
      ],
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();

    await submitAppCode('000000');
    expect(await screen.findByText('Le code est incorrect. Il vous reste 1 essai.')).toBeInTheDocument();

    await submitAppCode('111111');
    expect(
      await screen.findByText('L’étape de double authentification a expiré, reconnectez-vous.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Numéro' })).toHaveValue('+2290197000001');
    // Le focus est rendu au champ dans un effet, après l'affichage de l'étape.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Numéro' })).toHaveFocus());
    expect(session.get()).toBeNull();
  });
});

describe('connexion au back-office : refus et limites', () => {
  it('affiche clairement le refus d’un compte sans rôle du back-office', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody() },
      [VERIFY]: {
        status: 403,
        body: errorBody('IDENTITY_BACKOFFICE_FORBIDDEN', 'Ce compte n’a pas accès au back-office.'),
      },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();

    expect(await screen.findByRole('heading', { name: 'Accès au back-office refusé' })).toBeInTheDocument();
    expect(screen.getByText('Ce compte n’a pas accès au back-office.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser un autre numéro' }));
    expect(await screen.findByRole('textbox', { name: 'Numéro' })).toHaveValue('');
  });

  it('code reçu expiré : demande d’un nouveau code', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody(60) },
      [VERIFY]: {
        status: 422,
        body: errorBody('IDENTITY_OTP_EXPIRED', 'Le code a expiré, demandez-en un nouveau.'),
      },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();

    expect(await screen.findByText('Le code a expiré, demandez-en un nouveau.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Renvoyer le code' })).toBeEnabled();
  });

  it('trop d’essais sur le code reçu : demande d’un nouveau code', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody(60) },
      [VERIFY]: {
        status: 422,
        body: errorBody('IDENTITY_OTP_TOO_MANY_ATTEMPTS', 'Trop d’essais, demandez un nouveau code.'),
      },
    });
    render(<LoginFlow />);
    await submitPhone();
    await submitOtp();
    expect(await screen.findByText('Trop d’essais, demandez un nouveau code.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
  });

  it('autorise le renvoi du code à la fin du délai indiqué', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 200, body: challengeBody(30) },
    });
    render(<LoginFlow />);
    await submitPhone();

    expect(await screen.findByRole('button', { name: 'Renvoyer le code dans 30 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(31_000));
    fireEvent.click(await screen.findByRole('button', { name: 'Renvoyer le code' }));
    expect(await screen.findByText('Un nouveau code vous a été envoyé.')).toBeInTheDocument();
    expect(calls.filter((call) => call.path.endsWith('/otp/request'))).toHaveLength(2);
  });

  it('montre la référence de la requête quand le serveur est en panne', async () => {
    stubGateway({
      [REFRESH]: NO_SESSION,
      [REQUEST]: { status: 503, body: errorBody('IDENTITY_OTP_SEND_FAILED', 'Envoi impossible.') },
    });
    render(<LoginFlow />);
    await submitPhone();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envoi impossible. Référence à donner au support : 0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e12',
    );
  });

  it('reprend une session encore valide sans rien demander, vers un chemin interne seulement', async () => {
    search = 'retour=https%3A%2F%2Fautre-site.example';
    stubGateway({ [REFRESH]: { status: 200, body: sessionBody() } });
    render(<LoginFlow />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('textbox', { name: 'Numéro' })).toBeNull();
  });
});
