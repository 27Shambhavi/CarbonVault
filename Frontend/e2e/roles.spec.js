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

  test('1. Login screen renders exactly 5 demo tiles, no Public tile, and clean explore button', async ({ page }) => {
    // 5 demo tiles must exist
    await expect(page.locator('[data-testid="demo-tile-admin"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="demo-tile-approver"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-tile-verifier"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-tile-ngo"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-tile-corporate"]')).toBeVisible();

    // Public tile must NOT exist among the sign-in roles
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

    // Header role badge
    const roleBadge = page.locator('[data-testid="role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText('Admin');

    // Home content
    await expect(page.locator('text=Admin Operations Console')).toBeVisible({ timeout: 10000 });

    // Assert exact nav items for Admin
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

  test('3. Approver logs in to Decision Desk with strictly project decision nav', async ({ page }) => {
    // Fill Approver credentials
    await page.locator('input[type="email"]').fill('approver@carbonvault.com');
    await page.locator('input[type="password"]').fill('approver123');
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    // Wait for app layout
    await page.waitForSelector('nav', { timeout: 15000 });

    // Header role badge
    const roleBadge = page.locator('[data-testid="role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText('Approver');

    // Home content
    await expect(page.locator('text=Approver Decision Desk')).toBeVisible({ timeout: 10000 });

    // Assert exact nav items for Approver
    const expectedNav = ['Home', 'Decision Queue', 'Decided', 'My Audit'];
    for (const label of expectedNav) {
      await expect(page.locator(`nav button:has-text("${label}")`).first()).toBeVisible();
    }

    // Assert forbidden admin nav items do NOT appear for Approver
    const forbiddenNav = ['Organisations', 'Users', 'Pricing', 'Payments and Payouts', 'ML Models'];
    for (const label of forbiddenNav) {
      await expect(page.locator(`nav button:has-text("${label}")`)).toHaveCount(0);
    }
  });

  test('4. Tile choice does not decide role: selecting Admin tile with Approver credentials lands on Approver', async ({ page }) => {
    // Click Admin demo tile
    const adminTile = page.locator('[data-testid="demo-tile-admin"]');
    await adminTile.click();

    // Overwrite email and password with Approver credentials
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('approver@carbonvault.com');
    const passInput = page.locator('input[type="password"]');
    await passInput.fill('approver123');

    // Submit form
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    // Wait for app layout
    await page.waitForSelector('nav', { timeout: 15000 });

    // Verify authenticated role comes from server claims (Approver), NOT clicked tile
    const roleBadge = page.locator('[data-testid="role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText('Approver');

    // Lands on Approver Decision Desk
    await expect(page.locator('text=Approver Decision Desk')).toBeVisible({ timeout: 10000 });
  });
});
