// Frontend/e2e/nav.spec.js
import { test, expect } from '@playwright/test';
import { ROUTE_TABLE } from '../src/routes/routeTable.js';

test.describe('Role Shell Navigation & <h1> Route Title Parity Suite', () => {
  const roles = [
    { role: 'admin', email: 'admin@carbonvault.com', pass: 'admin123', routes: ROUTE_TABLE.admin },
    { role: 'verifier', email: 'verifier@carbonvault.com', pass: 'verifier123', routes: ROUTE_TABLE.verifier },
    { role: 'ngo', email: 'contact@ecoguard.org', pass: 'ngo123', routes: ROUTE_TABLE.ngo },
    { role: 'corporate', email: 'carbon@microsoft.com', pass: 'corp123', routes: ROUTE_TABLE.corporate },
    { role: 'public', email: null, pass: null, routes: ROUTE_TABLE.public },
  ];

  for (const { role, email, pass, routes } of roles) {
    test(`[${role.toUpperCase()}] Shell Navigation: 100% <h1> parity & 0 console errors`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
            consoleErrors.push(txt);
          }
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      if (email && pass) {
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(pass);
        await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();
      } else {
        await page.locator('[data-testid="explore-public-registry"]').click();
      }

      await page.waitForSelector('nav', { timeout: 15000 });

      for (const route of routes) {
        const navBtn = page.locator(`[data-testid="nav-${route.id}"], nav button:has-text("${route.label}")`).first();
        await expect(navBtn).toBeVisible({ timeout: 10000 });
        await navBtn.click();

        await page.waitForTimeout(200);

        // Verify Error Boundary did not trip
        await expect(page.locator('text="Something went wrong"')).toHaveCount(0);

        // Verify primary single <h1> matches ROUTE_TABLE title exactly
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible({ timeout: 8000 });
        const h1Text = await h1.innerText();
        expect(h1Text.trim()).toBe(route.title);
      }

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});
