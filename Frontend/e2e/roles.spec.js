// Frontend/e2e/roles.spec.js
import { test, expect } from '@playwright/test';

test.describe('Role Separation & Server-Authoritative Login Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each role test
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  });

  test('1. Login screen renders exactly 4 demo tiles (Admin, Verifier, NGO, Corporate), no Approver tile, and clean explore button', async ({ page }) => {
    // 4 active demo tiles must exist
    await expect(page.locator('[data-testid="demo-tile-admin"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="demo-tile-verifier"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-tile-ngo"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-tile-corporate"]')).toBeVisible();

    // Approver tile must NOT exist anywhere (ONE Admin architecture)
    await expect(page.locator('[data-testid="demo-tile-approver"]')).toHaveCount(0);

    // Public tile must NOT exist among the credentials tiles
    await expect(page.locator('[data-testid="demo-tile-public"]')).toHaveCount(0);

    // Single public exploration button without sign-in
    const publicBtn = page.locator('[data-testid="explore-public-registry"]');
    await expect(publicBtn).toBeVisible();
    await expect(publicBtn).toContainText('Explore the public registry (no login)');
  });

  test('2. Admin logs in to Operations Console with platform operations nav', async ({ page }) => {
    // Fill Admin credentials
    await page.locator('input[type="email"]').fill('admin@carbonvault.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    // Wait for app layout
    await page.waitForSelector('nav', { timeout: 15000 });

    // Home content
    await expect(page.locator('text=Admin Operations Console').first()).toBeVisible({ timeout: 10000 });

    // Assert exact nav items for Admin matching ROUTE_TABLE.admin
    const expectedNav = [
      'Home',
      'Review Queue (oversight)',
      'Organisations',
      'Users',
      'Pricing',
      'Payments and Payouts',
      'ML Models',
      'Audit',
      'Settings'
    ];

    for (const label of expectedNav) {
      await expect(page.locator(`nav button:has-text("${label}")`).first()).toBeVisible();
    }
  });

  test('3. Verifier logs in to Field Auditor Desk with dedicated verification tabs', async ({ page }) => {
    // Fill Verifier credentials
    await page.locator('input[type="email"]').fill('verifier@carbonvault.com');
    await page.locator('input[type="password"]').fill('verifier123');
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    // Wait for app layout
    await page.waitForSelector('nav', { timeout: 15000 });

    // Home content
    await expect(page.locator('text=Field Verification Workbench').first()).toBeVisible({ timeout: 10000 });

    // Assert exact nav items for Verifier
    const expectedNav = ['Assignments', 'Map', 'Completed', 'Profile'];
    for (const label of expectedNav) {
      await expect(page.locator(`nav button:has-text("${label}")`).first()).toBeVisible();
    }
  });

  test('4. Tile choice does not decide role: selecting Admin tile with Verifier credentials lands on Verifier', async ({ page }) => {
    // Click Admin demo tile
    const adminTile = page.locator('[data-testid="demo-tile-admin"]');
    await adminTile.click();

    // Overwrite email and password with Verifier credentials
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('verifier@carbonvault.com');
    const passInput = page.locator('input[type="password"]');
    await passInput.fill('verifier123');

    // Submit form
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    // Wait for app layout
    await page.waitForSelector('nav', { timeout: 15000 });

    // Lands on Verifier Field Verification Workbench, NOT Admin Console
    await expect(page.locator('text=Field Verification Workbench').first()).toBeVisible({ timeout: 10000 });
  });
});
