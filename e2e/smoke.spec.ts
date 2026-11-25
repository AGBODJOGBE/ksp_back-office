import { expect, type Page, test } from '@playwright/test';

/*
 * Parcours de fumée sur le site construit, gateway simulée (aucune pile nécessaire en CI).
 * Le parcours réel contre la gateway locale (connexion, double authentification) se joue à part.
 */

const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor = (role: string) =>
  `${segment({ alg: 'ES256' })}.${segment({ roles: [{ role, scopeType: 'global' }] })}.sig`;
const token = tokenFor('super_admin');

const SESSION = {
  status: 'authenticated',
  accessToken: token,
  accessTokenExpiresAt: '2099-01-01T00:15:00Z',
  refreshTokenExpiresAt: '2099-01-01T12:00:00Z',
  sessionId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e10',
  user: {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    status: 'active',
    firstName: 'Koffi',
    lastName: 'Adjovi',
    phone: '+2290197000001',
    email: null,
    emailVerified: false,
    preferredLanguage: 'fr',
    createdAt: '2026-10-21T09:00:00Z',
  },
  profileIncomplete: false,
  activeContext: { type: 'individual', organizationId: null },
};

/** Gateway simulée : session ouverte ou absente, réponses CORS comprises (appels avec cookies). */
async function gateway(page: Page, { signedIn, role = 'super_admin' }: { signedIn: boolean; role?: string }) {
  const session = { ...SESSION, accessToken: tokenFor(role) };
  await page.route('**/api/v1/identity/**', async (route) => {
    const request = route.request();
    const headers = {
      'Access-Control-Allow-Origin': new URL(page.url() || 'http://localhost:3040').origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Content-Type': 'application/json',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/token/refresh')) {
      return signedIn
        ? route.fulfill({ status: 200, headers, body: JSON.stringify(session) })
        : route.fulfill({
            status: 401,
            headers,
            body: JSON.stringify({
              error: { code: 'IDENTITY_REFRESH_TOKEN_INVALID', message: 'Session expirée.', details: {} },
            }),
          });
    }
    if (path.endsWith('/me')) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ user: SESSION.user, profileIncomplete: false, pendingEmail: null }),
      });
    }
    return route.fulfill({ status: 404, headers, body: '{}' });
  });
}

test('sans session, une page protégée renvoie vers la connexion en gardant la page demandée', async ({
  page,
}) => {
  await gateway(page, { signedIn: false });
  await page.goto('/finance');
  await expect(page).toHaveURL(/\/connexion\?retour=%2Ffinance$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion au back-office' })).toBeVisible();
});

test('avec une session, Ma journée s’affiche avec le menu filtré par rôle', async ({ page, isMobile }) => {
  await gateway(page, { signedIn: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Ma journée' })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Modules' });
  await expect(menu.getByRole('link', { name: 'Ma journée' })).toHaveAttribute('aria-current', 'page');
  await menu.getByRole('link', { name: 'Recouvrement' }).click();
  // La racine du module est son tableau de bord (comme « Dossiers » pour le Nettoyage).
  await expect(page).toHaveURL(/\/recouvrement$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByText('Koffi Adjovi').first()).toBeAttached();
});

test('un module d’une phase suivante n’est pas accessible', async ({ page }) => {
  const response = await page.goto('/marketplace');
  expect(response?.status()).toBe(404);
});

test('l’outil interne n’est jamais indexé', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
  const home = await request.get('/');
  expect(home.headers()['x-robots-tag']).toBe('noindex, nofollow');
  const login = await request.get('/connexion');
  expect(login.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(await login.text()).toContain('<meta name="robots" content="noindex, nofollow');
});

test('la sonde de santé répond', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(await response.json()).toMatchObject({ status: 'ok', site: 'backoffice' });
});

const PARAMETER = {
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da001',
  code: 'superficie',
  label: 'Superficie',
  kind: 'number',
  unit: 'm²',
  min: 0,
  max: 5000,
  choices: [],
  required: true,
  help: null,
  active: true,
  updatedAt: '2026-11-20T09:00:00Z',
  updatedBy: null,
  updatedByName: null,
};

