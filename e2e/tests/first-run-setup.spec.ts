import { expect, Page, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The first five minutes of every installation: open the console, name the organization, unlock
 * the wizard with the setup key from the server, create an administrator, choose a database, land
 * in the dashboard — and later, sign in again from a browser that has never seen the wizard.
 * If this breaks, nobody can start using the product at all.
 */

const home = process.env.E2E_PORTAL_HOME!;
const keyFile = join(home, 'secrets', 'initialAdminPassword');
const configFile = join(home, 'portal.properties');
const ORGANIZATION = 'Acme Corp';
const ADMIN = {
  email: 'owner@example.com',
  firstName: 'Ada',
  lastName: 'Owner',
  password: 'E2e-Correct-Horse-42',
};

test.describe.configure({ mode: 'serial' });

async function acceptLicense(page: Page) {
  const accept = page.getByRole('checkbox', { name: 'I have read and agree to the Apache License 2.0.' });
  await expect(page.getByRole('region', { name: 'Apache License 2.0' })).toContainText('END OF TERMS AND CONDITIONS');
  await expect(accept).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Accept and continue' })).toBeDisabled();
  await accept.check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
}

async function throughOrganizationStep(page: Page) {
  await page.goto('/setup');
  await acceptLicense(page);
  await page.getByLabel('Organization name').fill(ORGANIZATION);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Create the first administrator' })).toBeVisible();
}

test('a fresh install opens the setup wizard, not a sign-in form', async ({ page, request }) => {
  const status = await (await request.get('/api/public/setup/status')).json();
  expect(status.setupRequired).toBe(true);
  expect(status.setupKeyIssued).toBe(true);
  expect(existsSync(keyFile)).toBe(true);

  // Every option is written out, commented, for operators who prefer files to the wizard.
  expect(status.configFile).toBe(configFile);
  expect(readFileSync(configFile, 'utf8')).toContain('# spring.datasource.url=jdbc:postgresql://');

  // What an operator types after starting the server: the bare address.
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup/);
  await expect(page.getByRole('heading', { name: 'Welcome to Portal SSO' })).toBeVisible();

  await acceptLicense(page);

  // The organization step previews what users will see.
  await page.getByLabel('Organization name').fill(ORGANIZATION);
  await expect(page.getByText(`Sign in to ${ORGANIZATION}`)).toBeVisible();
});

test('license acceptance survives Back and can be withdrawn', async ({ page }) => {
  await page.goto('/setup');
  await acceptLicense(page);
  await page.getByLabel('Organization name').fill(ORGANIZATION);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: 'I have read and agree to the Apache License 2.0.' });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(page.getByRole('button', { name: 'Accept and continue' })).toBeDisabled();
  await checkbox.check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(page.getByLabel('Organization name')).toHaveValue(ORGANIZATION);
});

test('a logo that is not a web address is caught before the key is needed', async ({ page }) => {
  await page.goto('/setup');
  await acceptLicense(page);
  await page.getByText('Logo and support link (optional)', { exact: true }).click();
  await page.getByLabel(/Logo URL/).fill('logo.png');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Logo URL must be a full http:// or https:// address');
});

test('the password checklist updates as the operator types', async ({ page }) => {
  await throughOrganizationStep(page);
  // The operator is told where the key is, so they do not have to go hunting through logs.
  await expect(page.getByText('initialAdminPassword')).toBeVisible();

  const rules = page.locator('#setup-password-rules');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await expect(rules.getByText('At least 12 characters')).toBeVisible();
  await expect(rules.getByText('(not met)').first()).toBeAttached();

  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await expect(rules.getByText('(not met)')).toHaveCount(0);
});

test('a wrong setup key is refused and nothing is created', async ({ page, request }) => {
  await throughOrganizationStep(page);
  await page.getByLabel('Setup key').fill('definitely-not-the-key');
  await page.getByLabel('Administrator email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByLabel('Confirm password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create administrator' }).click();

  await expect(page.getByText('The setup key is incorrect.')).toBeVisible();
  const status = await (await request.get('/api/public/setup/status')).json();
  expect(status.setupRequired).toBe(true);
});

test('the right setup key creates the administrator, then database and next steps follow', async ({ page, request }) => {
  const setupKey = readFileSync(keyFile, 'utf8').trim();

  await throughOrganizationStep(page);
  await page.getByLabel('Setup key').fill(setupKey);
  await page.getByLabel('Administrator email').fill(ADMIN.email);
  await page.getByLabel('First name').fill(ADMIN.firstName);
  await page.getByLabel('Last name').fill(ADMIN.lastName);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByLabel('Confirm password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create administrator' }).click();

  // Signed in by now: the database step uses the administrator's own session.
  await expect(page.getByRole('heading', { name: 'Choose where data is stored' })).toBeVisible({ timeout: 20_000 });

  // The key is single use: it is spent and its file removed.
  expect(existsSync(keyFile)).toBe(false);
  const status = await (await request.get('/api/public/setup/status')).json();
  expect(status.setupRequired).toBe(false);
  expect(status.setupKeyFile ?? null).toBeNull();

  // Choosing PostgreSQL shows the connection form; switching waits for a successful test.
  await page.getByRole('radio', { name: /PostgreSQL/ }).click();
  await expect(page.getByLabel('Host')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch database & restart' })).toBeDisabled();

  await page.getByRole('radio', { name: /Built-in/ }).click();
  await page.getByRole('button', { name: 'Continue with built-in' }).click();

  await expect(page.getByRole('heading', { name: `${ORGANIZATION} is ready` })).toBeVisible();
  await page.getByRole('button', { name: 'Go to dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});

test('setup cannot be run a second time', async ({ request }) => {
  const response = await request.post('/api/public/setup/initialize', {
    data: { setupKey: 'anything', email: 'intruder@example.com', password: ADMIN.password },
  });
  // Rejected before any key is looked at — by CSRF here, and by "already completed" with a token.
  expect(response.ok()).toBe(false);
});

test('a clean browser sees the organization and can sign in', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // The wizard is closed for good.
  await page.goto('/setup');
  await expect(page).toHaveURL(/\/sign-in/);

  // Branding comes from the server, not from the browser that ran the wizard.
  await expect(page.getByRole('heading', { name: `Sign in to ${ORGANIZATION}`, exact: true })).toBeVisible();
  await expect(page.getByLabel('Setup key')).toHaveCount(0);

  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await context.close();
});
