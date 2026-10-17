import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('../Frontend/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const failedRequests = [];
  const allRequests = [];
  const responses = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('request', req => allRequests.push(`${req.method()} ${req.url()}`));
  page.on('requestfailed', req => failedRequests.push({
    url: req.url(),
    failure: req.failure()?.errorText,
    method: req.method()
  }));
  page.on('response', res => {
    responses.push({
      status: res.status(),
      url: res.url()
    });
  });

  const res = await page.goto('https://final-carbon-vault.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  const headers = res.headers();

  console.log('=== 1. CSP RESPONSE HEADER ===');
  console.log(headers['content-security-policy'] || 'NO CSP HEADER');
  console.log('Report-Only header:', headers['content-security-policy-report-only'] || 'None');

  await page.waitForTimeout(4000);

  console.log('\n=== 2. ALL OUTGOING REQUESTS (' + allRequests.length + ') ===');
  allRequests.forEach(r => console.log('  ' + r));

  console.log('\n=== 3. CONSOLE MESSAGES (' + consoleLogs.length + ') ===');
  consoleLogs.forEach(c => console.log('  ' + c));

  console.log('\n=== 4. FAILED REQUESTS (' + failedRequests.length + ') ===');
  console.log(JSON.stringify(failedRequests, null, 2));

  console.log('\n=== 5. HTTP RESPONSES >= 400 ===');
  const badResponses = responses.filter(r => r.status >= 400);
  if (badResponses.length === 0) console.log('  None');
  badResponses.forEach(r => console.log(`  [${r.status}] ${r.url}`));

  const pillText = await page.evaluate(() => {
    const el = document.querySelector('body');
    return el ? el.innerText : '';
  });
  console.log('\n=== 6. BODY TEXT SNAPSHOT ===');
  console.log(pillText.slice(0, 800));

  await page.screenshot({ path: 'prod_owner_view.png', fullPage: true });
  console.log('\nScreenshot saved to prod_owner_view.png');

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
