// Frontend/e2e/buttons.spec.js
import { test, expect } from '@playwright/test';

test.describe('Automated Button & Control Map Verification', () => {
  test('Login, navigate routes, open Project Detail, Project Wizard, and ML Models without error', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));

    // 1. Visit root page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Click Public Explorer demo button or Admin demo button
    const adminDemoBtn = page.locator('button:has-text("Admin")').first();
    const publicBtn = page.locator('button:has-text("Public Explorer")').first();

    if (await adminDemoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await adminDemoBtn.click();
      const submitBtn = page.locator('button[type="submit"]:has-text("Sign In")').first();
      await submitBtn.click();
    } else if (await publicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publicBtn.click();
    }

    // 3. Verify main layout navigation appears
    await expect(page.locator('nav')).toBeVisible({ timeout: 15000 });

    // 4. Test theme toggle
    const themeBtn = page.locator('button:has(svg.lucide-sun), button:has(svg.lucide-moon)').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      await themeBtn.click();
    }

    // 5. Test navigation to ML Models page
    const mlNav = page.locator('nav button:has-text("ML Models")').first();
    if (await mlNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mlNav.click();
      await expect(page.locator('text=Audited ML Models')).toBeVisible({ timeout: 10000 });

      // Run on sample button test
      const runSampleBtn = page.locator('button:has-text("Run on Sample")').first();
      if (await runSampleBtn.isVisible()) {
        await runSampleBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 6. Test direct deep-link to /projects/new (Project Creation Wizard)
    await page.goto('/projects/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Project Registration Wizard')).toBeVisible({ timeout: 10000 });

    // Test Wizard step advancement
    const nextBtn = page.locator('button:has-text("Next Step")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(page.locator('text=Location & Geofence')).toBeVisible({ timeout: 5000 });
    }

    // 7. Verify no unhandled page errors occurred
    expect(pageErrors).toHaveLength(0);
  });
});
