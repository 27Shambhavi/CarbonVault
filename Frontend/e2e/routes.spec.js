// e2e/routes.spec.js
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const rolesConfig = [
  {
    role: 'admin',
    name: 'Super Admin',
    email: 'admin@carbonvault.com',
    password: 'admin123',
    routes: ['Dashboard', 'User Management', 'Project Approvals', 'Pricing Engine', 'Analytics']
  },
  {
    role: 'approver',
    name: 'Approver',
    email: 'approver@carbonvault.com',
    password: 'approver123',
    routes: ['Dashboard', 'Project Approvals', 'Analytics']
  },
  {
    role: 'ngo',
    name: 'NGO Organization',
    email: 'contact@ecoguard.org',
    password: 'ngo123',
    routes: ['Dashboard', 'My Projects', 'New Project', 'Site Suitability', 'Marketplace']
  },
  {
    role: 'corporate',
    name: 'Corporate Buyer',
    email: 'carbon@microsoft.com',
    password: 'corp123',
    routes: ['Dashboard', 'Marketplace', 'My Wallet', 'ESG Reports', 'Footprint Calculator']
  },
  {
    role: 'public',
    name: 'Public Auditor',
    email: 'guest@carbonvault.com',
    password: 'guest123',
    routes: ['Impact Stats', 'Leaderboard', 'Marketplace View', 'Climate Insights', 'Certificates', 'Audit Trail']
  }
];

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

for (const { role, name, email, password, routes } of rolesConfig) {
  test.describe(`Smoke Tests: Role [${role} - ${name}]`, () => {
    test(`Login and visit every sidebar route without error #310 or pageerror`, async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      // Intercept page crashes and console errors
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          // Filter out benign browser network noise or 3rd-party warnings
          if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
            consoleErrors.push(txt);
          }
        }
      });

      // 1. Visit root page / login form
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Check if already authenticated or on login form
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
      if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Fill email and password
        await emailInput.fill(email);
        const passInput = page.locator('input[type="password"]');
        await passInput.fill(password);

        // Click submit
        const submitBtn = page.locator('button:has-text("Sign In"), button:has-text("Sign in")').first();
        await submitBtn.click();
      }

      // 2. Wait for main application container to appear
      await page.waitForSelector('nav', { timeout: 15000 });

      // 3. Visit every sidebar route
      for (const routeName of routes) {
        // Find sidebar navigation item
        const navItem = page.locator(`nav button:has-text("${routeName}")`).first();
        await expect(navItem, `Nav button for route ${routeName} should be visible`).toBeVisible({ timeout: 10000 });
        await navItem.click();

        // Allow microtask queue to process and screen to render
        await page.waitForTimeout(1000);

        // Ensure "Something went wrong" (ErrorBoundary) does NOT appear
        const errorBoundary = page.locator('text="Something went wrong"');
        const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasError, `Error boundary triggered on route [${role} -> ${routeName}]`).toBe(false);

        // Ensure spinner does not remain stuck indefinitely (> 15s)
        const spinner = page.locator('[data-testid="data-boundary-loading"], .spinSlow');
        const isSpinnerVisible = await spinner.isVisible({ timeout: 500 }).catch(() => false);
        if (isSpinnerVisible) {
          await expect(spinner).not.toBeVisible({ timeout: 15000 });
        }

        // Ensure page has content (not completely empty)
        const mainContent = page.locator('main, div[style*="padding: 28px"], div[style*="padding:28px"]');
        await expect(mainContent.first()).toBeVisible({ timeout: 5000 });

        // Save screenshot per route
        const cleanRoute = routeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const screenshotPath = path.join(screenshotDir, `${role}_${cleanRoute}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Assert no fatal React pageerrors fired during render
        const fatalHooksError = pageErrors.find(e =>
          e.includes('Minified React error #310') ||
          e.includes('Rendered more hooks than during the previous render') ||
          e.includes('Cannot read properties of undefined (reading \'environmental\')')
        );
        expect(fatalHooksError, `Fatal hook order or null error on ${routeName}: ${fatalHooksError}`).toBeUndefined();
      }
    });
  });
}
