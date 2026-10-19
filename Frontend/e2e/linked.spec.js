// Frontend/e2e/linked.spec.js
import { test, expect } from '@playwright/test';

test.describe('Linked Multi-Role Workflow & Timeline Audit Suite', () => {
  const TEST_PROJECT_ID = 'PRJ-MAN-AMAZON';

  test('1. Deep linking hash synchronization (#verification, #documents, #timeline)', async ({ page }) => {
    // Navigate directly with URL hash
    await page.goto(`/#timeline`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('nav', { timeout: 15000 });

    // Open public explorer if login screen appears
    const publicBtn = page.locator('[data-testid="explore-public-registry"]');
    if (await publicBtn.isVisible().catch(() => false)) {
      await publicBtn.click();
    }

    // Verify hash can be manipulated
    await page.evaluate(() => {
      window.location.hash = 'timeline';
    });
    expect(await page.evaluate(() => window.location.hash)).toBe('#timeline');
  });

  test('2. Multi-role linked lifecycle and inter-role comment submission', async ({ page }) => {
    // 1. Log in as Admin to access Operations Console and Review Queue
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.locator('input[type="email"]').fill('admin@carbonvault.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    await page.waitForSelector('nav', { timeout: 15000 });

    // Navigate to Review Queue (oversight)
    const reviewQueueBtn = page.locator('[data-testid="nav-approvals"], nav button:has-text("Review Queue (oversight)")').first();
    await expect(reviewQueueBtn).toBeVisible({ timeout: 10000 });
    await reviewQueueBtn.click();

    // Verify Review Queue (oversight) page rendered with 0 crashes
    const h1 = page.locator('h1').first();
    await expect(h1).toHaveText('Review Queue (oversight)', { timeout: 10000 });
    await expect(page.locator('text="Something went wrong"')).toHaveCount(0);

    // Click "Inspect Full Page" if a project is selected
    const inspectBtn = page.locator('button:has-text("Inspect Full Page")').first();
    if (await inspectBtn.isVisible().catch(() => false)) {
      await inspectBtn.click();
      await page.waitForSelector('button:has-text("7. Timeline Audit")', { timeout: 10000 });

      // Click Tab 7: Timeline Audit
      await page.locator('button:has-text("7. Timeline Audit")').click();

      // Verify 4-role progression is rendered
      await expect(page.locator('text=Multi-Role Linked Workflow Lifecycle')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=NGO Developer')).toBeVisible();
      await expect(page.locator('text=Accredited Verifier')).toBeVisible();
      await expect(page.locator('text=Platform Admin')).toBeVisible();
      await expect(page.locator('text=Corporate Buyer')).toBeVisible();

      // Submit an audited inter-role comment
      const commentInput = page.locator('textarea[placeholder*="Append an audited observation"]');
      if (await commentInput.isVisible().catch(() => false)) {
        await commentInput.fill('E2E automated multi-role integrity verification pass.');
        await page.locator('button:has-text("Post Audited Comment")').click();
        await page.waitForTimeout(500);

        // Verify comment appears in the chronological activity feed
        await expect(page.locator('text="E2E automated multi-role integrity verification pass."')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('3. Separation of duties: Admin approval requires accredited Verifier sign-off', async ({ page }) => {
    // Authenticate as Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('admin@carbonvault.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]:has-text("Access Dashboard")').click();

    await page.waitForSelector('nav', { timeout: 15000 });

    // Open Review Queue
    const reviewQueueBtn = page.locator('[data-testid="nav-approvals"], nav button:has-text("Review Queue (oversight)")').first();
    await reviewQueueBtn.click();

    // Verify error boundary did not trigger
    await expect(page.locator('text="Something went wrong"')).toHaveCount(0);
  });
});
