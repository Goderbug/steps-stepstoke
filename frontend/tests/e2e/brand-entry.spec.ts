import { test, expect } from './harness';
import { mkdir } from 'node:fs/promises';

test('production entry is branded and points only to real project browsing', async ({ page }, info) => {
  await page.goto('./#/');
  await expect(page).toHaveTitle('STEPS · Stepstoke — Build on every step.');
  await expect(page.getByRole('link', { name: 'STEPS home', exact: true })).toBeVisible();
  await expect(page.locator('.brand .brand-lockup')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build on every step.', exact: true })).toBeVisible();
  const sequence = page.getByRole('list', { name: 'How a project moves forward' });
  await expect(sequence.getByRole('listitem')).toHaveText(['01 Propose', '02 Fund', '03 Build', '04 Continue']);
  const action = page.getByRole('link', { name: /Browse projects/ });
  await expect(action).toHaveAttribute('href', '#/ethereum');
  await expect(action).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Platform' }).getByRole('link')).toHaveText(['Projects']);
  await expect(page.locator('a[href^="#/demo"], a[href^="#/showcase"]')).toHaveCount(0);
  await expect(page.getByText(/Demo data|simulated|Demo mode|Fixture demo/)).toHaveCount(0);
  await mkdir('../test/scratch/production-entry', { recursive: true });
  await page.screenshot({ path: `../test/scratch/production-entry/${info.project.name}-home.png`, fullPage: true });
  for (const route of ['#/demo', '#/demo/b/fx-branch-1', '#/showcase']) {
    await page.goto(`./${route}`);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { name: 'Build on every step.', exact: true })).toBeVisible();
    await expect(page.getByText(/Demo mode|Round 3 output|Platform components/)).toHaveCount(0);
  }
});

test('deployment details preserve the authenticated handoff and closed payment gates', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Deployment and readiness', exact: true }).click();
  await expect(page.locator('#main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Deployment and readiness', exact: true })).toBeVisible();
  await page.getByText('Deployment status and source', { exact: true }).click();
  await expect(page.getByText('HANDOFF_PRESENT_UNVERIFIED', { exact: true })).toBeVisible();
  await expect(page.getByText('productionReady: false', { exact: false })).toBeVisible();
  await expect(page.locator('a[href^="#/demo"], a[href^="#/showcase"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'STEPS home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build on every step.', exact: true })).toBeVisible();
});
