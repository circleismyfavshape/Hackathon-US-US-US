// Unified FLARE regression. Run against a dedicated server; creates fictional SOS.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const requireBrowser = createRequire(
  resolve(
    process.env.FLARE_BROWSER_TOOLS ?? ".board/browser-tools",
    "package.json",
  ),
);
const { chromium } = requireBrowser("playwright");
const base = process.env.FLARE_TEST_URL ?? "http://localhost:8793";
const strategyNames = {
  "priority-first": "Priority first",
  proportional: "Proportional",
  "equal-share": "Equal share",
  optimized: "Optimized",
};
const resources = ["water", "food", "hygiene"];
let browser;
let incident;
let location;
let teams;

before(async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const incidents = await (await fetch(`${base}/api/incidents`)).json();
  const config = await (await fetch(`${base}/api/demo/config`)).json();
  incident = incidents.find((row) => row.id === "INC-DEMO-001");
  location = config.demoLocations.find((row) => row.incidentId === incident.id);
  teams = config.demoTeams;
  assert.ok(
    incident && location && teams.length,
    "Unified scenario and team configuration must be available",
  );
  browser = await chromium.launch({ headless: true });
  await mkdir(".board", { recursive: true });
});
after(async () => {
  await browser?.close();
});

async function newPage(viewport = { width: 1440, height: 1100 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(12000);
  return page;
}
async function createSos(page) {
  const response = await page.request.post(`${base}/api/sos`, {
    data: {
      incidentId: incident.id,
      people: 3,
      type: "trapped",
      description:
        "Fictional unified UI browser regression request. Demo only.",
      location: location.location,
      locationMode: "manual-demo",
    },
  });
  assert.equal(response.status(), 201);
  return response.json();
}
async function getSos(page, id) {
  return (await page.request.get(`${base}/api/sos/${id}`)).json();
}
const queue = (page) =>
  page.getByRole("region", { name: "Request queue", exact: true });
const detail = (page) =>
  page.getByRole("region", { name: "Request detail", exact: true });
async function chooseRequest(page, id) {
  await queue(page)
    .getByRole("button")
    .filter({ has: page.getByTestId("sos-id").filter({ hasText: id }) })
    .click();
  await detail(page).getByText(id, { exact: true }).waitFor();
}
async function waitStatus(page, status) {
  await page
    .locator(`[data-testid="sos-status"][data-status="${status}"]`)
    .waitFor();
}
async function assertNoHorizontalOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
}

async function clickInPhone(page, iframe, target) {
  // The phone frame uses CSS zoom. Translate its viewport coordinates explicitly
  // for a real mouse click; no force/DOM click that could bypass an obstruction.
  await target.scrollIntoViewIfNeeded();
  const frameBox = await iframe.boundingBox();
  assert.ok(frameBox);
  const point = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    return {
      x,
      y,
      width: innerWidth,
      height: innerHeight,
      hit: element.contains(document.elementFromPoint(x, y)),
    };
  });
  assert.equal(
    point.hit,
    true,
    "Phone control must be unobstructed inside the iframe",
  );
  const x = frameBox.x + (point.x * frameBox.width) / point.width;
  const y = frameBox.y + (point.y * frameBox.height) / point.height;
  assert.equal(
    await iframe.evaluate(
      (element, point) =>
        document.elementFromPoint(point.x, point.y) === element,
      { x, y },
    ),
    true,
    "Phone iframe must be unobstructed in the outer page",
  );
  await page.mouse.click(x, y);
}

