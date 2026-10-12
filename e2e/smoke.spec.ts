import { expect, test } from '@playwright/test';

test('le tableau de bord s’affiche avec le menu des modules', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible();
  if (isMobile) await page.getByText('Menu', { exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: 'Recouvrement' }).first(),
  ).toBeVisible();
});

test('un module de la phase en cours s’ouvre depuis le menu', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByText('Menu', { exact: true }).click();
  await page.getByRole('link', { name: 'Recouvrement' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recouvrement' })).toBeVisible();
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
});

test('la page de connexion s’affiche', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
});

test('la sonde de santé répond', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(await response.json()).toMatchObject({ status: 'ok', site: 'backoffice' });
});
