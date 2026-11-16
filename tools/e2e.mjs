// End-to-end check of the whole FLARE story in a real browser, against a running server. It also retakes docs/screenshots.
//
//   npm run build && PORT=8793 npm start -w server      (in one terminal)
//   node tools/e2e.mjs                                   (in another)
//
// Playwright is not a project dependency. Point FLARE_BROWSER_TOOLS at any folder that has it installed
// (default: .board/browser-tools). FLARE_TEST_URL overrides the server address. The script resets the demo first.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const base = process.env.FLARE_TEST_URL ?? 'http://localhost:8793';
const shots = resolve('docs/screenshots');
const requireBrowser = createRequire(resolve(process.env.FLARE_BROWSER_TOOLS ?? '.board/browser-tools', 'package.json'));
const { chromium } = requireBrowser('playwright');

const steps = [];
const step = async (name, fn) => {
  const t = Date.now();
  await fn();
  steps.push(`ok  ${name} (${Date.now() - t} ms)`);
  console.log(steps.at(-1));
};
const settle = (page, ms = 2500) => page.waitForTimeout(ms);

mkdirSync(shots, { recursive: true });
assert.equal((await fetch(`${base}/api/health`)).status, 200, `no FLARE server at ${base}`);
await fetch(`${base}/api/demo/reset`, { method: 'POST' });

