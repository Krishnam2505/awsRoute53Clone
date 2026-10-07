import { type Page, expect, test } from '@playwright/test';

const zoneName = `e2e-${Date.now()}.com`;

async function signIn(page: Page) {
  await page.goto('/route53/v2/hostedzones');
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Hosted zones/ })).toBeVisible();
}

test('sign in, manage a zone and its records, sign out', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  await signIn(page);

  // Session survives a reload
  await page.reload();
  await expect(page.getByRole('heading', { name: /Hosted zones/ })).toBeVisible();

  // Create a public hosted zone
  await page.getByRole('link', { name: 'Create hosted zone' }).click();
  await page.getByPlaceholder('example.com').fill(zoneName);
  await page.getByPlaceholder('The hosted zone is used for...').fill('Created by Playwright');
  await page.getByRole('button', { name: 'Create hosted zone' }).click();
  await expect(page.getByText(`${zoneName} was successfully created`)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Records (2)' })).toBeVisible();

  // Create an A record
  await page.getByRole('link', { name: 'Create record' }).click();
  await expect(page.getByRole('heading', { name: 'Quick create record' })).toBeVisible();
  await page.getByPlaceholder('subdomain').fill('www');
  await page.getByRole('textbox', { name: 'Value' }).fill('192.0.2.300');
  await page.getByRole('button', { name: 'Create records' }).click();
  await expect(page.getByText(/not a valid IPv4 address/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Value' }).fill('192.0.2.10\n192.0.2.11');
  await page.getByRole('button', { name: 'Create records' }).click();
  await expect(page.getByText(`Record for www.${zoneName} was successfully created`)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Records (3)' })).toBeVisible();

  // A CNAME at the apex is refused by the API
  await page.getByRole('link', { name: 'Create record' }).click();
  await expect(page.getByRole('heading', { name: 'Quick create record' })).toBeVisible();
  await page.getByRole('button', { name: /^Record type Record type/ }).click();
  await page.getByText('CNAME – Routes traffic').click();
  await page.getByRole('textbox', { name: 'Value' }).fill('target.example.net');
  await page.getByRole('button', { name: 'Create records' }).click();
  await expect(page.getByText(/CNAME record for the zone apex/)).toBeVisible();
  await page.getByRole('link', { name: 'Cancel' }).click();

  // Zone deletion is refused while records exist
  await page.getByRole('button', { name: 'Delete zone' }).click();
  await expect(page.getByText('This hosted zone contains records')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Delete the A record, then the zone
  await page.getByRole('checkbox', { name: new RegExp(`www.${zoneName} A`) }).check();
  await page.getByRole('button', { name: 'Delete record' }).click();
  await page.getByTestId('confirm-delete').filter({ visible: true }).click();
  await expect(page.getByText(`Record www.${zoneName} was successfully deleted`)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Records (2)' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete zone' }).click();
  await page.getByPlaceholder('delete').fill('delete');
  await page.getByTestId('confirm-delete').filter({ visible: true }).click();
  await expect(
    page.getByText(`The hosted zone ${zoneName} was successfully deleted`),
  ).toBeVisible();

  // Sign out: protected pages send you back to the sign-in page
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/route53/v2/hostedzones');
  await expect(page).toHaveURL(/\/login\?next=/);

  expect(consoleErrors).toEqual([]);
});
