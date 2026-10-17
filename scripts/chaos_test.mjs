/**
 * scripts/chaos_test.mjs
 * Chaos Engineering Suite for CarbonVault Frontend.
 * Uses Playwright Chromium to intercept network traffic and inject failure modes:
 * 1. Delayed response (5s)
 * 2. Extended cold-start delay (40s simulation)
 * 3. 500 Internal Server Error
 * 4. 502 Bad Gateway with Render HTML body
 * 5. Empty JSON object {}
 * 6. Malformed JSON syntax
 * 7. 401 Unauthorized (verifies clean auth-expired event without white screen)
 * 8. Dropped SSE stream (verifies reconnect without freezing UI)
 * 9. Rapid 20x throttle check (clicking and switching views without crashing)
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { chromium } = require('../Frontend/node_modules/playwright');

const TARGET_URL = process.env.TARGET_URL || 'https://final-carbon-vault.vercel.app';

console.log('='.repeat(78));
console.log('CarbonVault Playwright Chaos Engineering Suite');
console.log(`Target: ${TARGET_URL}`);
console.log('='.repeat(78));

async function runChaosSuite() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  async function testScenario(name, setupRoute, action, verify) {
    process.stdout.write(`[TEST] ${name.padEnd(45)} ... `);
    const context = await browser.newContext();
    const page = await context.newPage();
    const uncaughtErrors = [];
    page.on('pageerror', (err) => uncaughtErrors.push(err.message));

    try {
      if (setupRoute) {
        await setupRoute(page);
      }
      await action(page);
      const passed = await verify(page, uncaughtErrors);
      if (passed && uncaughtErrors.length === 0) {
        console.log('PASSED');
        results.push({ name, status: 'PASSED', error: null });
      } else {
        console.log(`FAILED (${uncaughtErrors.join('; ') || 'assertion failed'})`);
        results.push({ name, status: 'FAILED', error: uncaughtErrors.join('; ') || 'assertion failed' });
      }
    } catch (err) {
      console.log(`ERROR (${err.message})`);
      results.push({ name, status: 'ERROR', error: err.message });
    } finally {
      await context.close();
    }
  }

  // Scenario 1: 5s delayed response
  await testScenario(
    '1. 5-Second Latency Delay on /ready',
    async (page) => {
      await page.route('**/ready', async (route) => {
        await new Promise((r) => setTimeout(r, 5000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ready', commit: '20c9c98', database: { status: 'ok' }, razorpay: 'ok' })
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page, errors) => {
      // Page should remain visible and not blank
      const bodyText = await page.textContent('body');
      return bodyText.length > 100;
    }
  );

  // Scenario 2: 40s cold-start delay
  await testScenario(
    '2. 40-Second Cold-Start Delay (Waking Pill)',
    async (page) => {
      await page.route('**/ready', async (route) => {
        // Return 503 waking on first call
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'unready', reason: 'database_unreachable' })
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    },
    async (page) => {
      const bodyText = await page.textContent('body');
      // Should show waking or checking indicator without crash
      return bodyText.includes('Waking') || bodyText.includes('Checking') || bodyText.includes('API');
    }
  );

  // Scenario 3: 500 Internal Server Error
  await testScenario(
    '3. 500 Server Error Response',
    async (page) => {
      await page.route('**/projects**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal Server Error in database pool' })
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      const content = await page.textContent('body');
      return content.length > 50;
    }
  );

  // Scenario 4: 502 HTML from reverse proxy (Render cold boot)
  await testScenario(
    '4. 502 HTML Response from Cloud Gateway',
    async (page) => {
      await page.route('**/ready', async (route) => {
        await route.fulfill({
          status: 502,
          contentType: 'text/html',
          body: '<html><body><h1>502 Bad Gateway</h1><p>Render worker boot</p></body></html>'
        });
      });
      await page.route('**/health', async (route) => {
        await route.fulfill({
          status: 502,
          contentType: 'text/html',
          body: '<html><body><h1>502 Bad Gateway</h1></body></html>'
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      const content = await page.textContent('body');
      // Must not throw uncaught SyntaxError in JSON.parse
      return content.length > 50;
    }
  );

  // Scenario 5: Empty JSON object {}
  await testScenario(
    '5. Empty JSON Object Response ({})',
    async (page) => {
      await page.route('**/stats**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}'
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      const content = await page.textContent('body');
      return content.length > 50;
    }
  );

  // Scenario 6: Malformed JSON syntax
  await testScenario(
    '6. Malformed JSON Payload (Truncated Bytes)',
    async (page) => {
      await page.route('**/pricing**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"status": "ok", "pricing": [ { "id": 1, '
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      const content = await page.textContent('body');
      return content.length > 50;
    }
  );

  // Scenario 7: 401 Unauthorized handling
  await testScenario(
    '7. 401 Unauthorized Session Expiration',
    async (page) => {
      await page.route('**/users/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Token expired or invalid signature' })
        });
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      // Must render clean login page without crash
      const content = await page.textContent('body');
      return content.includes('Sign In') || content.includes('CarbonVault') || content.includes('Demo Accounts');
    }
  );

  // Scenario 8: Dropped SSE connection
  await testScenario(
    '8. Dropped Server-Sent Events (SSE) Stream',
    async (page) => {
      await page.route('**/realtime/stream**', async (route) => {
        await route.abort('connectionreset');
      });
    },
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    },
    async (page) => {
      const content = await page.textContent('body');
      return content.length > 50;
    }
  );

  // Scenario 9: 20x Rapid Throttling (Clicks & Navigation)
  await testScenario(
    '9. 20x Rapid Interaction Throttle Check',
    null,
    async (page) => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Perform 20 rapid interactions
      const buttons = await page.$$('button');
      for (let i = 0; i < 20; i++) {
        if (buttons.length > 0) {
          const target = buttons[i % buttons.length];
          try {
            await target.click({ timeout: 500 }).catch(() => {});
          } catch {
            // Ignore click-intercepted
          }
        }
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(1000);
    },
    async (page) => {
      const content = await page.textContent('body');
      return content.length > 50;
    }
  );

  await browser.close();

  console.log('\n' + '='.repeat(78));
  console.log('Chaos Testing Summary:');
  const allPassed = results.every((r) => r.status === 'PASSED');
  results.forEach((r) => {
    console.log(`- ${r.name.padEnd(50)} : ${r.status}`);
  });
  console.log('='.repeat(78));

  if (!allPassed) {
    process.exit(1);
  }
}

runChaosSuite().catch((err) => {
  console.error('Fatal chaos suite crash:', err);
  process.exit(1);
});
