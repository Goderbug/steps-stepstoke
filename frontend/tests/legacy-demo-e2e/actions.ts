import { expect, type Page } from '@playwright/test';

export const funding = (page: Page) => page.getByRole('dialog', { name: /Fund a contribution|Review identical paid retry/ });
// Verification replaces a short loading line with a full preview. Wait for that layout before
// clicking controls below it; otherwise WebKit can send the pointer into the arriving iframe.
async function settledPreview(page: Page) {
  if (await page.getByRole('dialog').count()) return; // Modal controls use their own stable layout.
  await expect(page.locator('#assets .preview .state-line')).toHaveCount(0);
  if (await page.locator('#assets .preview .badge-ok').count())
    await expect(page.getByRole('link', { name: 'Download verified file' })).toBeVisible();
}
export async function prepare(page: Page) {
  if (!(await page.getByRole('dialog', { name: 'Prepare a contribution' }).count())) {
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    await settledPreview(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(page.getByRole('dialog', { name: 'Prepare a contribution' })).toBeVisible();
  return page.getByRole('dialog', { name: 'Prepare a contribution' });
}
export async function disclose(page: Page, title: string | RegExp) {
  if (page.url().includes("/b/")) await expect(page.locator("#assets")).toHaveAttribute("data-branch-id", page.url().split("/b/")[1]);
  await settledPreview(page);
  const summary = page.locator('summary').filter({ hasText: title });
  await expect(summary.first()).toBeAttached();
  for (const item of await summary.all()) {
    if (!(await item.evaluate(el => (el.parentElement as HTMLDetailsElement).open))) await item.click();
  }
}
export async function demoSettings(page: Page) { await disclose(page, /^Demo settings$/); }
export async function failureControls(page: Page) { await disclose(page, /^Demo failure controls/); }
export async function selectFile(page: Page, key: string) {
  await expect(page.locator("#assets")).toHaveAttribute("data-branch-id", page.url().split("/b/")[1]);
  const selected = page.locator(`.asset-tabs button[data-asset-key="${key}"]`);
  if (await page.locator(".asset-tabs button").count()) await selected.click();
  await expect(page.locator('.preview')).toBeVisible();
  await expect(page.locator('.preview .state-line')).toHaveCount(0);
  await disclose(page, /^File verification details$/);
  await disclose(page, /^Complete asset table/);
  return page.locator('#assets');
}
export async function selectRound(page: Page, round: number) {
  await page.getByRole('button', { name: new RegExp(`^Select Round ${round}(,|$)`) }).click();
  await expect(page.getByRole('heading', { name: `Round ${round} output`, exact: true })).toBeVisible();
}
// An account/network event can originate in an external wallet while a modal makes the page
// inert. Dispatch the same native change event to the demo wallet control for that simulation.
export async function identity(page: Page, name: string, value: string | boolean) {
  const control = page.getByLabel(name);
  await control.evaluate((el, next) => {
    if (el instanceof HTMLSelectElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(el, String(next)); el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el instanceof HTMLInputElement && el.checked !== next) el.click();
  }, value);
}
