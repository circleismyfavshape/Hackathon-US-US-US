// Run from repo root; see this module's README for isolated Playwright setup.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createSampleClient } from "./responderApi.ts";

const requireBrowser = createRequire(
  resolve(
    process.env.FLARE_BROWSER_TOOLS ?? ".board/browser-tools",
    "package.json",
  ),
);
const { chromium } = requireBrowser("playwright");
const base = process.env.FLARE_TEST_URL ?? "http://localhost:8793";
let browser;
before(async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  browser = await chromium.launch({ headless: true });
  await mkdir(".board", { recursive: true });
});
after(async () => {
  await browser?.close();
});

async function newPage(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    ...options,
  });
  page.setDefaultTimeout(10000);
  return page;
}
async function createSos(page) {
  const response = await page.request.post(`${base}/api/sos`, {
    data: {
      incidentId: "INC-DEMO-001",
      people: 3,
      type: "trapped",
      description: "Fictional browser acceptance request upstairs. Demo only.",
      location: { lat: 3.073, lng: 101.52 },
      locationMode: "manual-demo",
    },
  });
  assert.equal(response.status(), 201);
  return response.json();
}
async function getSos(page, id) {
  return (await page.request.get(`${base}/api/sos/${id}`)).json();
}
async function assertNoHorizontalOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
}

test('citizen UI submits an SOS and sees responder assignment and resolution without reload', async () => {
  const citizen = await newPage();
  const responder = await newPage();
  try {
    await citizen.goto(`${base}/citizen`);
    await responder.goto(`${base}/responder`);
    await citizen.getByRole('radiogroup', { name: 'Where are you?' }).getByRole('radio', { name: 'L1', exact: true }).click();
    await citizen.getByRole('spinbutton', { name: 'People', exact: true }).fill('3');
    await citizen.getByRole('spinbutton', { name: 'People', exact: true }).press('Tab');
    await citizen.getByRole('textbox', { name: /What is happening/ }).fill('Fictional two-tab test: three people waiting upstairs.');
    await citizen.getByRole('button', { name: 'Send demo SOS', exact: true }).click();
    await citizen.getByTestId('sos-id').waitFor();
    const id = (await citizen.getByTestId('sos-id').innerText()).trim();
    assert.match(id, /^SOS-/);
    assert.equal(await citizen.getByTestId('sos-status').getAttribute('data-status'), 'pending');
    await responder.locator('.flare-request-row').filter({ hasText: id }).click();
    await responder.getByRole('button', { name: 'Assign Demo Team' }).click();
    await citizen.locator('[data-testid="sos-status"][data-status="assigned"]').waitFor();
    assert.match(await citizen.getByTestId('sos-status').innerText(), /Demo Rescue A/);
    await responder.getByRole('button', { name: 'Mark Resolved', exact: true }).click();
    await citizen.locator('[data-testid="sos-status"][data-status="resolved"]').waitFor();
    assert.equal((await getSos(responder, id)).status, 'resolved');
    await citizen.screenshot({ path: '.board/citizen-roundtrip.png', fullPage: true });
    await responder.screenshot({ path: '.board/responder-live.png' });
  } finally { await citizen.close(); await responder.close(); }
});

test('all four live recovery strategies render distinct allocations without stock changes or responsive overflow', async () => {
  const page = await newPage();
  try {
    const before = await (await page.request.get(`${base}/api/recovery`)).json();
    await page.goto(`${base}/responder`);
    await page.getByRole('button', { name: 'Compare strategies' }).click();
    await page.locator('.flare-recovery-allocation').nth(11).waitFor();
    assert.equal(await page.locator('.flare-recovery-result').count(), 4);
    assert.equal(await page.locator('.flare-recovery-allocation table').count(), 12);
    const waterForA = [];
    for (let index = 0; index < 4; index++) {
      waterForA.push(await page.locator('.flare-recovery-result').nth(index).locator('tbody tr').first().locator('td').first().innerText());
    }
    assert.deepEqual(waterForA, ['120', '76', '74', '91']);
    assert.deepEqual(await (await page.request.get(`${base}/api/recovery`)).json(), before);
    assert.equal(await page.locator('.flare-recovery-error').count(), 0);
    await page.setViewportSize({ width: 1024, height: 900 });
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
  } finally { await page.close(); }
});

test('responder replaces the yellow global banner with compact simulation context', async () => {
  const page = await newPage();
  try {
    await page.goto(`${base}/responder`);
    await page.getByText('Simulation workspace', { exact: true }).waitFor();
    assert.equal(await page.locator('[role="status"][class*="sticky"]').count(), 0);
    assert.equal(await page.getByText('HACKATHON DEMO — simulated disaster data; not an emergency service.', { exact: true }).count(), 0);
    const chipHeight = await page.locator('.flare-simulation-chip').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(chipHeight <= 36, `Simulation context should be compact, got ${chipHeight}px`);
  } finally { await page.close(); }
});

test('reduced-motion preference removes long animations and transitions from the responder workspace', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(`${base}/responder?mode=sample`);
    await page.getByRole('heading', { name: 'SAMPLE-001', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Compare strategies' }).click();
    await page.locator('.flare-recovery-allocation').nth(8).waitFor();
    const violations = await page.locator('.flare-ops').evaluate(root => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return ['Reduced-motion media preference was not applied'];
      const seconds = value => value.split(',').map(item => parseFloat(item) * (item.trim().endsWith('ms') ? 0.001 : 1));
      const failures = [];
      for (const element of [root, ...root.querySelectorAll('*')]) {
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(element, pseudo);
          if ((style.animationName !== 'none' && seconds(style.animationDuration).some(duration => duration > 0.05)) || seconds(style.transitionDuration).some(duration => duration > 0.05)) {
            failures.push(`${element.tagName}.${element.getAttribute('class') ?? ''}${pseudo ?? ''}: animation=${style.animationDuration}, transition=${style.transitionDuration}`);
          }
        }
      }
      return failures;
    });
    assert.deepEqual(violations, []);
  } finally { await page.close(); }
});