const browser = await chromium.launch({ headless: true });
const errors = [];
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|tiles\.openfreemap|net::ERR/.test(m.text())) errors.push(`${label}: ${m.text()}`);
  });
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'viewer');
  let app; // the citizen app inside the phone frame

  await step('landing shows the lock-screen alert for a danger zone', async () => {
    await page.goto(base);
    const alert = page.getByTestId('lock-alert');
    await alert.waitFor();
    assert.match(await alert.innerText(), /EMERGENCY FLOOD/);
    assert.match(await alert.innerText(), /severe flood zone at Sunway–Monash/);
    await settle(page, 1500);
    await page.screenshot({ path: `${shots}/01-landing.png` });
  });

  await step('opening the alert opens the phone app on the emergency guide', async () => {
    await page.getByTestId('lock-alert').click();
    await page.waitForURL(`${base}/phone/citizen`);
    app = page.frameLocator('iframe');
    await app.locator('.fl-hero[data-tone="severe"]').waitFor();
    assert.match(await app.locator('.fl-hero h1').innerText(), /inside a flood danger zone/);
    assert.equal(await app.locator('.fl-steps li').count(), 4);
    assert.match(await app.locator('.fl-row[data-on]').innerText(), /Sunway University/);
    // The app has no role or device switch of its own: those live in the bar outside the phone.
    assert.equal(await app.locator('.fl-bar').count(), 0);
    assert.equal(await page.locator('.fl-bar .fl-seg').count(), 2);
    await settle(page, 6000);
    await page.screenshot({ path: `${shots}/02-phone-emergency-guide.png` });
  });

  await step('the map tab shows the 3D map with the route to the safe zone', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'Map' }).click();
    await app.locator('.fl-mapcard').waitFor();
    assert.match(await app.locator('.fl-mapcard').innerText(), /min walk/);
    await app.locator('.fl-you').waitFor();
    await settle(page, 7000);
    await page.screenshot({ path: `${shots}/03-phone-map-route.png` });
  });

  await step('news separates simulated updates from official warnings', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'News' }).click();
    await app.locator('.fl-news').first().waitFor();
    const text = await app.locator('.fl-scroll').innerText();
    assert.match(text, /Near you/);
    assert.match(text, /Official weather warnings/);
    assert.match(text, /Simulated ·/);
    await settle(page, 800);
    await page.screenshot({ path: `${shots}/04-phone-news.png` });
  });

  let sosId;
  await step('a request is sent from the phone', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'Get help' }).click();
    await app.getByRole('button', { name: 'One more' }).click();
    await app.getByRole('button', { name: 'One more' }).click();
    assert.equal(await app.getByTestId('people').innerText(), '3');
    await app.locator('#fl-note').fill('Second floor, water still rising');
    await page.screenshot({ path: `${shots}/05-phone-request-form.png` });
    await app.getByTestId('send-sos').click();
    sosId = await app.getByTestId('sos-id').innerText();
    assert.match(sosId, /^SOS-[0-9A-F]{8}$/);
    assert.match(await app.getByTestId('sos-headline').innerText(), /Waiting for a team/);
  });

  const ops = await ctx.newPage();
  watch(ops, 'responder');
  await step('the responder console already lists it', async () => {
    await ops.goto(`${base}/responder`);
    const item = ops.getByTestId('queue-item').filter({ hasText: sosId });
    await item.waitFor();
    assert.match(await item.innerText(), /Trapped · 3 people/);
    assert.match(await item.innerText(), /Monash University/);
  });

  await step('a second request reaches the open console in under a second, with a notification', async () => {
    const t = Date.now();
    await fetch(`${base}/api/sos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ incidentId: 'INC-DEMO-004', people: 2, type: 'medical-help', description: 'Elderly man needs his medicine', location: { lat: 3.0624, lng: 101.6058 }, locationMode: 'manual-demo' }) });
    await ops.getByTestId('queue-item').nth(1).waitFor({ timeout: 1000 });
    assert.ok(Date.now() - t < 1000);
    assert.match(await ops.locator('.fl-toast').first().innerText(), /New request · Medical/);
  });

  await step('sending a team updates the citizen within a second', async () => {
    await ops.getByTestId('queue-item').filter({ hasText: sosId }).click();
    assert.equal(await ops.getByTestId('detail-id').innerText(), sosId);
    await settle(ops, 7000);
    await ops.screenshot({ path: `${shots}/06-responder-console.png` });
    await ops.getByTestId('assign').click();
    await app.locator('[data-testid="sos-headline"]', { hasText: 'Team on the way' }).waitFor({ timeout: 1000 });
    assert.match(await app.locator('.fl-toast').first().innerText(), /Help is on the way/);
    await settle(page, 600);
    await page.screenshot({ path: `${shots}/07-phone-team-on-the-way.png` });
  });

  await step('resolving it updates the citizen within a second', async () => {
    await ops.getByTestId('resolve').click();
    await app.locator('[data-testid="sos-headline"]', { hasText: 'Resolved' }).waitFor({ timeout: 1000 });
  });

  await step('moving the citizen out of the zone changes the app to its calm state, and back in raises the alert', async () => {
    await page.locator('#fl-loc').selectOption('L10');
    await app.locator('.fl-hero[data-tone="safe"]').waitFor();
    assert.match(await app.locator('.fl-hero h1').innerText(), /outside the marked flood zones/);
    await settle(page, 800);
    await page.screenshot({ path: `${shots}/08-phone-outside-zones.png` });
    await page.locator('#fl-loc').selectOption('L9');
    await app.locator('.fl-hero[data-tone="high"]').waitFor();
    assert.match(await app.locator('.fl-toast').first().innerText(), /EMERGENCY FLOOD/);
    await page.locator('#fl-loc').selectOption('L7');
    await app.locator('.fl-hero[data-tone="severe"]').waitFor();
  });

  await step('the citizen app on a wide screen sits beside the map', async () => {
    await page.locator('.fl-bar .fl-seg a', { hasText: 'Desktop' }).click();
    await page.waitForURL(`${base}/citizen`);
    await page.locator('.fl-desk .fl-hero[data-tone="severe"]').waitFor();
    await page.locator('.fl-desk .fl-you').waitFor();
    await settle(page, 7000);
    await page.screenshot({ path: `${shots}/09-citizen-desktop.png` });
  });

  await step('switching role and device forty times never breaks a view', async () => {
    const order = ['Phone', 'First responder', 'Desktop', 'Citizen', 'Phone', 'Desktop', 'First responder', 'Citizen'];
    for (let i = 0; i < 5; i++) {
      for (const label of order) {
        await page.locator('.fl-bar .fl-seg a', { hasText: label }).click();
        await page.waitForTimeout(i % 2 ? 60 : 350);
        assert.equal(await page.locator('.fl-state[role="alert"]').count(), 0, `crash screen after ${label}`);
      }
    }
    await page.locator('.fl-desk .fl-hero').waitFor();
    await page.locator('.fl-map canvas').waitFor();
  });

  await step('the responder console works at phone width', async () => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    watch(p, 'responder-phone');
    await p.goto(`${base}/responder`);
    await p.getByTestId('queue-item').first().waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    await p.getByTestId('queue-item').first().click();
    await p.getByTestId('detail-id').waitFor();
    await p.locator('.fl-detail-back').click();
    await p.locator('.fl-ops-panes button', { hasText: 'Map' }).click();
    await p.locator('.fl-map canvas').waitFor();
    await phone.close();
  });

  await step('the citizen app fits a real phone with no sideways scrolling', async () => {
    const phone = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    watch(p, 'citizen-phone');
    await p.goto(`${base}/phone/citizen`);
    await p.locator('.fl-phoneapp .fl-hero').waitFor();
    for (const tab of ['Map', 'News', 'Get help']) {
      await p.locator('.fl-tabbar button', { hasText: tab }).click();
      await p.waitForTimeout(300);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${tab} overflows`);
    }
    await phone.close();
  });

  await step('old links land on the front door', async () => {
    await page.goto(`${base}/recovery`);
    await page.getByTestId('lock-alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  });

  assert.deepEqual(errors, [], 'browser errors');
  console.log(`\nAll ${steps.length} steps passed. Screenshots are in docs/screenshots.`);
} finally {
  await browser.close();
  await fetch(`${base}/api/demo/reset`, { method: 'POST' }).catch(() => {});
}
