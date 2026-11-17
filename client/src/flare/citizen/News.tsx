// The news tab keeps official warnings separate from simulated updates.
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Alert, Scenario } from '../../shared/api.ts';
import { ago, clockMY, useNow } from '../data.ts';
import { LoadState } from '../ui.tsx';

type NewsProps = {
  alerts: Alert[];
  loaded: boolean;
  ok: boolean;
  scenario: Scenario;
  nearId: string;
  seenAt: string;
  onRetry: () => void;
  onArea: (id: string) => void;
};
const KIND_LABEL = {
  flood: 'Flood',
  shelter: 'Safe zone',
  update: 'Update',
  weather: 'Weather',
} as const;

export function News({ alerts, loaded, ok, scenario, nearId, seenAt, onArea, onRetry }: NewsProps) {
  const now = useNow();
  const [filter, setFilter] = useState<'all' | 'near' | 'official'>('all');
  // Opening this tab updates the saved timestamp. Keep its old value while the person reads.
  const [seenBefore] = useState(seenAt);
  const newestFirst = (list: Alert[]) =>
    [...list].sort((first, second) => second.at.localeCompare(first.at));
  const official = newestFirst(alerts.filter((alert) => alert.sourceType === 'official'));
  const scenarioItems = newestFirst(alerts.filter((alert) => alert.sourceType === 'simulation'));
  const near = scenarioItems.filter((alert) => alert.incidentId === nearId);
  const elsewhere = scenarioItems.filter((alert) => alert.incidentId !== nearId);
  const areaOf = (alert: Alert) =>
    scenario.incidents.find((incident) => incident.id === alert.incidentId) ?? null;

  // The single most recent item among those on screen gets the "Latest" mark and the strip at the
  // top.
  const visible = [
    ...(filter !== 'official' ? near : []),
    ...(filter !== 'near' ? official : []),
    ...(filter === 'all' ? elsewhere : []),
  ];
  const latest = visible.reduce<Alert | null>(
    (best, alert) => (!best || alert.at > best.at ? alert : best),
    null,
  );
  const isNew = (alert: Alert) => seenBefore !== '' && alert.at > seenBefore;
  const newCount = visible.filter(isNew).length;
  const showLatest = () =>
    document
      .getElementById(`fl-news-${latest?.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const renderItem = (alert: Alert) => {
    const area = areaOf(alert);
    return (
      <li key={alert.id}>
        <article
          id={`fl-news-${alert.id}`}
          className="fl-news"
          data-kind={alert.kind}
          data-official={alert.sourceType === 'official' || undefined}
          data-latest={alert.id === latest?.id || undefined}
          data-new={isNew(alert) || undefined}
        >
          <header>
            <span className="fl-news-kind">{KIND_LABEL[alert.kind]}</span>
            {alert.id === latest?.id ? (
              <span className="fl-news-flag" data-latest>
                Latest
              </span>
            ) : (
              isNew(alert) && <span className="fl-news-flag">New</span>
            )}
            <time
              dateTime={alert.at}
              title={new Date(alert.at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
            >
              {ago(alert.at, now)} · {clockMY(alert.at)}
            </time>
          </header>
          <h3>{alert.title}</h3>
          <p>{alert.text}</p>
          <footer>
            <span
              className="fl-news-src"
              data-official={alert.sourceType === 'official' || undefined}
            >
              {alert.sourceType === 'official'
                ? `Official · ${alert.source}`
                : `Simulated · ${alert.source}`}
            </span>
            {alert.validTo && (
              <span>
                Until{' '}
                {new Date(alert.validTo).toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'Asia/Kuala_Lumpur',
                })}
                , {clockMY(alert.validTo)}
              </span>
            )}
            {alert.sourceType === 'official' && !alert.local && <span>Other states</span>}
            {area && (
              <button type="button" className="fl-linkbtn" onClick={() => onArea(area.id)}>
                {area.area} on map
              </button>
            )}
            {alert.url && (
              <a className="fl-linkbtn" href={alert.url} target="_blank" rel="noreferrer">
                met.gov.my
              </a>
            )}
          </footer>
        </article>
      </li>
    );
  };

  const renderSection = (title: string, hint: string, list: Alert[], empty: string) => (
    <section className="fl-newsgroup">
      <div className="fl-newsgroup-head">
        <h2>{title}</h2>
        <small>{hint}</small>
      </div>
      {list.length ? (
        <ul className="fl-newslist">{list.map(renderItem)}</ul>
      ) : (
        <p className="fl-empty">{empty}</p>
      )}
    </section>
  );

  return (
    <>
      <div className="fl-pagehead">
        <h1>News and warnings</h1>
        <div className="fl-pills" role="group" aria-label="Filter news">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </button>
          <button type="button" aria-pressed={filter === 'near'} onClick={() => setFilter('near')}>
            Near me
          </button>
          <button
            type="button"
            aria-pressed={filter === 'official'}
            onClick={() => setFilter('official')}
          >
            Official
          </button>
        </div>
      </div>
      {!ok && (
        <p className="fl-inline-warn" role="status">
          Could not refresh just now. Showing the last updates received.
        </p>
      )}
      {!loaded ? (
        <LoadState
          error={ok ? null : 'News could not be loaded. Check the connection and try again.'}
          onRetry={onRetry}
        />
      ) : (
        <>
          {latest && (
            <button type="button" className="fl-latest" onClick={showLatest} data-testid="latest">
              <i aria-hidden />
              <span>
                <small>
                  Most recent · {ago(latest.at, now)}
                  {newCount > 0 && ` · ${newCount} new since your last visit`}
                </small>
                <strong>{latest.title}</strong>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
          )}
          {filter !== 'official' &&
            renderSection(
              'Near you',
              'Simulated · newest first',
              near,
              'No updates for your area yet.',
            )}
          {filter !== 'near' &&
            renderSection(
              'Official weather warnings',
              'Live from MET Malaysia · newest first',
              official,
              'No official warnings are in force right now, or the MET Malaysia feed could not be reached.',
            )}
          {filter === 'all' &&
            renderSection(
              'Other areas',
              'Simulated · newest first',
              elsewhere,
              'Nothing from other areas yet.',
            )}
        </>
      )}
    </>
  );
}
