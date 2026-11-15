// D3 / Khaled — operational actions use the frozen shared API.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Inbox,
  LayoutDashboard,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  Search,
  Waves,
} from "lucide-react";
import "@fontsource-variable/geist";
import {
  poll,
  type DemoConfig,
  type Incident,
  type Sos,
  type SosPatch,
  type SosStatus,
} from "../../shared/api.ts";
import { FlareMark } from "../../shared/Logo.tsx";
import {
  createSampleClient,
  liveResponderClient,
  type ResponderClient,
} from "./responderApi.ts";
import RecoveryPanel from "./RecoveryPanel.tsx";
import "./responder.css";

type Mode = "live" | "sample";
const statusLabels: Record<SosStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  resolved: "Resolved",
};
const typeLabels: Record<Sos["type"], string> = {
  trapped: "Trapped",
  "medical-help": "Medical help",
  supplies: "Supplies",
  other: "Other assistance",
};
const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to reach the demo service.";

export default function ResponderPage() {
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(window.location.search).get("mode") === "sample"
      ? "sample"
      : "live",
  );
  return <Operations key={mode} mode={mode} onMode={setMode} />;
}

function Operations({
  mode,
  onMode,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  const reduceMotion = useReducedMotion();
  const client = useMemo<ResponderClient>(
    () => (mode === "sample" ? createSampleClient() : liveResponderClient),
    [mode],
  );
  const [rows, setRows] = useState<Sos[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | SosStatus>("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const readVersion = useRef(0);
  const writing = useRef(false);

  async function refreshQueue() {
    if (writing.current) return;
    const version = ++readVersion.current;
    setRefreshing(true);
    try {
      const next = await client.listSos();
      if (!alive.current || version !== readVersion.current) return;
      setRows(next);
      setQueueError(null);
      setLastSync(new Date().toISOString());
      setSelectedId((id) =>
        next.some((row) => row.id === id)
          ? id
          : (next.find((row) => row.status === "pending")?.id ??
            next[0]?.id ??
            null),
      );
    } catch (error) {
      if (alive.current && version === readVersion.current)
        setQueueError(message(error));
    } finally {
      if (alive.current && version === readVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function refreshContext() {
    const results = await Promise.allSettled([
      client.incidents(),
      client.demoConfig(),
    ]);
    if (!alive.current) return;
    if (results[0].status === "fulfilled") setIncidents(results[0].value);
    if (results[1].status === "fulfilled") setConfig(results[1].value);
    setContextError(
      results.some((result) => result.status === "rejected")
        ? "Incident or demo-team configuration unavailable. Retry to load current context."
        : null,
    );
  }

  useEffect(() => {
    alive.current = true;
    void refreshContext();
    const stop = poll(refreshQueue);
    return () => {
      alive.current = false;
      readVersion.current++;
      stop();
    };
  }, [client]);

  async function updateSos(id: string, patch: SosPatch) {
    if (writing.current) return;
    writing.current = true;
    readVersion.current++;
    setRefreshing(false);
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await client.patchSos(id, patch);
      if (!alive.current) return;
      setRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(
        `${updated.id} ${updated.status === "assigned" ? `assigned to ${updated.assignedTeam}` : "marked resolved"}. ${mode === "sample" ? "Sample session updated." : "Saved by the demo backend."} No emergency service receives this request.`,
      );
    } catch (error) {
      if (alive.current)
        setActionError(
          `Update failed: ${message(error)} The request has not been confirmed as updated. Refresh before retrying.`,
        );
    } finally {
      writing.current = false;
      if (alive.current) {
        setSaving(false);
        void refreshQueue();
      }
    }
  }

  const counts = rows.reduce(
    (totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }),
    { pending: 0, assigned: 0, resolved: 0 },
  );
  const visible = rows
    .filter(
      (row) =>
        (filter === "all" || row.status === filter) &&
        `${row.id} ${row.description} ${row.assignedTeam ?? ""} ${typeLabels[row.type]}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  const selected = rows.find((row) => row.id === selectedId);

  return (
    <div className="flare-ops">
      <aside className="flare-sidebar" aria-label="Operations navigation">
        <a href="/" className="flare-brand">
          <FlareMark
            height={30}
            className="flare-brand-mark"
            aria-hidden="true"
          />
          <span>
            FLARE<small>OPERATIONS PLATFORM</small>
          </span>
        </a>
        <p className="flare-nav-label">WORKSPACE</p>
        <nav>
          <a href="#operations" className="flare-nav-active">
            <LayoutDashboard size={17} aria-hidden="true" /> Overview
          </a>
          <a href="#sos-queue">
            <Inbox size={17} aria-hidden="true" /> SOS requests{" "}
            <b>{rows.length}</b>
          </a>
          <a href="#recovery">
            <Package size={17} aria-hidden="true" /> RecoveryGap
          </a>
        </nav>
        <div className="flare-sidebar-footer">
          <span className="flare-avatar">K</span>
          <div>
            Khaled<small>Responder workspace · Team 2</small>
          </div>
        </div>
      </aside>
      <main id="operations" className="flare-main">
        <header className="flare-topbar">
          <span>
            Workspace <span aria-hidden="true">/</span>{" "}
            <strong>Operations</strong>
          </span>
          <div className="flare-topbar-actions">
            <span className="flare-simulation-chip">
              <span /> Simulation workspace
            </span>
            <a href="/citizen">
              Open citizen portal <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </header>
        <div className="flare-content">
          <div className="flare-page-heading">
            <div>
              <p className="flare-eyebrow">
                <span className="flare-eyebrow-line" /> RESPONSE, WITHOUT THE
                NOISE
              </p>
              <h1>Operations overview</h1>
              <p>Every request. Every resource. One clear view.</p>
            </div>
            <div className="flare-source-switch" aria-label="Data source">
              <button
                aria-pressed={mode === "live"}
                disabled={saving}
                onClick={() => onMode("live")}
              >
                Live demo API
              </button>
              <button
                aria-pressed={mode === "sample"}
                disabled={saving}
                onClick={() => onMode("sample")}
              >
                Sample responses
              </button>
            </div>
          </div>
          {mode === "sample" && (
            <div className="flare-sample-notice" role="note">
              <Radio size={16} aria-hidden="true" />
              <div>
                <strong>Sample workspace</strong>
                <p>
                  Local preview only. Updates stay in this session and are not
                  shared with the citizen portal.
                </p>
              </div>
            </div>
          )}
          {contextError && (
            <div className="flare-error" role="alert">
              {contextError}{" "}
              <button onClick={() => void refreshContext()}>
                Retry context
              </button>
            </div>
          )}
          <section
            className="flare-incident-strip"
            aria-label="Incident summary"
          >
            <div className="flare-incident-icon" aria-hidden="true">
              <Waves size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="flare-eyebrow">ACTIVE SCENARIO · SIMULATED</p>
              <h2>{incidents[0]?.title ?? "Shah Alam flood scenario"}</h2>
              <p>
                {incidents[0]
                  ? `${incidents[0].sourceLabel} · Updated ${time(incidents[0].updatedAt)} MYT`
                  : "Waiting for incident context; no official alert is asserted."}
              </p>
            </div>
            <span className="flare-pill flare-pill-pending">
              {incidents[0]
                ? `${incidents[0].severity} impact · fictional`
                : "Context pending"}
            </span>
          </section>
          <section className="flare-metrics" aria-label="Request counts">
            {(["pending", "assigned", "resolved"] as const).map(
              (status, index) => (
                <motion.div
                  key={status}
                  className={`flare-metric flare-metric-${status}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.45,
                    delay: reduceMotion ? 0 : index * 0.07,
                  }}
                >
                  <div>
                    <p>{statusLabels[status]} requests</p>
                    <motion.strong
                      key={loading ? "loading" : counts[status]}
                      initial={reduceMotion ? false : { opacity: 0.3, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    >
                      {loading ? "—" : counts[status]}
                    </motion.strong>
                    <small>
                      {
                        [
                          "Awaiting a demo team",
                          "With a fictional responder team",
                          "Marked complete in this demo",
                        ][index]
                      }
                    </small>
                  </div>
                  <span aria-hidden="true">
                    {index === 0 ? (
                      <Clock3 size={19} />
                    ) : index === 1 ? (
                      <ArrowUpRight size={19} />
                    ) : (
                      <Check size={19} />
                    )}
                  </span>
                </motion.div>
              ),
            )}
          </section>
          <section
            id="sos-queue"
            className="flare-queue-section"
            aria-labelledby="queue-heading"
          >
            <div className="flare-section-heading">
              <div>
                <p className="flare-eyebrow">RESPONSE OPERATIONS</p>
                <h2 id="queue-heading">
                  Incoming SOS requests{" "}
                  <span className="flare-count">{rows.length}</span>
                </h2>
              </div>
              <div className="flare-sync">
                <span
                  className={
                    queueError ? "flare-dot flare-dot-error" : "flare-dot"
                  }
                />
                {queueError
                  ? "Connection interrupted"
                  : loading
                    ? "Connecting…"
                    : `${mode === "sample" ? "Sample" : "API"} sync · ${lastSync ? `${time(lastSync)} MYT` : "pending"}`}
                <button
                  className="flare-button flare-button-secondary"
                  onClick={() => void refreshQueue()}
                  disabled={refreshing || saving}
                >
                  <RefreshCw
                    size={13}
                    className={refreshing ? "flare-is-refreshing" : undefined}
                    aria-hidden="true"
                  />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
            {queueError && (
              <div className="flare-error" role="alert">
                Queue refresh failed: {queueError}{" "}
                {lastSync
                  ? "Showing the last successful snapshot; actions are disabled until the connection recovers."
                  : "No requests loaded. Retry Refresh or choose Sample responses explicitly."}
              </div>
            )}
            {notice && (
              <div className="flare-success" role="status">
                {notice}
              </div>
            )}
            {actionError && (
              <div className="flare-error" role="alert">
                {actionError}
              </div>
            )}
            <div className="flare-response-grid">
              <div className="flare-card flare-queue-card">
                <div className="flare-queue-tools">
                  <div className="flare-filters" aria-label="Filter requests">
                    {(["all", "pending", "assigned", "resolved"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          aria-pressed={filter === status}
                          onClick={() => setFilter(status)}
                        >
                          {status === "all"
                            ? "All requests"
                            : statusLabels[status]}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="flare-search">
                    <span className="flare-sr-only">Search requests</span>
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Search ID, description, team…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                <div
                  className="flare-request-list"
                  aria-label="SOS requests"
                  aria-busy={loading}
                >
                  {loading ? (
                    <div className="flare-empty">
                      <span className="flare-empty-symbol">◷</span>
                      <h3>Loading the request queue</h3>
                      <p>
                        Connecting to{" "}
                        {mode === "sample"
                          ? "sample responses"
                          : "the shared demo backend"}
                        …
                      </p>
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="flare-empty">
                      <span className="flare-empty-symbol">◎</span>
                      <h3>
                        {rows.length
                          ? "No matching requests"
                          : queueError
                            ? "Queue unavailable"
                            : "Ready for the first request"}
                      </h3>
                      <p>
                        {rows.length
                          ? "Try a different filter or search."
                          : queueError
                            ? "Use Refresh to retry the API."
                            : "Submit a fictional SOS in the citizen portal. It will appear here automatically."}
                      </p>
                      {!rows.length && !queueError && mode === "live" && (
                        <a href="/citizen">Open citizen portal ↗</a>
                      )}
                    </div>
                  ) : (
                    visible.map((row) => (
                      <motion.button
                        key={row.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25 }}
                        className={`flare-request-row ${selectedId === row.id ? "is-selected" : ""}`}
                        aria-pressed={selectedId === row.id}
                        onClick={() => {
                          setSelectedId(row.id);
                          setActionError(null);
                        }}
                      >
                        <span
                          className={`flare-request-symbol flare-symbol-${row.status}`}
                          aria-hidden="true"
                        >
                          {row.status === "resolved" ? (
                            <Check size={17} />
                          ) : (
                            <Inbox size={17} />
                          )}
                        </span>
                        <span className="flare-request-main">
                          <span className="flare-request-top">
                            <strong>{row.id}</strong>
                            <span
                              className={`flare-pill flare-pill-${row.status}`}
                            >
                              {statusLabels[row.status]}
                            </span>
                          </span>
                          <span className="flare-request-description">
                            {row.description}
                          </span>
                          <span className="flare-request-meta">
                            {typeLabels[row.type]} · {row.people}{" "}
                            {row.people === 1 ? "person" : "people"} ·{" "}
                            {time(row.createdAt)} MYT
                          </span>
                        </span>
                        <span
                          className="flare-request-arrow"
                          aria-hidden="true"
                        >
                          <ChevronRight size={15} />
                        </span>
                      </motion.button>
                    ))
                  )}
                </div>
                <div className="flare-list-footer">
                  {visible.length} of {rows.length} requests{" "}
                  <span>Auto-refresh every 2.5 seconds</span>
                </div>
              </div>
              <RequestDetails
                key={selected?.id ?? "empty"}
                row={selected}
                teams={config?.demoTeams ?? []}
                saving={saving}
                disabled={!!queueError || loading}
                onUpdate={updateSos}
              />
            </div>
          </section>
          <RecoveryPanel client={client} mode={mode} />
          <footer className="flare-page-footer">
            <strong>FLARE</strong>
            <span>From Disaster Response to Recovery.</span>
            <span>Fictional data · Demo operations only</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function RequestDetails({
  row,
  teams,
  saving,
  disabled,
  onUpdate,
}: {
  row?: Sos;
  teams: string[];
  saving: boolean;
  disabled: boolean;
  onUpdate: (id: string, patch: SosPatch) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const [team, setTeam] = useState(row?.assignedTeam ?? "");
  useEffect(() => {
    setTeam(row?.assignedTeam ?? "");
  }, [row?.assignedTeam]);
  const activeTeam = teams.includes(team) ? team : (teams[0] ?? "");
  return (
    <motion.aside
      className="flare-card flare-detail"
      aria-labelledby="detail-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <div className="flare-detail-heading">
        <p className="flare-eyebrow">REQUEST DETAILS</p>
        <h3 id="detail-heading">{row?.id ?? "Select a request"}</h3>
        {row && (
          <span className={`flare-pill flare-pill-${row.status}`}>
            {statusLabels[row.status]}
          </span>
        )}
      </div>
      {!row ? (
        <div className="flare-empty">
          <span className="flare-empty-symbol">↖</span>
          <p>Choose a request to review its details and demo assignment.</p>
        </div>
      ) : (
        <>
          <div className="flare-detail-body">
            <dl className="flare-detail-grid">
              <div>
                <dt>Assistance</dt>
                <dd>{typeLabels[row.type]}</dd>
              </div>
              <div>
                <dt>People reported</dt>
                <dd>{row.people}</dd>
              </div>
              <div>
                <dt>Received · MYT</dt>
                <dd>{time(row.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated · MYT</dt>
                <dd>{time(row.updatedAt)}</dd>
              </div>
            </dl>
            <div className="flare-reported">
              <h4>Reported situation</h4>
              <p>{row.description}</p>
            </div>
            <div className="flare-location">
              <MapPin size={18} aria-hidden="true" />
              <div>
                <h4>Approximate demo location</h4>
                <p>
                  {row.location.lat.toFixed(
                    row.locationMode === "browser-opt-in" ? 2 : 3,
                  )}
                  ,{" "}
                  {row.location.lng.toFixed(
                    row.locationMode === "browser-opt-in" ? 2 : 3,
                  )}
                </p>
                <small>
                  {row.locationMode === "browser-opt-in"
                    ? "Opt-in location snapped to a demo point"
                    : "Manually selected fictional point"}{" "}
                  · not a dispatch destination
                </small>
              </div>
            </div>
            <p className="flare-team-current">
              Assigned team{" "}
              <strong>{row.assignedTeam ?? "Not assigned"}</strong>
            </p>
          </div>
          <div className="flare-detail-actions">
            <label htmlFor="demo-team">Fictional responder team</label>
            <select
              id="demo-team"
              value={activeTeam}
              onChange={(event) => setTeam(event.target.value)}
              disabled={
                saving || disabled || row.status === "resolved" || !teams.length
              }
            >
              {!teams.length && (
                <option value="">Demo teams unavailable</option>
              )}
              {teams.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <button
              className="flare-button flare-button-primary"
              disabled={
                saving || disabled || !activeTeam || row.status === "resolved"
              }
              onClick={() =>
                void onUpdate(row.id, {
                  status: "assigned",
                  assignedTeam: activeTeam,
                })
              }
            >
              {saving ? "Saving…" : "Assign Demo Team"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
            <button
              className="flare-button flare-button-secondary"
              disabled={saving || disabled || row.status === "resolved"}
              onClick={() => void onUpdate(row.id, { status: "resolved" })}
            >
              {row.status === "resolved"
                ? "✓ Marked resolved"
                : "Mark Resolved"}
            </button>
            <p>
              Demo only. No real team is dispatched and no emergency service
              receives this request.
            </p>
          </div>
        </>
      )}
    </motion.aside>
  );
}