test("unified citizen toggles and stepper create SOS; responder assigns and resolves without citizen reload", async () => {
  const citizen = await newPage();
  const responder = await newPage();
  try {
    await citizen.goto(`${base}/citizen`);
    await responder.goto(`${base}/responder`);
    await citizen
      .locator("button.fl-area")
      .filter({ hasText: "Shah Alam" })
      .click();
    await citizen
      .getByText(/Simulation: no emergency service receives this/)
      .waitFor();
    await citizen
      .getByRole("button", { name: new RegExp(`^${location.id} `) })
      .click();
    await citizen
      .getByRole("button", { name: "More people", exact: true })
      .click();
    await citizen
      .getByRole("button", { name: "More people", exact: true })
      .click();
    await citizen
      .getByRole("group", { name: "Type of help" })
      .getByRole("button", { name: "Supplies", exact: true })
      .click();
    await citizen
      .getByRole("textbox", { name: /What is happening/ })
      .fill("Fictional two-tab test: three people waiting upstairs.");
    const createdResponse = citizen.waitForResponse(
      (response) =>
        response.url().endsWith("/api/sos") &&
        response.request().method() === "POST",
    );
    await citizen
      .getByRole("button", { name: "Send SOS", exact: true })
      .click();
    const response = await createdResponse;
    assert.equal(response.status(), 201);
    const created = await response.json();
    assert.equal(created.people, 3);
    assert.equal(created.type, "supplies");
    assert.equal(created.incidentId, incident.id);
    assert.equal(created.locationMode, "manual-demo");
    assert.deepEqual(created.location, location.location);
    const id = created.id;
    await citizen.getByTestId("sos-id").filter({ hasText: id }).waitFor();
    await waitStatus(citizen, "pending");
    await chooseRequest(responder, id);
    await detail(responder).getByRole("combobox").selectOption(teams[0]);
    await detail(responder)
      .getByRole("button", { name: "Assign team", exact: true })
      .click();
    await waitStatus(citizen, "assigned");
    assert.equal((await getSos(responder, id)).assignedTeam, teams[0]);
    await citizen.locator(".fl-toast").filter({ hasText: teams[0] }).waitFor();
    await detail(responder)
      .getByRole("button", { name: "Mark resolved", exact: true })
      .click();
    await waitStatus(citizen, "resolved");
    await citizen
      .getByText(/Simulation: no emergency service receives this/)
      .waitFor();
    const observed = await getSos(responder, id);
    assert.equal(observed.status, "resolved");
    assert.equal(observed.assignedTeam, teams[0]);
    await citizen.reload();
    await citizen.getByTestId("sos-id").filter({ hasText: id }).waitFor();
    await waitStatus(citizen, "resolved");
    await citizen.screenshot({
      path: ".board/unified-citizen-roundtrip.png",
      fullPage: true,
    });
    await responder.screenshot({ path: ".board/unified-responder.png" });
  } finally {
    await citizen.close();
    await responder.close();
  }
});

test("queue filters and return-to-pending reflect persisted state and clear the assigned team", async () => {
  const page = await newPage();
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await chooseRequest(page, created.id);
    await detail(page)
      .getByRole("button", { name: "Assign team", exact: true })
      .click();
    await detail(page)
      .getByRole("button", { name: "Return to pending", exact: true })
      .waitFor();
    await page
      .getByRole("group", { name: "Filter requests" })
      .getByRole("button", { name: /^Assigned/ })
      .click();
    await queue(page)
      .getByTestId("sos-id")
      .filter({ hasText: created.id })
      .waitFor();
    await detail(page)
      .getByRole("button", { name: "Return to pending", exact: true })
      .click();
    await detail(page)
      .getByRole("button", { name: "Assign team", exact: true })
      .waitFor();
    const result = await getSos(page, created.id);
    assert.equal(result.status, "pending");
    assert.equal(result.assignedTeam, null);
    await page
      .getByRole("group", { name: "Filter requests" })
      .getByRole("button", { name: /^Pending/ })
      .click();
    await queue(page)
      .getByTestId("sos-id")
      .filter({ hasText: created.id })
      .waitFor();
  } finally {
    await page.close();
  }
});

