// e2e/routes.spec.js
import { test, expect } from '@playwright/test';
import { ROUTE_TABLE } from '../src/routes/routeTable.js';

const rolesConfig = [
  {
    role: 'admin',
    name: 'Super Admin',
    email: 'admin@carbonvault.com',
    password: 'admin123',
    routes: ROUTE_TABLE.admin
  },
  {
    role: 'verifier',
    name: 'Field Verifier',
    email: 'verifier@carbonvault.com',
    password: 'verifier123',
    routes: ROUTE_TABLE.verifier
  },
  {
    role: 'ngo',
    name: 'NGO Developer',
    email: 'contact@ecoguard.org',
    password: 'ngo123',
    routes: ROUTE_TABLE.ngo
  },
  {
    role: 'corporate',
    name: 'Corporate Buyer',
    email: 'carbon@microsoft.com',
    password: 'corp123',
    routes: ROUTE_TABLE.corporate
  },
  {
    role: 'public',
    name: 'Public Explorer',
    email: null,
    password: null,
    routes: ROUTE_TABLE.public
  }
];

for (const { role, name, email, password, routes } of rolesConfig) {
  test.describe(`Smoke Tests: Role [${role} - ${name}]`, () => {
    test(`Login and visit every shell route with strict title parity and 0 errors`, async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      // Intercept page crashes and console errors
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          // Filter benign network or favicon noise
          if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
            consoleErrors.push(txt);
          }
        }
      });

      // 1. Visit root page
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      // 2. Authenticate or open public explorer
      if (email && password) {
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible({ timeout: 10000 });
        await emailInput.fill(email);
        const passInput = page.locator('input[type="password"]');
        await passInput.fill(password);
        await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();
      } else {
        const publicBtn = page.locator('[data-testid="explore-public-registry"]');
        await expect(publicBtn).toBeVisible({ timeout: 10000 });
        await publicBtn.click();
      }

      // 3. Wait for shell nav to render
      await page.waitForSelector('nav', { timeout: 15000 });

      // 4. Visit every route in role table
      for (const route of routes) {
        // Try finding by testid first, or by label inside nav
        const navItem = page.locator(`[data-testid="nav-${route.id}"], nav button:has-text("${route.label}")`).first();
        await expect(navItem, `Nav button for route ${route.label} (${route.id}) should be visible`).toBeVisible({ timeout: 10000 });
        await navItem.click();

        // Allow render microtask queue to process
        await page.waitForTimeout(300);

        // Ensure ErrorBoundary is NOT triggered
        const errorBoundary = page.locator('text="Something went wrong"');
        await expect(errorBoundary).toHaveCount(0);

        // Assert h1 matches route title strictly
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible({ timeout: 10000 });
        const titleText = await h1.innerText();
        expect(titleText.trim()).toBe(route.title);
      }

      // Assert zero page errors and console errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
}