test('Nettoyage v2 : catalogue dans l’ordre de construction, onglets du parcours selon le rôle', async ({
  page,
}) => {
  await gateway(page, { signedIn: true, role: 'cleaning_admin' });
  await page.route('**/api/v1/admin/cleaning/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': new URL(page.url() || 'http://localhost:3040').origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/admin/cleaning/parameters')
      ? { data: [PARAMETER], nextCursor: null, total: 1 }
      : { data: [], nextCursor: null, total: 0 };
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
  await page.goto('/nettoyage/catalogue');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Sections du Nettoyage' });
  await expect(tabs.getByRole('link', { name: 'Catalogue' })).toHaveAttribute('aria-current', 'page');
  await expect(tabs.getByRole('link', { name: 'Réglages' })).toBeVisible();
  // Catégories : première étape encore vide.
  await expect(page.getByText('À faire ensuite')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Étapes du catalogue' })
    .getByRole('link', { name: /Paramètres/ })
    .click();
  await expect(page.getByRole('link', { name: 'Superficie' })).toBeVisible();
  // Plus aucune page provisoire : la file des dossiers et celle des réclamations sont lues.
  await page.goto('/nettoyage');
  await expect(page.getByRole('heading', { level: 1, name: 'Dossiers' })).toBeVisible();
  await expect(page.getByText('Aucun dossier pour l’instant.')).toBeVisible();
  await expect(page.getByText('Bientôt disponible')).toHaveCount(0);
  await tabs.getByRole('link', { name: 'Réclamations' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Réclamations' })).toBeVisible();
  await expect(page.getByText('Aucune réclamation pour l’instant.')).toBeVisible();
});

const ACCOUNT = {
  userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0002',
  status: 'active',
  firstName: 'Awa',
  lastName: 'Dossou',
  phone: null,
  phoneMasked: '+229********45',
  createdAt: '2026-10-19T12:00:00Z',
  suspendedAt: null,
  suspensionReason: null,
  roles: ['cleaning_agent'],
};

test('Administration : l’équipe s’affiche, la fiche ouvre les rôles du périmètre', async ({ page }) => {
  await gateway(page, { signedIn: true, role: 'cleaning_admin' });
  await page.route('**/api/v1/admin/identity/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': new URL(page.url() || 'http://localhost:3040').origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/accounts/search')
      ? { data: [ACCOUNT], nextCursor: null }
      : path.endsWith('/roles')
        ? { data: [] }
        : {
            account: ACCOUNT,
            mfa: { configured: false, configuredAt: null, recoveryCodesRemaining: 0 },
            roles: [
              {
                id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0b01',
                roleCode: 'cleaning_agent',
                roleDescription: 'Agent de terrain du nettoyage',
                service: 'cleaning',
                scopeType: 'domain',
                scopeId: 'cleaning',
                grantedAt: '2026-10-20T07:00:00Z',
                grantedBy: null,
                grantedByName: null,
                grantReason: null,
                revokedAt: null,
                revokedBy: null,
                revokedByName: null,
                revokeReason: null,
                revocable: true,
              },
            ],
            history: [],
            actions: { grantRole: true, suspend: false, reactivate: false, resetMfa: false },
          };
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
  await page.goto('/administration');
  await expect(page).toHaveURL(/\/administration\/comptes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Comptes et rôles' })).toBeVisible();
  await page.getByRole('link', { name: 'Awa Dossou' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Awa Dossou' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirer le rôle Agent du Nettoyage' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attribuer un rôle' })).toBeVisible();
  await expect(page.getByText(/Pas encore configurée/)).toBeVisible();
});

const DELIVERY = {
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d6101',
  templateCode: 'cleaning.quote_requested.customer',
  requestedChannel: 'whatsapp',
  channelUsed: null,
  channelsTried: ['whatsapp', 'email'],
  targetMasked: '+229********45',
  recipientUserId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  status: 'failed',
  errorCode: 'NOTIFICATION_CHANNELS_EXHAUSTED',
  failureReason: 'provider_unavailable',
  providerMessageId: null,
  createdAt: '2026-11-05T09:30:00Z',
  expiresAt: null,
  acceptedAt: null,
  failedAt: '2026-11-05T09:30:02Z',
  erased: false,
};

test('Notifications : historique filtré, détail d’un envoi, modèles (support client)', async ({ page }) => {
  await gateway(page, { signedIn: true, role: 'support_agent' });
  const queries: string[] = [];
  await page.route('**/api/v1/admin/notification/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': new URL(page.url() || 'http://localhost:3040').origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/templates')
      ? {
          data: [
            {
              code: 'cleaning.quote_requested.customer',
              kind: 'short',
              channels: ['whatsapp', 'email'],
              secret: false,
              optional: true,
              variables: ['first_name', 'link'],
              optionalVariables: ['service_name'],
              subject: 'Demande de devis reçue',
              text: 'Bonjour {first_name},\nNous avons bien reçu votre demande.',
            },
          ],
        }
      : url.pathname.endsWith(`/deliveries/${DELIVERY.id}`)
        ? DELIVERY
        : (queries.push(url.search), { data: [DELIVERY], nextCursor: null });
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });

  await page.goto('/notifications');
  await expect(page).toHaveURL(/\/notifications\/envois$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Historique des envois' })).toBeVisible();
  await page.getByLabel('Statut').selectOption('failed');
  await expect(page).toHaveURL(/etat=failed/);
  await expect.poll(() => queries.at(-1)).toContain('status=failed');
  await page.getByRole('link', { name: 'cleaning.quote_requested.customer' }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Envoi « cleaning\.quote_requested/ }),
  ).toBeVisible();
  await expect(page.getByText(/prestataire indisponible/)).toBeVisible();

  await page.goto('/notifications/modeles');
  await expect(page.getByRole('heading', { level: 1, name: 'Modèles de messages' })).toBeVisible();
  await expect(page.getByText('Demande de devis reçue')).toBeVisible();
});