test("failed assignment reports Not saved and never changes backend status", async () => {
  const page = await newPage();
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await chooseRequest(page, created.id);
    let release;
    const gate = new Promise((resolveGate) => {
      release = resolveGate;
    });
    await page.route(`**/api/sos/${created.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic assignment failure" },
      });
    });
    await detail(page)
      .getByRole("button", { name: "Assign team", exact: true })
      .click();
    await detail(page)
      .getByRole("button", { name: "Saving…", exact: true })
      .waitFor();
    assert.equal(
      await detail(page)
        .getByRole("button", { name: "Saving…", exact: true })
        .isDisabled(),
      true,
    );
    release();
    await detail(page)
      .getByRole("alert")
      .filter({ hasText: "Not saved. Synthetic assignment failure" })
      .waitFor();
    assert.equal((await getSos(page, created.id)).status, "pending");
    assert.equal(
      await detail(page).getByTestId("sos-status").getAttribute("data-status"),
      "pending",
    );
  } finally {
    await page.close();
  }
});

test("poll loss is visible, preserves the last queue and recovers from the same backend", async () => {
  const page = await newPage();
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await chooseRequest(page, created.id);
    await page.route("**/api/sos", (route) =>
      route.fulfill({ status: 503, json: { error: "Queue offline" } }),
    );
    await queue(page)
      .getByRole("status")
      .filter({ hasText: "Connection lost" })
      .waitFor();
    await queue(page)
      .getByTestId("sos-id")
      .filter({ hasText: created.id })
      .waitFor();
    await page.unroute("**/api/sos");
    await queue(page)
      .getByRole("status")
      .filter({ hasText: /^Live/ })
      .waitFor();
  } finally {
    await page.close();
  }
});

test("all four recovery strategies display exact backend allocations and unmet quantities without stock mutation", async () => {
  const page = await newPage();
  try {
    const before = await (
      await page.request.get(`${base}/api/recovery`)
    ).json();
    const expected = {};
    for (const strategy of Object.keys(strategyNames)) {
      const response = await page.request.post(`${base}/api/recovery/compare`, {
        data: { strategy },
      });
      assert.equal(response.status(), 200);
      expected[strategy] = await response.json();
    }
    await page.goto(`${base}/recovery`);
    const strategies = page.getByRole("region", {
      name: "Strategies",
      exact: true,
    });
    const allocations = page.getByRole("region", {
      name: "Allocation by centre",
      exact: true,
    });
    assert.equal(await strategies.locator("tbody tr").count(), 4);
    for (const [strategy, name] of Object.entries(strategyNames)) {
      const row = strategies.getByRole("row", { name: new RegExp(`^${name}`) });
      await row.click();
      await allocations.getByRole("heading", { name, exact: true }).waitFor();
      await allocations.locator(".fl-centre").nth(2).waitFor();
      const actual = await allocations
        .locator(".fl-centre")
        .evaluateAll((cards) =>
          cards.map((card) => ({
            name: card.querySelector("h3").textContent,
            rows: [...card.querySelectorAll(".fl-resrow")].map((row) => {
              const value = row.querySelector("span.fl-mono");
              return {
                resource: row.querySelector('span.fl-dim').textContent,
                amount: [...value.childNodes]
                  .filter((node) => node.nodeType === 3)
                  .map((node) => node.textContent)
                  .join(""),
                unmet: value.querySelector("em")?.textContent ?? null,
              };
            }),
          })),
        );
      assert.equal(actual.length, expected[strategy].allocations.length);
      for (
        let index = 0;
        index < expected[strategy].allocations.length;
        index++
      ) {
        const allocation = expected[strategy].allocations[index];
        const centre = before.centres.find(
          (centre) => centre.id === allocation.centreId,
        );
        assert.ok(actual[index].name.startsWith(centre.name));
        assert.deepEqual(
          actual[index].rows,
          resources.map((resource) => ({
            resource: { water: 'Water', food: 'Food', hygiene: 'Hygiene' }[resource],
            amount: `${allocation.allocated[resource]}/${centre.needs[resource]}`,
            unmet: allocation.unmet[resource]
              ? `−${allocation.unmet[resource]}`
              : null,
          })),
        );
      }
      assert.equal(await row.getAttribute("aria-selected"), "true");
      await allocations
        .getByText(
          `Stock left after this split: ${resources.map((resource) => `${resource} ${expected[strategy].inventoryRemaining[resource]}`).join(" · ")}`,
          { exact: true },
        )
        .waitFor();
    }
    assert.deepEqual(
      await (await page.request.get(`${base}/api/recovery`)).json(),
      before,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: ".board/unified-recovery-mobile.png",
      fullPage: true,
    });
  } finally {
    await page.close();
  }
});

test("recovery exposes one failed strategy while other strategies remain usable; unavailable AI hides cleanly", async () => {
  const page = await newPage();
  try {
    await page.route("**/api/recovery/compare", (route) =>
      route.request().postDataJSON().strategy === "optimized"
        ? route.fulfill({
            status: 503,
            json: { error: "Synthetic optimizer failure" },
          })
        : route.continue(),
    );
    await page.route("**/api/recovery/explain", (route) =>
      route.fulfill({ status: 503, json: { error: "AI unavailable" } }),
    );
    await page.goto(`${base}/recovery`);
    const strategies = page.getByRole("region", {
      name: "Strategies",
      exact: true,
    });
    const allocations = page.getByRole("region", {
      name: "Allocation by centre",
      exact: true,
    });
    await strategies.getByRole("row", { name: /^Optimized/ }).click();
    await allocations
      .getByText("This strategy is unavailable. Synthetic optimizer failure", {
        exact: true,
      })
      .waitFor();
    assert.equal(await allocations.locator(".fl-centre").count(), 0);
    await strategies.getByRole("row", { name: /^Proportional/ }).click();
    await allocations.locator(".fl-centre").nth(2).waitFor();
    await page
      .getByRole("button", { name: "Summarise the trade-offs", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Summarise the trade-offs", exact: true })
      .waitFor({ state: "detached" });
    assert.equal(
      await page
        .getByText("AI summary of the engine's numbers", { exact: true })
        .count(),
      0,
    );
  } finally {
    await page.close();
  }
});

test("390px responder and phone iframe both support real assignments and resolution", async () => {
  const page = await newPage({ width: 390, height: 844 });
  try {
    const created = await createSos(page);
    await page.goto(`${base}/responder`);
    await chooseRequest(page, created.id);
    await assertNoHorizontalOverflow(page);
    await detail(page)
      .getByRole("button", { name: "Assign team", exact: true })
      .click();
    await detail(page)
      .getByRole("button", { name: "Mark resolved", exact: true })
      .waitFor();
    assert.equal((await getSos(page, created.id)).status, "assigned");
    await page.screenshot({
      path: ".board/unified-responder-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`${base}/phone/responder`);
    const phone = page.frameLocator(
      'iframe[title="FLARE responder on a phone"]',
    );
    await chooseRequest(phone, created.id);
    const phoneResolve = detail(phone).getByRole("button", {
      name: "Mark resolved",
      exact: true,
    });
    await phoneResolve.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: ".board/unified-phone-before-resolve.png",
      fullPage: true,
    });
    await clickInPhone(
      page,
      page.locator('iframe[title="FLARE responder on a phone"]'),
      phoneResolve,
    );
    await detail(phone)
      .getByTestId("sos-status")
      .filter({ hasText: "Resolved" })
      .waitFor();
    assert.equal((await getSos(page, created.id)).status, "resolved");
    assert.equal(
      await phone
        .locator("html")
        .evaluate((element) => element.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({
      path: ".board/unified-phone-responder.png",
      fullPage: true,
    });
  } finally {
    await page.close();
  }
});
