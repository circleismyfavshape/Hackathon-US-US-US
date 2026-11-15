import { useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  type ComparisonResult,
  type Quantities,
  type RecoverySnapshot,
  type Resource,
  type Strategy,
} from "../../shared/api.ts";
import type { ResponderClient } from "./responderApi.ts";
import "./recovery.css";

const resources: Resource[] = ["water", "food", "hygiene"];
const strategies: Strategy[] = [
  "priority-first",
  "proportional",
  "equal-share",
  "optimized",
];
const resourceNames: Record<Resource, string> = {
  water: "Drinking water",
  food: "Food packages",
  hygiene: "Hygiene kits",
};
const strategyNames: Record<Strategy, string> = {
  "priority-first": "Priority first",
  proportional: "Proportional",
  "equal-share": "Equal share",
  optimized: "Optimized (GLPK)",
};
const strategyDescriptions: Record<Strategy, string> = {
  "priority-first": "Fill fictional centre priority in order.",
  proportional: "Share stock in proportion to requested units.",
  "equal-share": "Share equally while centres still have unmet needs.",
  optimized:
    "Guarantee every centre the highest possible share of each request, then go by priority.",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 501)
    return "The recovery engine is not available yet (HTTP 501). Retry after the backend is ready, or explicitly switch to sample mode.";
  return error instanceof Error
    ? error.message
    : "The recovery service could not be reached.";
}

function quantityList(quantities: Quantities): string {
  return resources
    .map(
      (resource) =>
        `${quantities[resource]} ${resource === "food" ? "food" : resource}`,
    )
    .join(" · ");
}