test("sample queue actions and all strategy tables work without API calls; desktop/mobile fit", async () => {
  const page = await newPage();
  try {
    const apiCalls = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        apiCalls.push(request.url());
    });
    await page.goto(`${base}/responder?mode=sample`);
    await page
      .getByRole("heading", { name: "SAMPLE-001", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Assign Demo Team" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "SAMPLE-001 assigned to Demo Rescue A" })
      .waitFor();
    await page
      .getByRole("button", { name: "Mark Resolved", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "SAMPLE-001 marked resolved" })
      .waitFor();
    await page.getByRole("button", { name: "Compare strategies" }).click();
    await page.locator(".flare-recovery-allocation").nth(8).waitFor();
    assert.equal(await page.locator(".flare-recovery-result").count(), 3);
    assert.equal(
      await page.locator(".flare-recovery-allocation table").count(),
      9,
    );
    await page.getByLabel("Focus strategy").selectOption("equal-share");
    assert.match(
      await page.locator(".flare-recovery-result-focused").innerText(),
      /Equal share/,
    );
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: ".board/responder-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: ".board/responder-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(apiCalls, []);
  } finally {
    await page.close();
  }
});

test("live queue polls new SOS; assign and resolve persist for a second client", async () => {
  const page = await newPage();
  try {
    await page.goto(`${base}/responder`);
    const created = await createSos(page);
    await page
      .locator(".flare-request-row")
      .filter({ hasText: created.id })
      .click();
    await page
      .getByLabel("Fictional responder team")
      .selectOption("Demo Rescue B");
    await page.getByRole("button", { name: "Assign Demo Team" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: `${created.id} assigned to Demo Rescue B` })
      .waitFor();
    assert.equal((await getSos(page, created.id)).status, "assigned");
    assert.equal(
      (await getSos(page, created.id)).assignedTeam,
      "Demo Rescue B",
    );
    await page.request.patch(`${base}/api/sos/${created.id}`, {
      data: { status: "assigned", assignedTeam: "Demo Boat Team C" },
    });
    await page.waitForFunction(
      () => document.querySelector("#demo-team")?.value === "Demo Boat Team C",
    );
    await page
      .getByRole("button", { name: "Mark Resolved", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: `${created.id} marked resolved` })
      .waitFor();
    const observed = await getSos(page, created.id);
    assert.equal(observed.status, "resolved");
    assert.equal(observed.assignedTeam, "Demo Boat Team C");
    assert.equal(
      await page.getByRole("button", { name: "Marked resolved" }).isDisabled(),
      true,
    );
  } finally {
    await page.close();
  }
});

test("failed PATCH stays pending and source switching is disabled while writing", async () => {
  const page = await newPage();
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await page
      .locator(".flare-request-row")
      .filter({ hasText: created.id })
      .click();
    let release;
    const gate = new Promise((resolveGate) => {
      release = resolveGate;
    });
    await page.route(`**/api/sos/${created.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic update failure" },
      });
    });
    await page.getByRole("button", { name: "Assign Demo Team" }).click();
    await page.getByRole("button", { name: "Saving…" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Sample responses", exact: true })
        .isDisabled(),
      true,
    );
    release();
    await page
      .getByRole("alert")
      .filter({ hasText: "Update failed: Synthetic update failure" })
      .waitFor();
    assert.equal((await getSos(page, created.id)).status, "pending");
    assert.equal(await page.locator(".flare-success").count(), 0);
  } finally {
    await page.close();
  }
});

test("failed queue polling shows stale state and disables actions; initial failure never selects samples", async () => {
  const page = await newPage();
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await page
      .locator(".flare-request-row")
      .filter({ hasText: created.id })
      .click();
    await page.route("**/api/sos", (route) =>
      route.fulfill({ status: 503, json: { error: "Queue offline" } }),
    );
    await page
      .getByRole("alert")
      .filter({ hasText: "last successful snapshot" })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Assign Demo Team" }).isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Mark Resolved", exact: true })
        .isDisabled(),
      true,
    );
    await page.reload();
    await page.getByRole("heading", { name: "Queue unavailable" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Live demo API", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator(".flare-request-row").count(), 0);
  } finally {
    await page.close();
  }
});

test("recovery renders each API response, exposes partial errors and rejects mismatched strategy", async () => {
  const page = await newPage();
  try {
    const samples = createSampleClient();
    await page.route("**/api/recovery/compare", async (route) => {
      const { strategy } = route.request().postDataJSON();
      if (strategy === "proportional")
        return route.fulfill({
          status: 501,
          json: { error: "Engine not merged" },
        });
      if (strategy === "optimized")
        return route.fulfill({
          status: 503,
          json: { error: "Optimized allocation unavailable for this test" },
        });
      return route.fulfill({
        json: await samples.compare(
          strategy === "equal-share" ? "priority-first" : strategy,
        ),
      });
    });
    await page.goto(`${base}/responder`);
    await page.getByRole("button", { name: "Compare strategies" }).click();
    await page.getByRole("alert").filter({ hasText: "HTTP 501" }).waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "different strategy" })
      .waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "Optimized allocation unavailable for this test" })
      .waitFor();
    assert.equal(await page.locator(".flare-recovery-allocation").count(), 3);
    assert.match(
      await page.locator(".flare-recovery-remaining").innerText(),
      /0 water/,
    );
  } finally {
    await page.close();
  }
});
