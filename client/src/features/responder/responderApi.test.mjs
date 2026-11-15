import assert from "node:assert/strict";
import test from "node:test";
import { createSampleClient, liveResponderClient } from "./responderApi.ts";
import { api } from "../../shared/api.ts";

test("live responder uses the shared typed API client", () => {
  assert.equal(liveResponderClient, api);
});

test("sample assignment persists, resolution retains team, pending clears it", async () => {
  const client = createSampleClient();
  const [pending] = await client.listSos();
  const assigned = await client.patchSos(pending.id, {
    status: "assigned",
    assignedTeam: "Demo Rescue B",
  });
  assert.equal(assigned.status, "assigned");
  assert.equal((await client.listSos())[0].assignedTeam, "Demo Rescue B");
  const resolved = await client.patchSos(pending.id, { status: "resolved" });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.assignedTeam, "Demo Rescue B");
  assert.equal(
    (await client.patchSos(pending.id, { status: "pending" })).assignedTeam,
    null,
  );
  await assert.rejects(
    client.patchSos("does-not-exist", { status: "resolved" }),
    { status: 404 },
  );
});

test("sample sessions and returned objects are isolated", async () => {
  const first = createSampleClient();
  const second = createSampleClient();
  const rows = await first.listSos();
  rows[0].location.lat = 90;
  await first.patchSos(rows[0].id, { status: "resolved" });
  assert.equal((await second.listSos())[0].status, "pending");
  assert.notEqual((await first.listSos())[0].location.lat, 90);
  const snapshot = await first.recovery();
  snapshot.inventory.water = 0;
  assert.equal((await first.recovery()).inventory.water, 220);
});

test("all recorded strategy responses conserve stock and match shared demand", async () => {
  const client = createSampleClient();
  const snapshot = await client.recovery();
  const results = [];
  for (const strategy of ["priority-first", "proportional", "equal-share"]) {
    const result = await client.compare(strategy);
    results.push(result);
    assert.equal(result.strategy, strategy);
    assert.equal(result.status, "demo-only");
    assert.equal(result.allocations.length, snapshot.centres.length);
    assert.ok(result.explanation.length > 0);
    assert.ok(result.assumptions.length > 0);
    for (const resource of ["water", "food", "hygiene"]) {
      let allocated = 0;
      let unmet = 0;
      let requested = 0;
      for (const centre of snapshot.centres) {
        const row = result.allocations.find(
          (item) => item.centreId === centre.id,
        );
        assert.ok(row, `missing centre ${centre.id}`);
        assert.ok(
          Number.isInteger(row.allocated[resource]) &&
            row.allocated[resource] >= 0,
        );
        assert.ok(
          Number.isInteger(row.unmet[resource]) && row.unmet[resource] >= 0,
        );
        assert.equal(
          row.allocated[resource] + row.unmet[resource],
          centre.needs[resource],
        );
        allocated += row.allocated[resource];
        unmet += row.unmet[resource];
        requested += centre.needs[resource];
      }
      assert.equal(
        allocated + result.inventoryRemaining[resource],
        snapshot.inventory[resource],
      );
      assert.equal(result.totals.allocated[resource], allocated);
      assert.equal(result.totals.unmet[resource], unmet);
      assert.equal(result.totals.requested[resource], requested);
    }
    const untouched = structuredClone(result);
    result.allocations[0].allocated.water = 999;
    assert.deepEqual(await client.compare(strategy), untouched);
  }
  assert.notDeepEqual(results[0].allocations, results[1].allocations);
  assert.notDeepEqual(results[1].allocations, results[2].allocations);
});