export default function RecoveryPanel({
  client,
  mode,
}: {
  client: ResponderClient;
  mode: "live" | "sample";
}) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("priority-first");
  // v1.1: sample mode has recorded responses for the three P0 strategies only.
  const shown = mode === "sample" ? strategies.filter((item) => item !== "optimized") : strategies;
  const [comparing, setComparing] = useState(false);
  const [results, setResults] = useState<
    Partial<Record<Strategy, ComparisonResult>>
  >({});
  const [errors, setErrors] = useState<Partial<Record<Strategy, string>>>({});
  const [comparedAt, setComparedAt] = useState<string | null>(null);
  const version = useRef(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const generation = ++version.current;
    setSnapshot(null);
    setResults({});
    setErrors({});
    setComparedAt(null);
    setComparing(false);
    setLoading(true);
    setLoadError(null);
    client
      .recovery()
      .then((data) => {
        if (version.current === generation) setSnapshot(data);
      })
      .catch((error: unknown) => {
        if (version.current === generation) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (version.current === generation) setLoading(false);
      });
    return () => {
      version.current += 1;
    };
  }, [client, reload]);

  async function compare() {
    if (comparing || !snapshot) return;
    const generation = version.current;
    setComparing(true);
    setErrors({});
    setResults({});
    setComparedAt(null);
    const responses = await Promise.allSettled(
      shown.map((item) => client.compare(item)),
    );
    if (version.current !== generation) return;
    const nextResults: Partial<Record<Strategy, ComparisonResult>> = {};
    const nextErrors: Partial<Record<Strategy, string>> = {};
    responses.forEach((response, index) => {
      const requestedStrategy = shown[index];
      if (response.status === "fulfilled") {
        if (response.value.strategy !== requestedStrategy) {
          nextErrors[requestedStrategy] =
            "The service returned a different strategy. This comparison was not displayed.";
        } else {
          nextResults[requestedStrategy] = response.value;
        }
      } else {
        nextErrors[requestedStrategy] = errorMessage(response.reason);
      }
    });
    setResults(nextResults);
    setErrors(nextErrors);
    setComparedAt(
      `${new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })} MYT`,
    );
    setComparing(false);
  }

  return (
    <section
      id="recovery"
      className="flare-recovery"
      aria-labelledby="recovery-heading"
    >
      <div className="flare-recovery-heading">
        <div>
          <p className="flare-recovery-eyebrow">02 / RECOVERY OPERATIONS</p>
          <h2 id="recovery-heading">Make every supply count.</h2>
          <p>Compare finite stock against three fictional relief centres.</p>
        </div>
        <span className="flare-recovery-label">
          {mode === "sample" ? "SAMPLE RESPONSES" : "SHARED DEMO INVENTORY"}
        </span>
      </div>
      <p className="flare-recovery-disclaimer">
        Demo only. Comparisons do not dispatch supplies or change inventory.
        Quantities and centre priorities are fictional, not humanitarian
        minimums.
      </p>

      {loading && (
        <p className="flare-recovery-state" role="status">
          Loading centre needs and inventory…
        </p>
      )}
      {loadError && (
        <div className="flare-recovery-error" role="alert">
          <p>Recovery data could not be loaded: {loadError}</p>
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Retry recovery data
          </button>
        </div>
      )}

      {snapshot && (
        <>
          <div
            className="flare-recovery-stock"
            aria-label="Central inventory and shortages"
          >
            {resources.map((resource) => {
              const requested = snapshot.centres.reduce(
                (total, centre) => total + centre.needs[resource],
                0,
              );
              const shortage = Math.max(
                0,
                requested - snapshot.inventory[resource],
              );
              return (
                <article key={resource} className="flare-recovery-stock-card">
                  <p className="flare-recovery-resource">
                    {resourceNames[resource]}
                  </p>
                  <div className="flare-recovery-stock-value">
                    {snapshot.inventory[resource].toLocaleString()}
                    <span>units in stock</span>
                  </div>
                  <div className="flare-recovery-stock-meta">
                    <span>{requested.toLocaleString()} requested</span>
                    <strong
                      className={shortage ? "flare-recovery-shortage" : ""}
                    >
                      {shortage.toLocaleString()} short
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className="flare-recovery-centres"
            aria-label="Fictional relief centre needs"
          >
            {snapshot.centres.map((centre) => (
              <article className="flare-recovery-centre" key={centre.id}>
                <div className="flare-recovery-centre-head">
                  <span
                    className="flare-recovery-centre-icon"
                    aria-hidden="true"
                  >
                    {centre.id}
                  </span>
                  <div>
                    <h3>{centre.name}</h3>
                    <p>Fictional priority {centre.priority}</p>
                  </div>
                </div>
                <dl>
                  {resources.map((resource) => (
                    <div key={resource}>
                      <dt>{resourceNames[resource]}</dt>
                      <dd>
                        {centre.needs[resource]} <span>units</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <div className="flare-recovery-toolbar">
            <div>
              <label htmlFor="recovery-strategy">Focus strategy</label>
              <select
                id="recovery-strategy"
                value={strategy}
                onChange={(event) =>
                  setStrategy(event.target.value as Strategy)
                }
              >
                {shown.map((item) => (
                  <option key={item} value={item}>
                    {strategyNames[item]}
                  </option>
                ))}
              </select>
            </div>
            <p>
              {strategyDescriptions[strategy]}
              <br />
              <span>All strategies are compared side by side.</span>
            </p>
            <button
              className="flare-recovery-compare"
              type="button"
              onClick={() => void compare()}
              disabled={comparing}
            >
              {comparing ? "Comparing…" : "Compare strategies"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div role="status" className="flare-recovery-comparison-status">
            {comparing
              ? "Requesting allocation results for all strategies…"
              : comparedAt
                ? `Comparison requested at ${comparedAt}. Results below are a scenario preview.`
                : "Choose a focus, then compare. No supplies will be committed."}
          </div>
          {(comparedAt || comparing) && (
            <div
              className="flare-recovery-results"
              aria-label="Allocation strategy comparison"
              aria-busy={comparing}
            >
              {shown.map((item) => (
                <article
                  className={`flare-recovery-result${strategy === item ? " flare-recovery-result-focused" : ""}`}
                  key={item}
                >
                  <div className="flare-recovery-result-heading">
                    <div>
                      <p className="flare-recovery-eyebrow">
                        {strategy === item ? "SELECTED FOCUS" : "ALTERNATIVE"}
                      </p>
                      <h3>{strategyNames[item]}</h3>
                    </div>
                    <span
                      className="flare-recovery-result-number"
                      aria-hidden="true"
                    >
                      0{shown.indexOf(item) + 1}
                    </span>
                  </div>
                  <p className="flare-recovery-strategy-description">
                    {strategyDescriptions[item]}
                  </p>
                  {comparing && (
                    <p className="flare-recovery-state">Waiting for service…</p>
                  )}
                  {errors[item] && (
                    <p className="flare-recovery-error" role="alert">
                      {errors[item]}
                    </p>
                  )}
                  {results[item] && (
                    <ComparisonDetails
                      result={results[item]}
                      snapshot={snapshot}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ComparisonDetails({
  result,
  snapshot,
}: {
  result: ComparisonResult;
  snapshot: RecoverySnapshot;
}) {
  return (
    <>
      <div className="flare-recovery-result-totals">
        <span>Returned allocation totals</span>
        <strong>{quantityList(result.totals.allocated)}</strong>
        <span>Unmet demand</span>
        <strong className="flare-recovery-shortage">
          {quantityList(result.totals.unmet)}
        </strong>
      </div>
      {result.allocations.map((allocation) => (
        <div className="flare-recovery-allocation" key={allocation.centreId}>
          <h4>
            {snapshot.centres.find(
              (centre) => centre.id === allocation.centreId,
            )?.name ?? allocation.centreId}
          </h4>
          <table>
            <caption className="flare-recovery-sr-only">
              {allocation.centreId} allocated and unmet units
            </caption>
            <thead>
              <tr>
                <th scope="col">Resource</th>
                <th scope="col">Allocated</th>
                <th scope="col">Unmet</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource}>
                  <th scope="row">{resourceNames[resource]}</th>
                  <td>{allocation.allocated[resource]}</td>
                  <td>{allocation.unmet[resource]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="flare-recovery-remaining">
        <span>Inventory remaining</span>
        <strong>{quantityList(result.inventoryRemaining)}</strong>
      </div>
      <details className="flare-recovery-notes">
        <summary>Explanation & assumptions</summary>
        <ul>
          {result.explanation.map((text, index) => (
            <li key={`explanation-${index}`}>{text}</li>
          ))}
        </ul>
        <ul>
          {result.assumptions.map((text, index) => (
            <li key={`assumption-${index}`}>{text}</li>
          ))}
        </ul>
        <p>Scenario comparison · demo only</p>
      </details>
    </>
  );
}
