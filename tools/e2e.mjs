// End-to-end check of the whole FLARE story in a real browser, against a running server. It also
// retakes docs/screenshots.
//
//   npm run build && PORT=8793 npm start -w server      (in one terminal)
//   node tools/e2e.mjs                                   (in another)
//
// Install the browser once with: npx playwright install chromium
// FLARE_TEST_URL overrides the server address; FLARE_SCREENSHOTS_DIR overrides the screenshot
// folder.
// The script resets the scenario before and after the run. Use a dedicated local test server.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.FLARE_TEST_URL ?? 'http://localhost:8793';
const shots = resolve(process.env.FLARE_SCREENSHOTS_DIR ?? 'docs/screenshots');
// Local regressions keep a one-second deadline; hosted checks allow for network round trips.
const liveTimeout = Number(process.env.FLARE_E2E_SYNC_TIMEOUT ?? 1000);

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
const expectedDispatchErrors = new WeakSet();
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    if (expectedDispatchErrors.has(page) && /503/.test(m.text())) {
      return;
    }
    if (m.type() === 'error' && !/favicon|tiles\.openfreemap|net::ERR/.test(m.text())) {
      errors.push(`${label}: ${m.text()}`);
    }
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
    await alert.getByText(/severe flood zone at Sunway–Monash/).waitFor();
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
    await page.getByTestId('phone-feature-note').getByText('Know what to do first').waitFor();
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
    await page
      .getByTestId('phone-feature-note')
      .getByText('Read the situation around you')
      .waitFor();
    assert.match(await app.locator('.fl-mapcard').innerText(), /min walk/);
    await app.locator('.fl-you').waitFor();
    // Opened from the tab bar, the map starts tilted: the button offers the flat view.
    assert.equal((await app.locator('.fl-map-tilt').innerText()).trim(), '2D');
    await settle(page, 7000);
    await page.screenshot({ path: `${shots}/03-phone-map-route.png` });
  });

  await step(
    'directions from the emergency guide open flat, and map information can be hidden',
    async () => {
      await app.locator('.fl-tabbar button', { hasText: 'Emergency' }).click();
      await app.getByRole('button', { name: /Show the route to/ }).click();
      await app.locator('.fl-mapcard').waitFor();
      // Flat now, so the button offers 3D. The person can still switch.
      assert.equal((await app.locator('.fl-map-tilt').innerText()).trim(), '3D');
      await app.locator('.fl-map-tilt').click();
      assert.equal((await app.locator('.fl-map-tilt').innerText()).trim(), '2D');
      await app.locator('.fl-map-tilt').click();

      assert.equal(await app.locator('.fl-legend').count(), 1);
      await app.getByTestId('map-info-toggle').click();
      for (const overlay of ['.fl-legend', '.fl-mapcard', '.fl-map-layers']) {
        assert.equal(await app.locator(overlay).count(), 0, `${overlay} should be hidden`);
      }
      // The route, your position and the safe zone stay on the map.
      await app.locator('.fl-you').waitFor();
      assert.match(await app.getByTestId('map-info-toggle').innerText(), /Show info/);
      await settle(page, 6000);
      await page.screenshot({ path: `${shots}/13-phone-map-clear-2d.png` });
      await app.getByTestId('map-info-toggle').click();
      await app.locator('.fl-mapcard').waitFor();
    },
  );

  await step('news separates simulated updates from official warnings', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'News' }).click();
    await app.locator('.fl-news').first().waitFor();
    await page
      .getByTestId('phone-feature-note')
      .getByText('Follow the changing situation')
      .waitFor();
    const text = await app.locator('.fl-scroll').innerText();
    assert.match(text, /Near you/);
    assert.match(text, /Official weather warnings/);
    assert.match(text, /Simulated ·/);
    // Exactly one item is marked as the most recent, and the strip at the top names it.
    assert.equal(await app.locator('.fl-news-flag[data-latest]').count(), 1);
    const latestTitle = await app.locator('.fl-news[data-latest] h3').innerText();
    assert.ok((await app.getByTestId('latest').innerText()).includes(latestTitle));
    const times = await app
      .locator('.fl-newsgroup')
      .first()
      .locator('time')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime')));
    assert.deepEqual([...times].sort().reverse(), times, 'a section lists newest first');
    await settle(page, 800);
    await page.screenshot({ path: `${shots}/04-phone-news.png` });
  });

  await step('the profile can be read and edited', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'Profile' }).click();
    assert.equal(await app.getByTestId('profile-name').innerText(), 'Aisyah Rahman');
    await page.getByTestId('phone-feature-note').getByText('Tell responders who you are').waitFor();
    await settle(page, 500);
    await page.screenshot({ path: `${shots}/14-phone-profile.png` });
    await app.getByTestId('edit-profile').click();
    await app.locator('#fl-profile-appearance').fill('Yellow raincoat, red umbrella');
    await app.locator('#fl-profile-age').fill('0');
    assert.equal(await app.getByTestId('save-profile').isDisabled(), true);
    await app.locator('#fl-profile-age').fill('22');
    await app.getByTestId('save-profile').click();
    assert.match(await app.locator('.fl-profile').innerText(), /Age 22/);
    assert.match(await app.locator('.fl-profile').innerText(), /red umbrella/);
  });

  let sosId;
  await step('a request is sent from the phone', async () => {
    await app.locator('.fl-tabbar button', { hasText: 'Get help' }).click();
    await page
      .getByTestId('phone-feature-note')
      .getByText('Ask for help and follow its progress')
      .waitFor();
    await app.getByRole('button', { name: 'One more' }).click();
    await app.getByRole('button', { name: 'One more' }).click();
    assert.equal(await app.getByTestId('people').innerText(), '3');
    await app.locator('#fl-note').fill('Second floor, water still rising');
    assert.match(await app.locator('.fl-sendas').innerText(), /Sending as Aisyah Rahman/);
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
    assert.match(await item.innerText(), /Aisyah Rahman, 22/);
  });

  await step('a second request reaches the open console with a live notification', async () => {
    const t = Date.now();
    await fetch(`${base}/api/sos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        incidentId: 'INC-DEMO-004',
        people: 2,
        type: 'medical-help',
        description: 'Elderly man needs his medicine',
        location: { lat: 3.0624, lng: 101.6058 },
        locationMode: 'manual-demo',
      }),
    });
    await ops.getByTestId('queue-item').nth(1).waitFor({ timeout: liveTimeout });
    assert.ok(Date.now() - t < 1000);
    assert.match(await ops.locator('.fl-toast').first().innerText(), /New request · Medical/);
    // On a wide screen a notification has a close button.
    await ops.locator('.fl-toast-close').first().click();
    assert.equal(await ops.locator('.fl-toast').count(), 0);
    // That request was sent without a profile, and the console says so.
    await ops.getByTestId('queue-item').nth(1).click();
    await ops.getByTestId('no-profile').waitFor();
  });

  await step('sending a team updates the citizen through the live stream', async () => {
    await ops.getByTestId('queue-item').filter({ hasText: sosId }).click();
    assert.equal(await ops.getByTestId('detail-id').innerText(), sosId);
    // The responder sees who is asking: the profile as edited on the phone.
    const who = await ops.getByTestId('request-profile').innerText();
    assert.match(who, /Aisyah Rahman/);
    assert.match(who, /Age 22/);
    assert.match(who, /red umbrella/);
    assert.match(who, /Asthma/);
    // Contact details are one click away, and the dispatch button stays on screen without
    // scrolling.
    await ops.getByTestId('request-profile').getByText('Contact and other details').click();
    assert.match(await ops.getByTestId('request-profile').innerText(), /Rahman Idris \(father\)/);
    await ops.getByTestId('request-profile').getByText('Contact and other details').click();
    assert.equal(await ops.getByTestId('assign').isVisible(), true);
    const assign = await ops.getByTestId('assign').boundingBox();
    assert.ok(assign.y + assign.height <= ops.viewportSize().height, 'dispatch button is in view');
    // A failed assignment must show an error and leave the controls available for a retry.
    expectedDispatchErrors.add(ops);
    await ops.route('**/api/sos/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Temporary dispatch failure' }),
          })
        : route.continue(),
    );
    await ops.getByTestId('assign').click();
    await ops.getByRole('alert').filter({ hasText: 'Temporary dispatch failure' }).waitFor();
    assert.equal(await ops.getByTestId('assign').isEnabled(), true);
    await ops.unroute('**/api/sos/*');
    expectedDispatchErrors.delete(ops);
    await settle(ops, 7000);
    await ops.screenshot({ path: `${shots}/06-responder-console.png` });
    await ops.getByTestId('assign').click();
    await app
      .locator('[data-testid="sos-headline"]', { hasText: 'Team on the way' })
      .waitFor({ timeout: liveTimeout });
    const statusBanner = app.locator('.fl-toast').filter({ hasText: 'Help is on the way' });
    await statusBanner.waitFor({ timeout: liveTimeout });
    await settle(page, 600);
    await page.screenshot({ path: `${shots}/07-phone-team-on-the-way.png` });
    // On the phone a notification is swiped away. A short drag puts it back; a long one clears it.
    const banner = await statusBanner.boundingBox();
    const y = banner.y + banner.height / 2;
    const x = banner.x + banner.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y, { steps: 4 });
    await page.mouse.up();
    // Scenario news can arrive during this step. Follow the dispatch banner, not the total count.
    assert.equal(await statusBanner.count(), 1, 'a short drag keeps the notification');
    assert.equal(await statusBanner.locator('.fl-toast-close').isVisible(), false);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 160, y, { steps: 8 });
    await page.mouse.up();
    await statusBanner.waitFor({ state: 'detached', timeout: 2000 });
    // Swiping it away must not have opened anything: the request screen is still showing.
    await app.getByTestId('sos-headline').waitFor();
  });

  await step('resolving it updates the citizen through the live stream', async () => {
    await ops.getByTestId('resolve').click();
    await app
      .locator('[data-testid="sos-headline"]', { hasText: 'Resolved' })
      .waitFor({ timeout: liveTimeout });
  });

  await step(
    'moving the citizen out of the zone changes the app to its calm state, and back in raises the alert',
    async () => {
      await page.locator('#fl-loc').selectOption('L10');
      await app.locator('.fl-hero[data-tone="safe"]').waitFor();
      assert.match(await app.locator('.fl-hero h1').innerText(), /outside the marked flood zones/);
      await settle(page, 800);
      await page.screenshot({ path: `${shots}/08-phone-outside-zones.png` });
      await app.locator('.fl-tabbar button', { hasText: 'Get help' }).click();
      assert.match(await app.locator('.fl-facts').innerText(), /Monash University/);
      assert.doesNotMatch(await app.locator('.fl-facts').innerText(), /Sunway Pyramid/);
      await page.locator('#fl-loc').selectOption('L9');
      await app.locator('.fl-hero[data-tone="high"]').waitFor();
      assert.match(await app.locator('.fl-toast').first().innerText(), /EMERGENCY FLOOD/);
      await page.locator('#fl-loc').selectOption('L7');
      await app.locator('.fl-hero[data-tone="severe"]').waitFor();
    },
  );

  await step('the citizen app on a wide screen sits beside the map', async () => {
    await page.locator('.fl-bar .fl-seg a', { hasText: 'Desktop' }).click();
    await page.waitForURL(`${base}/citizen`);
    await page.locator('.fl-desk .fl-hero[data-tone="severe"]').waitFor();
    await page.locator('.fl-desk .fl-you').waitFor();
    await settle(page, 7000);
    await page.screenshot({ path: `${shots}/09-citizen-desktop.png` });
  });

  await step('all four areas have detailed zones, relief points and map layers', async () => {
    for (const [place, area, screenshot] of [
      ['L7', 'Sunway', null],
      ['L1', 'Shah Alam', '10-shah-alam.png'],
      ['L4', 'Subang Jaya', '11-subang-jaya.png'],
      ['L6', 'Klang', '12-klang.png'],
    ]) {
      await page.locator('#fl-loc').selectOption(place);
      await page.locator('.fl-hero[data-tone="severe"]').waitFor();
      await page.locator('.fl-service-pin').nth(3).waitFor();
      assert.equal(await page.locator('.fl-service-pin').count(), 4, area);
      assert.equal(await page.locator('.fl-closure-pin').count(), 2, area);
      assert.equal(await page.locator('.fl-pin-safe').count(), 3, area);
      await page.locator('.fl-map-layers summary').click();
      const services = page.getByRole('checkbox', { name: 'Police, fire and aid' });
      await services.uncheck();
      assert.equal(await page.locator('.fl-service-pin').count(), 0);
      await services.check();
      const closures = page.getByRole('checkbox', { name: 'Roadblocks and closures' });
      await closures.uncheck();
      assert.equal(await page.locator('.fl-closure-pin').count(), 0);
      await closures.check();
      await page.locator('.fl-map-layers summary').click();
      if (screenshot) {
        await page.locator('.fl-toast').last().waitFor({ state: 'hidden', timeout: 20_000 });
        await settle(page, 1800);
        await page.screenshot({ path: `${shots}/${screenshot}` });
      }
    }
    await page.locator('#fl-loc').selectOption('L7');
  });

  await step(
    'operational markers and closures explain their simulation status on keyboard activation',
    async () => {
      const marker = page.locator('.fl-service-pin').first();
      await marker.focus();
      await marker.press('Enter');
      await page.getByText('Illustrated response post; availability is not verified.').waitFor();
      await page.getByRole('button', { name: 'Close popup' }).click();
      const closure = page.locator('.fl-closure-pin').first();
      await closure.focus();
      await closure.press('Enter');
      await page
        .getByText('Illustrated segment. Stored routes do not avoid this closure.')
        .waitFor();
      await page.getByRole('button', { name: 'Close popup' }).click();
    },
  );

  await step('switching role and device forty times never breaks a view', async () => {
    const order = [
      'Phone',
      'First responder',
      'Desktop',
      'Citizen',
      'Phone',
      'Desktop',
      'First responder',
      'Citizen',
    ];
    for (let i = 0; i < 5; i++) {
      for (const label of order) {
        await page.locator('.fl-bar .fl-seg a', { hasText: label }).click();
        await page.waitForTimeout(i % 2 ? 60 : 350);
        assert.equal(
          await page.locator('.fl-state[role="alert"]').count(),
          0,
          `crash screen after ${label}`,
        );
      }
    }
    await page.locator('.fl-desk .fl-hero').waitFor();
    await page.locator('.fl-map canvas').waitFor();
  });

  await step('the responder console works at phone width', async () => {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await phone.newPage();
    watch(p, 'responder-phone');
    await p.goto(`${base}/responder`);
    await p.getByTestId('queue-item').first().waitFor();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
      0,
    );
    await p.getByTestId('queue-item').first().click();
    await p.getByTestId('detail-id').waitFor();
    await p.locator('.fl-detail-back').click();
    await p.locator('.fl-ops-panes button', { hasText: 'Map' }).click();
    await p.locator('.fl-map canvas').waitFor();
    await phone.close();
  });

  await step('the citizen app fits a real phone with no sideways scrolling', async () => {
    const phone = await browser.newContext({
      viewport: { width: 375, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await phone.newPage();
    watch(p, 'citizen-phone');
    await p.goto(`${base}/phone/citizen`);
    await p.locator('.fl-phoneapp .fl-hero').waitFor();
    for (const tab of ['Map', 'News', 'Get help']) {
      await p.locator('.fl-tabbar button', { hasText: tab }).click();
      await p.waitForTimeout(300);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        0,
        `${tab} overflows`,
      );
    }
    await phone.close();
  });

  await step('the responder phone notes follow request selection', async () => {
    const preview = await ctx.newPage();
    watch(preview, 'responder phone');
    await preview.goto(`${base}/phone/responder`);
    const note = preview.getByTestId('phone-feature-note');
    await note.getByText('See who needs help').waitFor();
    const responder = preview.frameLocator('iframe');
    await responder.getByTestId('queue-item').first().click();
    await note.getByText('Coordinate a response').waitFor();
    await responder.locator('.fl-detail-back').click();
    await note.getByText('See who needs help').waitFor();
    await preview.close();
  });

  await step('a first-load API failure offers a working retry', async () => {
    const offline = await ctx.newPage();
    watch(offline, 'connection failure');
    await offline.route('**/api/scenario', (route) => route.abort('failed'));
    await offline.goto(`${base}/citizen`);
    await offline.getByRole('alert').filter({ hasText: 'Could not load' }).waitFor();
    await offline.unroute('**/api/scenario');
    await offline.getByRole('button', { name: 'Try again' }).click();
    await offline.locator('.fl-hero').waitFor();
    await offline.close();
  });

  await step('the scenario map works when the basemap service is unavailable', async () => {
    const blank = await ctx.newPage();
    watch(blank, 'offline basemap');
    await blank.route('https://tiles.openfreemap.org/**', (route) => route.abort('failed'));
    await blank.goto(`${base}/citizen`);
    await blank.locator('.fl-map canvas').waitFor();
    await blank.locator('.fl-service-pin').nth(3).waitFor();
    assert.equal(await blank.locator('.fl-closure-pin').count(), 2);
    await blank.close();
  });

  await step('old links land on the front door', async () => {
    await page.goto(`${base}/recovery`);
    await page.getByTestId('lock-alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  });

  await step('older scenario responses keep both citizen and responder views usable', async () => {
    const { mapPoints, roadClosures, ...olderScenario } = await (
      await fetch(`${base}/api/scenario`)
    ).json();
    assert.ok(mapPoints.length && roadClosures.length);
    const legacy = await ctx.newPage();
    watch(legacy, 'older scenario');
    await legacy.route('**/api/scenario', (route) => route.fulfill({ json: olderScenario }));
    await legacy.goto(`${base}/citizen`);
    await legacy.locator('.fl-hero').waitFor();
    await legacy.locator('.fl-map canvas').waitFor();
    assert.equal(await legacy.locator('.fl-state[role="alert"]').count(), 0);
    assert.equal(await legacy.locator('.fl-service-pin').count(), 0);
    await legacy.goto(`${base}/responder`);
    await legacy.locator('.fl-ops').waitFor();
    await legacy.locator('.fl-map canvas').waitFor();
    assert.equal(await legacy.locator('.fl-state[role="alert"]').count(), 0);
    await legacy.close();
  });

  assert.deepEqual(errors, [], 'browser errors');
  console.log(`\nAll ${steps.length} steps passed. Screenshots are in ${shots}.`);
} finally {
  await browser.close();
  await fetch(`${base}/api/demo/reset`, { method: 'POST' }).catch(() => {});
}
