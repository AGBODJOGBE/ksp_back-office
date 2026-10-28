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

test('avec une session, le tableau de bord s’affiche avec le menu filtré par rôle', async ({
  page,
  isMobile,
}) => {
  await gateway(page, { signedIn: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue dans le back-office' })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Modules' });
  await expect(menu.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page');
  await menu.getByRole('link', { name: 'Recouvrement' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recouvrement' })).toBeVisible();
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

const REQUEST = {
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d1001',
  status: 'received',
  customerId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  customerKind: 'individual',
  organizationId: null,
  serviceCode: 'menage_test',
  premisesType: 'apartment',
  quantity: 4,
  options: [],
  commune: 'Cotonou',
  address: 'Rue 12, Akpakpa',
  preferredSlots: [{ start: '2026-11-05T08:00:00Z', end: '2026-11-05T11:00:00Z' }],
  comment: null,
  recurrence: null,
  requestedTeamSize: null,
  daysPerWeek: null,
  recommendedTeamSize: 2,
  estimate: null,
  visit: null,
  quote: null,
  missionId: null,
  closingReason: null,
  createdAt: '2026-10-28T09:00:00Z',
  updatedAt: '2026-10-28T09:00:00Z',
};

test('Nettoyage : la demande reçue s’ouvre avec ses actions, onglets selon le rôle', async ({ page }) => {
  await gateway(page, { signedIn: true, role: 'cleaning_admin' });
  await page.route('**/api/v1/{admin/cleaning,cleaning}/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': new URL(page.url() || 'http://localhost:3040').origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/admin/cleaning/quote-requests')
      ? { data: [REQUEST], nextCursor: null }
      : path.endsWith(`/quote-requests/${REQUEST.id}`)
        ? REQUEST
        : path.endsWith('/admin/cleaning/agents')
          ? { data: [] }
          : { data: [] };
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
  await page.goto('/nettoyage');
  await expect(page.getByRole('heading', { level: 1, name: 'Demandes de devis' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Sections du Nettoyage' });
  await expect(tabs.getByRole('link', { name: 'Catalogue' })).toBeVisible();
  await page.getByRole('link', { name: /Demande du 28 oct\. 2026/ }).click();
  await expect(page.getByRole('button', { name: 'Planifier la visite' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Demandes' })).toHaveAttribute('aria-current', 'page');
});
